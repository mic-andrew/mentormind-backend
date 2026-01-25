/**
 * SharedCoach Model (MongoDB/Mongoose)
 * Represents coach sharing between users
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

// Permission levels for shared coaches
export const SharePermissions = ['view', 'use', 'edit'] as const;
export type SharePermission = (typeof SharePermissions)[number];

// Share status
export const ShareStatuses = ['pending', 'accepted', 'declined', 'revoked'] as const;
export type ShareStatus = (typeof ShareStatuses)[number];

export interface ISharedCoach extends Document {
  coachId: Types.ObjectId;
  ownerId: Types.ObjectId;
  sharedWithEmail: string;
  sharedWithUserId?: Types.ObjectId;
  permission: SharePermission;
  status: ShareStatus;
  sharedAt: Date;
  acceptedAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SharedCoachSchema = new Schema<ISharedCoach>(
  {
    coachId: {
      type: Schema.Types.ObjectId,
      ref: 'Coach',
      required: true,
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    sharedWithEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    sharedWithUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    permission: {
      type: String,
      enum: SharePermissions,
      default: 'use',
    },
    status: {
      type: String,
      enum: ShareStatuses,
      default: 'pending',
    },
    sharedAt: {
      type: Date,
      default: Date.now,
    },
    acceptedAt: {
      type: Date,
    },
    expiresAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
SharedCoachSchema.index({ coachId: 1, sharedWithEmail: 1 }, { unique: true });
SharedCoachSchema.index({ sharedWithEmail: 1, status: 1 });
SharedCoachSchema.index({ sharedWithUserId: 1, status: 1 });
SharedCoachSchema.index({ ownerId: 1 });
SharedCoachSchema.index({ coachId: 1, status: 1 });

export const SharedCoach = mongoose.model<ISharedCoach>('SharedCoach', SharedCoachSchema);
