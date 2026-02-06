/**
 * Review Controller
 * Handles HTTP requests for coach reviews
 */

import type { Request, Response } from 'express';
import { reviewService } from '../services/reviewService';
import { sendSuccess, sendError, ErrorCodes } from '../utils/response';
import { logger } from '../config/logger';
import type { AuthenticatedRequest } from '../middleware/auth';

class ReviewController {
  /**
   * POST /api/coaches/:coachId/reviews
   */
  async createReview(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req as AuthenticatedRequest;
      const { coachId } = req.params;
      const { rating, content, sessionId } = req.body;

      const result = await reviewService.createReview(userId, coachId, {
        rating,
        content,
        sessionId,
      });

      sendSuccess(res, { review: result }, 201);
    } catch (error) {
      if (error instanceof Error) {
        switch (error.message) {
          case 'INVALID_COACH_ID':
            sendError(res, ErrorCodes.VALIDATION_ERROR, 'Invalid coach ID', 400);
            return;
          case 'COACH_NOT_FOUND':
            sendError(res, ErrorCodes.NOT_FOUND, 'Coach not found', 404);
            return;
          case 'CANNOT_REVIEW_OWN_COACH':
            sendError(res, ErrorCodes.CANNOT_REVIEW_OWN_COACH, 'You cannot review your own coach', 403);
            return;
          case 'ALREADY_REVIEWED':
            sendError(res, ErrorCodes.ALREADY_REVIEWED, 'You have already reviewed this coach', 409);
            return;
        }
      }
      logger.error('Create review error:', error);
      sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to create review', 500);
    }
  }

  /**
   * GET /api/coaches/:coachId/reviews
   */
  async getCoachReviews(req: Request, res: Response): Promise<void> {
    try {
      const { coachId } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      const result = await reviewService.getCoachReviews(coachId, page, limit);
      sendSuccess(res, result);
    } catch (error) {
      if (error instanceof Error) {
        switch (error.message) {
          case 'INVALID_COACH_ID':
            sendError(res, ErrorCodes.VALIDATION_ERROR, 'Invalid coach ID', 400);
            return;
        }
      }
      logger.error('Get coach reviews error:', error);
      sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to fetch reviews', 500);
    }
  }

  /**
   * DELETE /api/coaches/:coachId/reviews/:reviewId
   */
  async deleteReview(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req as AuthenticatedRequest;
      const { reviewId } = req.params;

      const result = await reviewService.deleteReview(reviewId, userId);
      sendSuccess(res, result);
    } catch (error) {
      if (error instanceof Error) {
        switch (error.message) {
          case 'INVALID_REVIEW_ID':
            sendError(res, ErrorCodes.VALIDATION_ERROR, 'Invalid review ID', 400);
            return;
          case 'REVIEW_NOT_FOUND':
            sendError(res, ErrorCodes.REVIEW_NOT_FOUND, 'Review not found', 404);
            return;
          case 'UNAUTHORIZED':
            sendError(res, ErrorCodes.UNAUTHORIZED, 'You can only delete your own reviews', 403);
            return;
        }
      }
      logger.error('Delete review error:', error);
      sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to delete review', 500);
    }
  }

  /**
   * GET /api/coaches/:coachId/reviews/me
   */
  async getUserReview(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req as AuthenticatedRequest;
      const { coachId } = req.params;

      const review = await reviewService.getUserReviewForCoach(userId, coachId);
      sendSuccess(res, { review });
    } catch (error) {
      logger.error('Get user review error:', error);
      sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to fetch review', 500);
    }
  }
}

export const reviewController = new ReviewController();
