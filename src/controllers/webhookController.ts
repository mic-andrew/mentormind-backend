/**
 * Webhook Controller
 * Handles incoming RevenueCat webhook events
 */

import type { Request, Response } from 'express';
import { subscriptionService } from '../services/subscriptionService';
import { logger } from '../config/logger';

class WebhookController {
  /**
   * Handle RevenueCat webhook events
   * Responds 200 immediately, processes event asynchronously
   */
  async handleRevenueCat(req: Request, res: Response): Promise<void> {
    logger.info('Webhook received at /api/webhooks/revenuecat');

    // Verify webhook authorization header
    const expectedKey = process.env.REVENUECAT_WEBHOOK_AUTH_KEY;
    if (expectedKey) {
      const authHeader = req.headers['authorization'] || '';
      // Accept both "Bearer <key>" and raw "<key>" formats
      const receivedKey = authHeader.startsWith('Bearer ')
        ? authHeader.slice(7).trim()
        : authHeader.trim();

      if (receivedKey !== expectedKey.trim()) {
        logger.warn('Webhook auth failed - header mismatch', {
          receivedHeader: authHeader.substring(0, 20) + '...',
          expectedKeyPrefix: expectedKey.substring(0, 10) + '...',
        });
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Invalid webhook authorization' },
        });
        return;
      }
    } else {
      logger.warn('REVENUECAT_WEBHOOK_AUTH_KEY not set - skipping auth check');
    }

    logger.info('Webhook authenticated, processing event', {
      type: req.body?.event?.type,
      userId: req.body?.event?.app_user_id,
    });

    // Respond immediately (RevenueCat requires response within 60 seconds)
    res.status(200).json({ success: true });

    // Process the webhook event asynchronously
    try {
      await subscriptionService.processWebhookEvent(req.body);
    } catch (error) {
      logger.error('Failed to process RevenueCat webhook:', error);
    }
  }
}

export const webhookController = new WebhookController();
