/**
 * Avatar Controller
 * Handles HTTP requests for avatar endpoints
 */

import type { Request, Response } from 'express';
import { avatarService } from '../services/avatarService';
import { sendSuccess, sendError, ErrorCodes } from '../utils/response';
import type { AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../config/logger';
import type { CoachCategory } from '../models/Coach';

export class AvatarController {
  /**
   * GET /api/avatars
   * Get all active avatars (paginated, optional category filter)
   */
  async getAvatars(req: Request, res: Response): Promise<void> {
    try {
      const { page = '1', limit = '20', category } = req.query;

      const result = await avatarService.getAvatars({
        page: parseInt(page as string, 10),
        limit: Math.min(parseInt(limit as string, 10), 50),
        category: category as CoachCategory | undefined,
      });

      sendSuccess(res, {
        avatars: result.data,
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      });
    } catch (error) {
      logger.error('Get avatars error:', error);
      sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to fetch avatars', 500);
    }
  }

  /**
   * GET /api/avatars/available
   * Get avatars available to the authenticated user
   */
  async getAvailableAvatars(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req as AuthenticatedRequest;
      const { page = '1', limit = '20', category } = req.query;

      logger.info('[Controller:getAvailableAvatars] Request received', {
        userId,
        page,
        limit,
        category: category || 'none',
      });

      const result = await avatarService.getAvailableAvatars(userId, {
        page: parseInt(page as string, 10),
        limit: Math.min(parseInt(limit as string, 10), 50),
        category: category as CoachCategory | undefined,
      });

      logger.info('[Controller:getAvailableAvatars] Returning', {
        avatarCount: result.data.length,
        total: result.total,
        page: result.page,
        totalPages: result.totalPages,
      });

      sendSuccess(res, {
        avatars: result.data,
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      });
    } catch (error) {
      logger.error('[Controller:getAvailableAvatars] Error:', {
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to fetch available avatars', 500);
    }
  }

  /**
   * POST /api/avatars/match
   * Match avatars to a coach description using LLM
   */
  async matchAvatars(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req as AuthenticatedRequest;
      const extractedData = req.body;

      logger.info('[Controller:matchAvatars] Request received', {
        userId,
        hasBody: !!extractedData,
        name: extractedData?.name,
        category: extractedData?.category,
        tone: extractedData?.tone,
      });

      if (!extractedData || !extractedData.name || !extractedData.category) {
        logger.error('[Controller:matchAvatars] Missing required fields');
        sendError(
          res,
          ErrorCodes.VALIDATION_ERROR,
          'Coach data with name and category is required',
          400
        );
        return;
      }

      logger.info('[Controller:matchAvatars] Calling avatar service...');
      const avatars = await avatarService.matchAvatarToCoach(extractedData, userId);

      logger.info('[Controller:matchAvatars] SUCCESS', {
        matchCount: avatars.length,
        matchedNames: avatars.map((a) => a.name),
      });

      sendSuccess(res, { avatars });
    } catch (error) {
      logger.error('[Controller:matchAvatars] Error:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to match avatars', 500);
    }
  }

  /**
   * GET /api/avatars/:id
   * Get a single avatar by ID
   */
  async getAvatarById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const avatar = await avatarService.getAvatarById(id);
      sendSuccess(res, { avatar });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'INVALID_AVATAR_ID') {
          sendError(res, ErrorCodes.VALIDATION_ERROR, 'Invalid avatar ID format', 400);
          return;
        }
        if (error.message === 'AVATAR_NOT_FOUND') {
          sendError(res, ErrorCodes.NOT_FOUND, 'Avatar not found', 404);
          return;
        }
      }
      logger.error('Get avatar by ID error:', error);
      sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to fetch avatar', 500);
    }
  }
}

export const avatarController = new AvatarController();
