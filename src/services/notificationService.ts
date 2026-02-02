/**
 * Notification Service
 */

import { Types } from 'mongoose';
import { Notification, NotificationType } from '../models/Notification';
import { logger } from '../config/logger';

interface CreateNotificationData {
  userId: Types.ObjectId | string;
  type: NotificationType;
  title: string;
  message: string;
  coachId?: Types.ObjectId | string;
  relatedUserId?: Types.ObjectId | string;
  shareId?: Types.ObjectId | string;
}

class NotificationService {
  /**
   * Create a new notification
   */
  async createNotification(data: CreateNotificationData) {
    try {
      const notification = await Notification.create({
        userId: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        coachId: data.coachId,
        relatedUserId: data.relatedUserId,
        shareId: data.shareId,
      });

      logger.info(`Notification created for user ${data.userId}: ${data.type}`);
      return notification;
    } catch (error) {
      logger.error('Error creating notification:', error);
      throw error;
    }
  }

  /**
   * Get user's notifications with pagination
   */
  async getUserNotifications(
    userId: string,
    options: { page?: number; limit?: number; unreadOnly?: boolean } = {}
  ) {
    const { page = 1, limit = 20, unreadOnly = false } = options;
    const skip = (page - 1) * limit;

    const query: any = { userId };
    if (unreadOnly) {
      query.isRead = false;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('coachId', 'name specialty avatar')
        .populate('relatedUserId', 'firstName lastName email avatar')
        .lean(),
      Notification.countDocuments(query),
      Notification.countDocuments({ userId, isRead: false }),
    ]);

    return {
      notifications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      unreadCount,
    };
  }

  /**
   * Get unread notification count for a user
   */
  async getUnreadCount(userId: string): Promise<number> {
    return Notification.countDocuments({ userId, isRead: false });
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, userId: string) {
    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, userId },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      throw new Error('Notification not found');
    }

    return notification;
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: string) {
    const result = await Notification.updateMany(
      { userId, isRead: false },
      { isRead: true }
    );

    logger.info(`Marked ${result.modifiedCount} notifications as read for user ${userId}`);
    return result;
  }

  /**
   * Delete a notification
   */
  async deleteNotification(notificationId: string, userId: string) {
    const notification = await Notification.findOneAndDelete({
      _id: notificationId,
      userId,
    });

    if (!notification) {
      throw new Error('Notification not found');
    }

    return notification;
  }

  /**
   * Delete all read notifications for a user
   */
  async deleteReadNotifications(userId: string) {
    const result = await Notification.deleteMany({
      userId,
      isRead: true,
    });

    logger.info(`Deleted ${result.deletedCount} read notifications for user ${userId}`);
    return result;
  }

  /**
   * Create coach share notification
   */
  async createCoachShareNotification(
    recipientUserId: string,
    senderUserId: string,
    coachId: string,
    coachName: string,
    shareId: string
  ) {
    return this.createNotification({
      userId: recipientUserId,
      type: NotificationType.COACH_SHARE,
      title: 'New Coach Shared With You',
      message: `A user shared "${coachName}" with you`,
      coachId,
      relatedUserId: senderUserId,
      shareId,
    });
  }

  /**
   * Create coach accepted notification
   */
  async createCoachAcceptedNotification(
    ownerUserId: string,
    acceptedByUserId: string,
    coachId: string,
    coachName: string
  ) {
    return this.createNotification({
      userId: ownerUserId,
      type: NotificationType.COACH_ACCEPTED,
      title: 'Coach Share Accepted',
      message: `A user accepted your shared coach "${coachName}"`,
      coachId,
      relatedUserId: acceptedByUserId,
    });
  }

  /**
   * Create coach declined notification
   */
  async createCoachDeclinedNotification(
    ownerUserId: string,
    declinedByUserId: string,
    coachId: string,
    coachName: string
  ) {
    return this.createNotification({
      userId: ownerUserId,
      type: NotificationType.COACH_DECLINED,
      title: 'Coach Share Declined',
      message: `A user declined your shared coach "${coachName}"`,
      coachId,
      relatedUserId: declinedByUserId,
    });
  }
}

export const notificationService = new NotificationService();
