/**
 * Dashboard Controller
 * Handles HTTP requests for the home dashboard
 */

import type { Request, Response } from 'express';
import { dashboardService } from '../services/dashboardService';
import { sendSuccess, sendError, ErrorCodes } from '../utils/response';
import { logger } from '../config/logger';
import type { AuthenticatedRequest } from '../middleware/auth';

class DashboardController {
  /**
   * Get aggregated dashboard data
   * GET /api/dashboard
   */
  async getDashboard(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req as AuthenticatedRequest;
      const result = await dashboardService.getDashboard(userId);
      sendSuccess(res, result);
    } catch (error) {
      logger.error('Get dashboard error:', error);
      sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to load dashboard', 500);
    }
  }

  /**
   * Update a commitment's status
   * PATCH /api/dashboard/evaluations/:evaluationId/commitments/:index
   */
  async updateCommitment(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req as AuthenticatedRequest;
      const { evaluationId, index } = req.params;
      const { status } = req.body;

      if (!status || !['pending', 'in_progress', 'completed'].includes(status)) {
        sendError(res, ErrorCodes.VALIDATION_ERROR, 'Invalid status value', 400);
        return;
      }

      const commitmentIndex = parseInt(index, 10);
      if (isNaN(commitmentIndex) || commitmentIndex < 0) {
        sendError(res, ErrorCodes.VALIDATION_ERROR, 'Invalid commitment index', 400);
        return;
      }

      const result = await dashboardService.updateCommitmentStatus(
        evaluationId,
        commitmentIndex,
        userId,
        status
      );

      sendSuccess(res, result);
    } catch (error) {
      if (error instanceof Error) {
        switch (error.message) {
          case 'INVALID_EVALUATION_ID':
            sendError(res, ErrorCodes.VALIDATION_ERROR, 'Invalid evaluation ID', 400);
            return;
          case 'EVALUATION_NOT_FOUND':
            sendError(res, ErrorCodes.NOT_FOUND, 'Evaluation not found', 404);
            return;
          case 'INVALID_COMMITMENT_INDEX':
            sendError(res, ErrorCodes.VALIDATION_ERROR, 'Invalid commitment index', 400);
            return;
        }
      }
      logger.error('Update commitment error:', error);
      sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to update commitment', 500);
    }
  }

  /**
   * Get insights data (commitments + performance + stats)
   * GET /api/dashboard/insights
   */
  async getInsights(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req as AuthenticatedRequest;
      const result = await dashboardService.getInsightsData(userId);
      sendSuccess(res, result);
    } catch (error) {
      logger.error('Get insights error:', error);
      sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to load insights', 500);
    }
  }
}

export const dashboardController = new DashboardController();
