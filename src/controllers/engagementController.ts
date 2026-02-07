/**
 * Engagement Controller
 * Handles HTTP requests for daily engagement features
 */

import type { Request, Response } from 'express';
import { engagementService } from '../services/engagementService';
import { sendSuccess, sendError, ErrorCodes } from '../utils/response';
import { logger } from '../config/logger';
import type { AuthenticatedRequest } from '../middleware/auth';

class EngagementController {
  /**
   * Get today's daily engagement (prompt, nudge, check-in status)
   * GET /api/engagement/daily
   */
  async getDailyEngagement(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req as AuthenticatedRequest;
      const result = await engagementService.getDailyEngagement(userId);
      sendSuccess(res, result);
    } catch (error) {
      logger.error('Get daily engagement error:', error);
      sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to load daily engagement', 500);
    }
  }

  /**
   * Record a daily check-in
   * POST /api/engagement/daily/check-in
   */
  async checkIn(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req as AuthenticatedRequest;
      const { status } = req.body;

      if (!status || !['done', 'partial', 'skipped'].includes(status)) {
        sendError(res, ErrorCodes.VALIDATION_ERROR, 'Invalid check-in status', 400);
        return;
      }

      await engagementService.checkIn(userId, status);
      sendSuccess(res, { success: true });
    } catch (error) {
      logger.error('Check-in error:', error);
      sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to record check-in', 500);
    }
  }
}

export const engagementController = new EngagementController();
