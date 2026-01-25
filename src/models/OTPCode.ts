/**
 * OTP Code Model (MongoDB/Mongoose)
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IOTPCode extends Document {
  userId: mongoose.Types.ObjectId;
  code: string;
  expiresAt: Date;
  verified: boolean;
  type: 'registration' | 'password-reset';
  createdAt: Date;
}

const OTPCodeSchema = new Schema<IOTPCode>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    code: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    verified: {
      type: Boolean,
      default: false,
    },
    type: {
      type: String,
      enum: ['registration', 'password-reset'],
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

OTPCodeSchema.index({ userId: 1, verified: 1 });
OTPCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const OTPCode = mongoose.model<IOTPCode>('OTPCode', OTPCodeSchema);
