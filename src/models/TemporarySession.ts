/**
 * Temporary Session Model (MongoDB/Mongoose)
 * Used for OAuth flows to temporarily store user data before exchanging for tokens
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface ITemporarySession extends Document {
  sessionId: string;
  userId: mongoose.Types.ObjectId;
  provider: 'google' | 'apple';
  expiresAt: Date;
  used: boolean;
  createdAt: Date;
}

const TemporarySessionSchema = new Schema<ITemporarySession>(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    provider: {
      type: String,
      enum: ['google', 'apple'],
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    used: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

TemporarySessionSchema.index({ sessionId: 1, used: 1 });
TemporarySessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const TemporarySession = mongoose.model<ITemporarySession>(
  'TemporarySession',
  TemporarySessionSchema
);
