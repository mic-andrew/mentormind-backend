/**
 * Dashboard Routes
 * Home screen data and commitment tracking
 */

import { Router } from 'express';
import { dashboardController } from '../controllers/dashboardController';
import { authenticate } from '../middleware/auth';

const router = Router();

// GET /api/dashboard - Aggregated home screen data
router.get('/', authenticate, (req, res) => dashboardController.getDashboard(req, res));

// GET /api/dashboard/insights - Analytics + commitments for Insights tab
router.get('/insights', authenticate, (req, res) => dashboardController.getInsights(req, res));

// PATCH /api/dashboard/evaluations/:evaluationId/commitments/:index - Update commitment status
router.patch(
  '/evaluations/:evaluationId/commitments/:index',
  authenticate,
  (req, res) => dashboardController.updateCommitment(req, res)
);

export default router;
