/**
 * Subscription Model (MongoDB/Mongoose)
 * Tracks user subscription status synced via RevenueCat webhooks
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

export type SubscriptionPlan = 'free' | 'monthly' | 'annual';
export type SubscriptionStatusType =
  | 'active'
  | 'expired'
  | 'cancelled'
  | 'billing_issue'
  | 'trial';
export type StorePlatform = 'APP_STORE' | 'PLAY_STORE' | 'AMAZON' | 'STRIPE' | 'RC_BILLING';
export type EnvironmentType = 'SANDBOX' | 'PRODUCTION';
export type PeriodType = 'TRIAL' | 'INTRO' | 'NORMAL' | 'PROMOTIONAL' | 'PREPAID';

export interface ISubscription extends Document {
  userId: Types.ObjectId;
  revenuecatAppUserId: string;
  productId: string;
  entitlementIds: string[];
  plan: SubscriptionPlan;
  status: SubscriptionStatusType;
  store: StorePlatform;
  environment: EnvironmentType;
  purchasedAt?: Date;
  expiresAt?: Date;
  periodType?: PeriodType;
  cancelReason?: string;
  cancelledAt?: Date;
  billingIssueDetectedAt?: Date;
  isSandbox: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SubscriptionSchema = new Schema<ISubscription>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    revenuecatAppUserId: {
      type: String,
      required: true,
      index: true,
    },
    productId: {
      type: String,
      required: true,
    },
    entitlementIds: [{
      type: String,
    }],
    plan: {
      type: String,
      enum: ['free', 'monthly', 'annual'],
      required: true,
      default: 'free',
    },
    status: {
      type: String,
      enum: ['active', 'expired', 'cancelled', 'billing_issue', 'trial'],
      required: true,
      default: 'active',
    },
    store: {
      type: String,
      enum: ['APP_STORE', 'PLAY_STORE', 'AMAZON', 'STRIPE', 'RC_BILLING'],
    },
    environment: {
      type: String,
      enum: ['SANDBOX', 'PRODUCTION'],
    },
    purchasedAt: {
      type: Date,
    },
    expiresAt: {
      type: Date,
    },
    periodType: {
      type: String,
      enum: ['TRIAL', 'INTRO', 'NORMAL', 'PROMOTIONAL', 'PREPAID'],
    },
    cancelReason: {
      type: String,
    },
    cancelledAt: {
      type: Date,
    },
    billingIssueDetectedAt: {
      type: Date,
    },
    isSandbox: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

export const Subscription = mongoose.model<ISubscription>('Subscription', SubscriptionSchema);
