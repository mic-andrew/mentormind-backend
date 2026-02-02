/**
 * Processed Webhook Model (MongoDB/Mongoose)
 * Tracks processed webhook event IDs for idempotency
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IProcessedWebhook extends Document {
  webhookId: string;
  eventType: string;
  processedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ProcessedWebhookSchema = new Schema<IProcessedWebhook>(
  {
    webhookId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    eventType: {
      type: String,
      required: true,
    },
    processedAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Auto-delete processed webhooks after 30 days
ProcessedWebhookSchema.index(
  { processedAt: 1 },
  { expireAfterSeconds: 30 * 24 * 60 * 60 }
);

export const ProcessedWebhook = mongoose.model<IProcessedWebhook>(
  'ProcessedWebhook',
  ProcessedWebhookSchema
);
