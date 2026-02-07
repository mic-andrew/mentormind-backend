/**
 * Notification Routes
 */

import type { Request, Response } from 'express';
import { Router } from 'express';
import { notificationController } from '../controllers/notificationController';
import { authenticate, type AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// All notification routes require authentication
router.use(authenticate);

// Get notifications (must be before /:id routes)
router.get('/', (req: Request, res: Response) =>
  notificationController.getNotifications(req as AuthenticatedRequest, res)
);
router.get('/unread-count', (req: Request, res: Response) =>
  notificationController.getUnreadCount(req as AuthenticatedRequest, res)
);

// Mark all as read (must be before /:id routes)
router.put('/read-all', (req: Request, res: Response) =>
  notificationController.markAllAsRead(req as AuthenticatedRequest, res)
);

// Delete all read notifications (must be before /:id routes)
router.delete('/read', (req: Request, res: Response) =>
  notificationController.deleteReadNotifications(req as AuthenticatedRequest, res)
);

// Parameterized routes
router.put('/:id/read', (req: Request, res: Response) =>
  notificationController.markAsRead(req as AuthenticatedRequest, res)
);
router.delete('/:id', (req: Request, res: Response) =>
  notificationController.deleteNotification(req as AuthenticatedRequest, res)
);

export default router;
