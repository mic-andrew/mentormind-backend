/**
 * Route aggregator
 */

import { Router } from 'express';
import authRoutes from './authRoutes';
import coachRoutes from './coachRoutes';
import sessionRoutes from './sessionRoutes';
import avatarRoutes from './avatarRoutes';
import notificationRoutes from './notificationRoutes';
import subscriptionRoutes from './subscriptionRoutes';
import webhookRoutes from './webhookRoutes';
import dashboardRoutes from './dashboardRoutes';
import engagementRoutes from './engagementRoutes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/coaches', coachRoutes);
router.use('/sessions', sessionRoutes);
router.use('/avatars', avatarRoutes);
router.use('/notifications', notificationRoutes);
router.use('/subscription', subscriptionRoutes);
router.use('/webhooks', webhookRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/engagement', engagementRoutes);

// Health check
router.get('/health', (_, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export { router as apiRoutes };
