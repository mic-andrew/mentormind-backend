/**
 * Subscription Controller
 * Handles subscription status and usage API endpoints
 */

import type { Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth';
import { subscriptionService } from '../services/subscriptionService';
import { sendSuccess, sendError, ErrorCodes } from '../utils/response';

class SubscriptionController {
  /**
   * Get subscription status and usage for the authenticated user
   */
  async getStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const status = await subscriptionService.getSubscriptionStatus(req.userId);
      sendSuccess(res, status);
    } catch (error) {
      sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to get subscription status', 500);
    }
  }

  /**
   * Get usage counts for the authenticated user
   */
  async getUsage(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const usage = await subscriptionService.getUsage(req.userId);
      sendSuccess(res, usage);
    } catch (error) {
      sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to get usage data', 500);
    }
  }
}

export const subscriptionController = new SubscriptionController();
