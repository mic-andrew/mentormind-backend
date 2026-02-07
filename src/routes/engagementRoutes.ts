/**
 * Engagement Routes
 * Daily prompts, coach nudges, and check-ins
 */

import { Router } from 'express';
import { engagementController } from '../controllers/engagementController';
import { authenticate } from '../middleware/auth';

const router = Router();

// GET /api/engagement/daily - Get today's engagement content
router.get('/daily', authenticate, (req, res) =>
  engagementController.getDailyEngagement(req, res)
);

// POST /api/engagement/daily/check-in - Record a check-in
router.post('/daily/check-in', authenticate, (req, res) =>
  engagementController.checkIn(req, res)
);

export default router;
