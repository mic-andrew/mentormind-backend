/**
 * Notification Controller
 */

import type { Response } from 'express';
import { notificationService } from '../services/notificationService';
import type { AuthenticatedRequest } from '../middleware/auth';
import { sendSuccess, sendError, ErrorCodes } from '../utils/response';
import { logger } from '../config/logger';

class NotificationController {
  /**
   * Get user's notifications
   * GET /api/notifications
   */
  async getNotifications(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId!;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const unreadOnly = req.query.unreadOnly === 'true';

      const result = await notificationService.getUserNotifications(userId, {
        page,
        limit,
        unreadOnly,
      });

      sendSuccess(res, result);
    } catch (error) {
      logger.error('Get notifications error:', error);
      sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to fetch notifications', 500);
    }
  }

  /**
   * Get unread notification count
   * GET /api/notifications/unread-count
   */
  async getUnreadCount(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId!;
      const count = await notificationService.getUnreadCount(userId);

      sendSuccess(res, { unreadCount: count });
    } catch (error) {
      logger.error('Get unread count error:', error);
      sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to fetch unread count', 500);
    }
  }

  /**
   * Mark notification as read
   * PUT /api/notifications/:id/read
   */
  async markAsRead(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId!;
      const { id } = req.params;

      const notification = await notificationService.markAsRead(id, userId);

      sendSuccess(res, { notification });
    } catch (error: any) {
      logger.error('Mark as read error:', error);
      if (error.message === 'Notification not found') {
        sendError(res, ErrorCodes.NOT_FOUND, 'Notification not found', 404);
        return;
      }
      sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to mark notification as read', 500);
    }
  }

  /**
   * Mark all notifications as read
   * PUT /api/notifications/read-all
   */
  async markAllAsRead(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId!;
      await notificationService.markAllAsRead(userId);

      sendSuccess(res, { message: 'All notifications marked as read' });
    } catch (error) {
      logger.error('Mark all as read error:', error);
      sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to mark notifications as read', 500);
    }
  }

  /**
   * Delete notification
   * DELETE /api/notifications/:id
   */
  async deleteNotification(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId!;
      const { id } = req.params;

      await notificationService.deleteNotification(id, userId);

      sendSuccess(res, { message: 'Notification deleted' });
    } catch (error: any) {
      logger.error('Delete notification error:', error);
      if (error.message === 'Notification not found') {
        sendError(res, ErrorCodes.NOT_FOUND, 'Notification not found', 404);
        return;
      }
      sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to delete notification', 500);
    }
  }

  /**
   * Delete all read notifications
   * DELETE /api/notifications/read
   */
  async deleteReadNotifications(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.userId!;
      await notificationService.deleteReadNotifications(userId);

      sendSuccess(res, { message: 'Read notifications deleted' });
    } catch (error) {
      logger.error('Delete read notifications error:', error);
      sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to delete read notifications', 500);
    }
  }
}

export const notificationController = new NotificationController();
