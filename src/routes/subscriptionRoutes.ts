/**
 * Subscription routes
 */

import { Router } from 'express';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { subscriptionController } from '../controllers/subscriptionController';

const router = Router();

// All routes require authentication
router.get(
  '/status',
  authenticate,
  (req, res) => subscriptionController.getStatus(req as AuthenticatedRequest, res)
);

router.get(
  '/usage',
  authenticate,
  (req, res) => subscriptionController.getUsage(req as AuthenticatedRequest, res)
);

export default router;
