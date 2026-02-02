/**
 * Notification Model
 */

import { Schema, model, type Document } from 'mongoose';

export enum NotificationType {
  COACH_SHARE = 'coach_share',
  COACH_ACCEPTED = 'coach_accepted',
  COACH_DECLINED = 'coach_declined',
  SYSTEM = 'system',
}

export interface INotification extends Document {
  userId: Schema.Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  coachId?: Schema.Types.ObjectId;
  relatedUserId?: Schema.Types.ObjectId;
  shareId?: Schema.Types.ObjectId;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(NotificationType),
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    coachId: {
      type: Schema.Types.ObjectId,
      ref: 'Coach',
    },
    relatedUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    shareId: {
      type: Schema.Types.ObjectId,
      ref: 'CoachShare',
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient querying of user's notifications
NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, isRead: 1 });

export const Notification = model<INotification>('Notification', NotificationSchema);
