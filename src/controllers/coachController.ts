/**
 * Coach Controller
 * Handles HTTP requests for coach endpoints including sharing
 */

import type { Request, Response } from 'express';
import { coachService } from '../services/coachService';
import { sendSuccess, sendError, ErrorCodes } from '../utils/response';
import type { AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../config/logger';
import type { CoachCategory } from '../models/Coach';

export class CoachController {
  /**
   * GET /api/coaches
   * Get all published coaches with optional filters
   */
  async getCoaches(req: Request, res: Response): Promise<void> {
    try {
      const { category, search, page = '1', limit = '20', featured } = req.query;

      const result = await coachService.getCoaches({
        category: category as CoachCategory | 'all' | undefined,
        search: search as string | undefined,
        page: parseInt(page as string, 10),
        limit: Math.min(parseInt(limit as string, 10), 50),
        isFeatured: featured === 'true' ? true : undefined,
      });

      sendSuccess(res, {
        coaches: result.data,
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      });
    } catch (error) {
      logger.error('Get coaches error:', error);
      sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to fetch coaches', 500);
    }
  }

  /**
   * GET /api/coaches/featured
   * Get featured coaches
   */
  async getFeaturedCoaches(req: Request, res: Response): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string, 10) || 6;
      const coaches = await coachService.getFeaturedCoaches(Math.min(limit, 12));
      sendSuccess(res, { coaches });
    } catch (error) {
      logger.error('Get featured coaches error:', error);
      sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to fetch featured coaches', 500);
    }
  }

  /**
   * GET /api/coaches/categories
   * Get all categories with coach counts
   */
  async getCategories(req: Request, res: Response): Promise<void> {
    try {
      const categories = await coachService.getCategories();
      sendSuccess(res, { categories });
    } catch (error) {
      logger.error('Get categories error:', error);
      sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to fetch categories', 500);
    }
  }

  /**
   * GET /api/coaches/my-coaches
   * Get coaches owned by user + shared with user
   * Protected route
   */
  async getMyCoaches(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req as AuthenticatedRequest;
      const { page = '1', limit = '20' } = req.query;

      const result = await coachService.getMyCoaches(
        userId,
        parseInt(page as string, 10),
        Math.min(parseInt(limit as string, 10), 50)
      );

      sendSuccess(res, {
        coaches: result.data,
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      });
    } catch (error) {
      logger.error('Get my coaches error:', error);
      sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to fetch your coaches', 500);
    }
  }

  /**
   * GET /api/coaches/pending-shares
   * Get pending share invitations for the user
   * Protected route
   */
  async getPendingShares(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req as AuthenticatedRequest;
      const shares = await coachService.getPendingShares(userId);
      sendSuccess(res, { shares });
    } catch (error) {
      logger.error('Get pending shares error:', error);
      sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to fetch pending shares', 500);
    }
  }

  /**
   * GET /api/coaches/:id
   * Get a single coach by ID
   */
  async getCoachById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = (req as AuthenticatedRequest).userId;
      const coach = await coachService.getCoachById(id, userId);
      sendSuccess(res, { coach });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'INVALID_COACH_ID') {
          sendError(res, ErrorCodes.VALIDATION_ERROR, 'Invalid coach ID format', 400);
          return;
        }
        if (error.message === 'COACH_NOT_FOUND') {
          sendError(res, ErrorCodes.NOT_FOUND, 'Coach not found', 404);
          return;
        }
      }
      logger.error('Get coach by ID error:', error);
      sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to fetch coach', 500);
    }
  }

  /**
   * GET /api/coaches/:id/session
   * Get coach data for starting a session (includes system prompt)
   * Protected route
   */
  async getCoachForSession(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req as AuthenticatedRequest;
      const { id } = req.params;
      const coach = await coachService.getCoachForSession(id, userId);
      sendSuccess(res, { coach });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'INVALID_COACH_ID') {
          sendError(res, ErrorCodes.VALIDATION_ERROR, 'Invalid coach ID format', 400);
          return;
        }
        if (error.message === 'COACH_NOT_FOUND') {
          sendError(res, ErrorCodes.NOT_FOUND, 'Coach not found', 404);
          return;
        }
        if (error.message === 'FORBIDDEN') {
          sendError(res, ErrorCodes.FORBIDDEN, 'You do not have access to this coach', 403);
          return;
        }
      }
      logger.error('Get coach for session error:', error);
      sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to fetch coach', 500);
    }
  }

  /**
   * POST /api/coaches
   * Create a new coach
   * Protected route
   */
  async createCoach(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req as AuthenticatedRequest;
      const coach = await coachService.createCoach(req.body, userId);
      sendSuccess(res, { coach }, 201);
    } catch (error) {
      logger.error('Create coach error:', error);
      sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to create coach', 500);
    }
  }

  /**
   * PUT /api/coaches/:id
   * Update a coach
   * Protected route
   */
  async updateCoach(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req as AuthenticatedRequest;
      const { id } = req.params;
      const coach = await coachService.updateCoach(id, req.body, userId);
      sendSuccess(res, { coach });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'INVALID_COACH_ID') {
          sendError(res, ErrorCodes.VALIDATION_ERROR, 'Invalid coach ID format', 400);
          return;
        }
        if (error.message === 'COACH_NOT_FOUND') {
          sendError(res, ErrorCodes.NOT_FOUND, 'Coach not found', 404);
          return;
        }
        if (error.message === 'FORBIDDEN' || error.message === 'CANNOT_EDIT_SYSTEM_COACH') {
          sendError(res, ErrorCodes.FORBIDDEN, 'You do not have permission to edit this coach', 403);
          return;
        }
      }
      logger.error('Update coach error:', error);
      sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to update coach', 500);
    }
  }

  /**
   * DELETE /api/coaches/:id
   * Delete a coach
   * Protected route
   */
  async deleteCoach(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req as AuthenticatedRequest;
      const { id } = req.params;
      const result = await coachService.deleteCoach(id, userId);
      sendSuccess(res, result);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'INVALID_COACH_ID') {
          sendError(res, ErrorCodes.VALIDATION_ERROR, 'Invalid coach ID format', 400);
          return;
        }
        if (error.message === 'COACH_NOT_FOUND') {
          sendError(res, ErrorCodes.NOT_FOUND, 'Coach not found', 404);
          return;
        }
        if (error.message === 'FORBIDDEN' || error.message === 'CANNOT_DELETE_SYSTEM_COACH') {
          sendError(res, ErrorCodes.FORBIDDEN, 'You do not have permission to delete this coach', 403);
          return;
        }
      }
      logger.error('Delete coach error:', error);
      sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to delete coach', 500);
    }
  }

  /**
   * POST /api/coaches/:id/share
   * Share a coach with another user
   * Protected route
   */
  async shareCoach(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req as AuthenticatedRequest;
      const { id } = req.params;
      const { email, permission } = req.body;

      if (!email || !permission) {
        sendError(res, ErrorCodes.VALIDATION_ERROR, 'Email and permission are required', 400);
        return;
      }

      const share = await coachService.shareCoach(id, userId, { email, permission });
      sendSuccess(res, { share }, 201);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'INVALID_COACH_ID') {
          sendError(res, ErrorCodes.VALIDATION_ERROR, 'Invalid coach ID format', 400);
          return;
        }
        if (error.message === 'COACH_NOT_FOUND') {
          sendError(res, ErrorCodes.NOT_FOUND, 'Coach not found', 404);
          return;
        }
        if (error.message === 'FORBIDDEN' || error.message === 'CANNOT_SHARE_SYSTEM_COACH') {
          sendError(res, ErrorCodes.FORBIDDEN, 'You cannot share this coach', 403);
          return;
        }
        if (error.message === 'CANNOT_SHARE_WITH_SELF') {
          sendError(res, ErrorCodes.VALIDATION_ERROR, 'You cannot share a coach with yourself', 400);
          return;
        }
      }
      logger.error('Share coach error:', error);
      sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to share coach', 500);
    }
  }

  /**
   * GET /api/coaches/:id/shares
   * Get all shares for a coach
   * Protected route
   */
  async getCoachShares(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req as AuthenticatedRequest;
      const { id } = req.params;
      const shares = await coachService.getCoachShares(id, userId);
      sendSuccess(res, { shares });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'INVALID_COACH_ID') {
          sendError(res, ErrorCodes.VALIDATION_ERROR, 'Invalid coach ID format', 400);
          return;
        }
        if (error.message === 'COACH_NOT_FOUND') {
          sendError(res, ErrorCodes.NOT_FOUND, 'Coach not found', 404);
          return;
        }
        if (error.message === 'FORBIDDEN') {
          sendError(res, ErrorCodes.FORBIDDEN, 'You do not have permission to view shares', 403);
          return;
        }
      }
      logger.error('Get coach shares error:', error);
      sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to fetch shares', 500);
    }
  }

  /**
   * DELETE /api/coaches/:id/shares/:shareId
   * Revoke a coach share
   * Protected route
   */
  async revokeShare(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req as AuthenticatedRequest;
      const { id, shareId } = req.params;
      const result = await coachService.revokeShare(id, shareId, userId);
      sendSuccess(res, result);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'INVALID_ID') {
          sendError(res, ErrorCodes.VALIDATION_ERROR, 'Invalid ID format', 400);
          return;
        }
        if (error.message === 'COACH_NOT_FOUND' || error.message === 'SHARE_NOT_FOUND') {
          sendError(res, ErrorCodes.NOT_FOUND, 'Share not found', 404);
          return;
        }
        if (error.message === 'FORBIDDEN') {
          sendError(res, ErrorCodes.FORBIDDEN, 'You do not have permission to revoke this share', 403);
          return;
        }
      }
      logger.error('Revoke share error:', error);
      sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to revoke share', 500);
    }
  }

  /**
   * POST /api/coaches/shares/:shareId/accept
   * Accept a share invitation
   * Protected route
   */
  async acceptShare(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req as AuthenticatedRequest;
      const { shareId } = req.params;
      const result = await coachService.acceptShare(shareId, userId);
      sendSuccess(res, result);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'INVALID_SHARE_ID') {
          sendError(res, ErrorCodes.VALIDATION_ERROR, 'Invalid share ID format', 400);
          return;
        }
        if (error.message === 'SHARE_NOT_FOUND' || error.message === 'USER_NOT_FOUND') {
          sendError(res, ErrorCodes.NOT_FOUND, 'Share invitation not found', 404);
          return;
        }
      }
      logger.error('Accept share error:', error);
      sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to accept share', 500);
    }
  }

  /**
   * POST /api/coaches/shares/:shareId/decline
   * Decline a share invitation
   * Protected route
   */
  async declineShare(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req as AuthenticatedRequest;
      const { shareId } = req.params;
      const result = await coachService.declineShare(shareId, userId);
      sendSuccess(res, result);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'INVALID_SHARE_ID') {
          sendError(res, ErrorCodes.VALIDATION_ERROR, 'Invalid share ID format', 400);
          return;
        }
        if (error.message === 'SHARE_NOT_FOUND' || error.message === 'USER_NOT_FOUND') {
          sendError(res, ErrorCodes.NOT_FOUND, 'Share invitation not found', 404);
          return;
        }
      }
      logger.error('Decline share error:', error);
      sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to decline share', 500);
    }
  }

  /**
   * POST /api/coaches/:id/flag
   * Flag a coach for review
   * Protected route
   */
  async flagCoach(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const result = await coachService.flagCoach(id);
      sendSuccess(res, result);
    } catch (error) {
      if (error instanceof Error && error.message === 'INVALID_COACH_ID') {
        sendError(res, ErrorCodes.VALIDATION_ERROR, 'Invalid coach ID format', 400);
        return;
      }
      logger.error('Flag coach error:', error);
      sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to flag coach', 500);
    }
  }
}

export const coachController = new CoachController();
