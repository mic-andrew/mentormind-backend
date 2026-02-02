/**
 * Subscription Service
 * Handles subscription business logic, usage tracking, and RevenueCat webhook processing
 */

import { Types } from 'mongoose';
import { Subscription, ISubscription, SubscriptionPlan } from '../models/Subscription';
import { ProcessedWebhook } from '../models/ProcessedWebhook';
import { Coach } from '../models/Coach';
import { VoiceSession } from '../models/VoiceSession';
import { logger } from '../config/logger';

const FREE_TIER_LIMITS = {
  maxCoaches: 1,
  maxSessions: 1,
};

interface UsageInfo {
  coachesCreated: number;
  sessionsUsed: number;
  limits: {
    maxCoaches: number | null;
    maxSessions: number | null;
  };
}

interface SubscriptionStatusResult {
  plan: SubscriptionPlan;
  status: string;
  isProUser: boolean;
  expiresAt?: string;
  periodType?: string;
  usage: UsageInfo;
}

interface WebhookEvent {
  type: string;
  id: string;
  app_user_id: string;
  original_app_user_id: string;
  product_id: string;
  entitlement_ids?: string[];
  period_type?: string;
  purchased_at_ms?: number;
  expiration_at_ms?: number;
  environment: string;
  store: string;
  cancel_reason?: string;
  expiration_reason?: string;
  price?: number;
  currency?: string;
  new_product_id?: string;
}

class SubscriptionService {
  /**
   * Check if a user has an active pro subscription
   */
  async isProUser(userId: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(userId)) {
      return false;
    }

    const subscription = await Subscription.findOne({
      userId: new Types.ObjectId(userId),
      status: { $in: ['active', 'trial'] },
    });

    return !!subscription;
  }

  /**
   * Get usage counts for a user
   */
  async getUsage(userId: string): Promise<UsageInfo> {
    const userObjectId = new Types.ObjectId(userId);
    const isPro = await this.isProUser(userId);

    const [coachesCreated, sessionsUsed] = await Promise.all([
      Coach.countDocuments({ createdBy: userObjectId }),
      VoiceSession.countDocuments({
        userId: userObjectId,
        status: { $in: ['ended', 'active', 'paused'] },
      }),
    ]);

    return {
      coachesCreated,
      sessionsUsed,
      limits: {
        maxCoaches: isPro ? null : FREE_TIER_LIMITS.maxCoaches,
        maxSessions: isPro ? null : FREE_TIER_LIMITS.maxSessions,
      },
    };
  }

  /**
   * Check if a user can create a new coach
   */
  async canCreateCoach(userId: string): Promise<boolean> {
    const isPro = await this.isProUser(userId);
    if (isPro) return true;

    const coachesCreated = await Coach.countDocuments({
      createdBy: new Types.ObjectId(userId),
    });

    return coachesCreated < FREE_TIER_LIMITS.maxCoaches;
  }

  /**
   * Check if a user can start a new session
   */
  async canStartSession(userId: string): Promise<boolean> {
    const isPro = await this.isProUser(userId);
    if (isPro) return true;

    const sessionsUsed = await VoiceSession.countDocuments({
      userId: new Types.ObjectId(userId),
      status: { $in: ['ended', 'active', 'paused'] },
    });

    return sessionsUsed < FREE_TIER_LIMITS.maxSessions;
  }

  /**
   * Get full subscription status for a user
   */
  async getSubscriptionStatus(userId: string): Promise<SubscriptionStatusResult> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new Error('INVALID_USER_ID');
    }

    const subscription = await Subscription.findOne({
      userId: new Types.ObjectId(userId),
    });

    const usage = await this.getUsage(userId);

    if (!subscription) {
      return {
        plan: 'free',
        status: 'active',
        isProUser: false,
        usage,
      };
    }

    const isActive = subscription.status === 'active' || subscription.status === 'trial';

    return {
      plan: isActive ? subscription.plan : 'free',
      status: subscription.status,
      isProUser: isActive,
      expiresAt: subscription.expiresAt?.toISOString(),
      periodType: subscription.periodType,
      usage,
    };
  }

  /**
   * Map a RevenueCat product ID to a subscription plan
   */
  private mapProductToPlan(productId: string): SubscriptionPlan {
    const id = productId.toLowerCase();
    if (id.includes('annual') || id.includes('yearly') || id.includes('year')) {
      return 'annual';
    }
    if (id.includes('monthly') || id.includes('month')) {
      return 'monthly';
    }
    // Default to monthly if we can't determine
    return 'monthly';
  }

  /**
   * Process a RevenueCat webhook event (idempotent)
   */
  async processWebhookEvent(payload: { event: WebhookEvent }): Promise<void> {
    const { event } = payload;

    // Idempotency check
    const existing = await ProcessedWebhook.findOne({ webhookId: event.id });
    if (existing) {
      logger.info(`Webhook already processed: ${event.id} (${event.type})`);
      return;
    }

    // Record the webhook for idempotency
    await ProcessedWebhook.create({
      webhookId: event.id,
      eventType: event.type,
      processedAt: new Date(),
    });

    logger.info(`Processing webhook: ${event.type} for user ${event.app_user_id}`);

    switch (event.type) {
      case 'INITIAL_PURCHASE':
      case 'RENEWAL':
        await this.activateSubscription(event);
        break;
      case 'CANCELLATION':
        await this.deactivateSubscription(event, 'cancelled');
        break;
      case 'EXPIRATION':
        await this.deactivateSubscription(event, 'expired');
        break;
      case 'BILLING_ISSUE':
        await this.handleBillingIssue(event);
        break;
      case 'UNCANCELLATION':
        await this.reactivateSubscription(event);
        break;
      case 'PRODUCT_CHANGE':
        await this.handleProductChange(event);
        break;
      case 'SUBSCRIPTION_PAUSED':
        await this.deactivateSubscription(event, 'expired');
        break;
      case 'TEST':
        logger.info('Received RevenueCat test webhook');
        break;
      default:
        logger.info(`Unhandled webhook event type: ${event.type}`);
    }
  }

  private async activateSubscription(event: WebhookEvent): Promise<void> {
    const userId = event.app_user_id;

    // Determine if userId is a valid ObjectId (our MongoDB user ID)
    if (!Types.ObjectId.isValid(userId)) {
      logger.warn(`Webhook user ID is not a valid ObjectId: ${userId}`);
      return;
    }

    const plan = this.mapProductToPlan(event.product_id);
    const periodType = event.period_type as ISubscription['periodType'];
    const status = periodType === 'TRIAL' ? 'trial' : 'active';

    await Subscription.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      {
        revenuecatAppUserId: event.original_app_user_id || userId,
        productId: event.product_id,
        entitlementIds: event.entitlement_ids || [],
        plan,
        status,
        store: event.store as ISubscription['store'],
        environment: event.environment as ISubscription['environment'],
        purchasedAt: event.purchased_at_ms ? new Date(event.purchased_at_ms) : new Date(),
        expiresAt: event.expiration_at_ms ? new Date(event.expiration_at_ms) : undefined,
        periodType,
        isSandbox: event.environment === 'SANDBOX',
        cancelReason: undefined,
        cancelledAt: undefined,
        billingIssueDetectedAt: undefined,
      },
      { upsert: true, new: true }
    );

    logger.info(`Subscription activated: ${plan} for user ${userId}`);
  }

  private async deactivateSubscription(
    event: WebhookEvent,
    newStatus: 'cancelled' | 'expired'
  ): Promise<void> {
    const userId = event.app_user_id;

    if (!Types.ObjectId.isValid(userId)) {
      logger.warn(`Webhook user ID is not a valid ObjectId: ${userId}`);
      return;
    }

    await Subscription.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      {
        status: newStatus,
        cancelReason: event.cancel_reason || event.expiration_reason,
        cancelledAt: new Date(),
      }
    );

    logger.info(`Subscription ${newStatus}: user ${userId}, reason: ${event.cancel_reason || event.expiration_reason}`);
  }

  private async handleBillingIssue(event: WebhookEvent): Promise<void> {
    const userId = event.app_user_id;

    if (!Types.ObjectId.isValid(userId)) return;

    await Subscription.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      {
        status: 'billing_issue',
        billingIssueDetectedAt: new Date(),
      }
    );

    logger.info(`Billing issue detected for user ${userId}`);
  }

  private async reactivateSubscription(event: WebhookEvent): Promise<void> {
    const userId = event.app_user_id;

    if (!Types.ObjectId.isValid(userId)) return;

    await Subscription.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      {
        status: 'active',
        cancelReason: undefined,
        cancelledAt: undefined,
        billingIssueDetectedAt: undefined,
      }
    );

    logger.info(`Subscription reactivated for user ${userId}`);
  }

  private async handleProductChange(event: WebhookEvent): Promise<void> {
    const userId = event.app_user_id;

    if (!Types.ObjectId.isValid(userId)) return;

    const newProductId = event.new_product_id || event.product_id;
    const newPlan = this.mapProductToPlan(newProductId);

    await Subscription.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      {
        productId: newProductId,
        plan: newPlan,
        entitlementIds: event.entitlement_ids || [],
      }
    );

    logger.info(`Subscription product changed for user ${userId}: ${newPlan}`);
  }
}

export const subscriptionService = new SubscriptionService();
