/**
 * Notification Routes
 */

import { Router } from 'express';
import { notificationController } from '../controllers/notificationController';
import { authenticate } from '../middleware/auth';

const router = Router();

// All notification routes require authentication
router.use(authenticate);

// Get notifications (must be before /:id routes)
router.get('/', (req, res) => notificationController.getNotifications(req, res));
router.get('/unread-count', (req, res) => notificationController.getUnreadCount(req, res));

// Mark all as read (must be before /:id routes)
router.put('/read-all', (req, res) => notificationController.markAllAsRead(req, res));

// Delete all read notifications (must be before /:id routes)
router.delete('/read', (req, res) => notificationController.deleteReadNotifications(req, res));

// Parameterized routes
router.put('/:id/read', (req, res) => notificationController.markAsRead(req, res));
router.delete('/:id', (req, res) => notificationController.deleteNotification(req, res));

export default router;
