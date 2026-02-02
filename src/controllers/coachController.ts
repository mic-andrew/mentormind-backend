/**
 * Coach Controller
 * Handles HTTP requests for coach endpoints including sharing
 */

import type { Request, Response } from 'express';
import { coachService } from '../services/coachService';
import { transcriptionService } from '../services/transcriptionService';
import { aiExtractionService } from '../services/aiExtractionService';
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

  /**
   * POST /api/coaches/transcribe
   * Transcribe audio to text using Deepgram
   */
  async transcribeAudio(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      logger.info('[Controller:transcribe] Request received', {
        userId: req.userId,
        hasFile: !!req.file,
        fileSize: req.file?.size,
        mimeType: req.file?.mimetype,
        fieldName: req.file?.fieldname,
      });

      if (!req.file) {
        logger.error('[Controller:transcribe] No audio file in request');
        sendError(res, ErrorCodes.VALIDATION_ERROR, 'No audio file provided', 400);
        return;
      }

      logger.info('[Controller:transcribe] Sending to transcription service...');
      const transcript = await transcriptionService.transcribeAudio(
        req.file.buffer,
        req.file.mimetype
      );

      logger.info('[Controller:transcribe] SUCCESS', { transcriptLength: transcript.length });
      sendSuccess(res, { transcript });
    } catch (error) {
      logger.error('[Controller:transcribe] Error:', {
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to transcribe audio', 500);
    }
  }

  /**
   * POST /api/coaches/extract-from-description
   * Extract coach attributes from text description
   */
  async extractFromDescription(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { description } = req.body;

      logger.info('[Controller:extract] Request received', {
        userId: req.userId,
        hasDescription: !!description,
        descriptionLength: description?.length,
        preview: typeof description === 'string' ? description.substring(0, 100) : undefined,
      });

      if (!description || typeof description !== 'string' || description.trim().length < 20) {
        logger.error('[Controller:extract] Invalid description');
        sendError(
          res,
          ErrorCodes.VALIDATION_ERROR,
          'Description must be at least 20 characters',
          400
        );
        return;
      }

      logger.info('[Controller:extract] Sending to AI extraction...');
      const extractedData = await aiExtractionService.extractCoachFromDescription(description);

      logger.info('[Controller:extract] SUCCESS', {
        name: extractedData.name,
        category: extractedData.category,
      });
      sendSuccess(res, extractedData);
    } catch (error) {
      logger.error('[Controller:extract] Error:', {
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to extract coach data', 500);
    }
  }

  /**
   * POST /api/coaches/quick-create
   * Full quick create flow: audio -> transcript -> extract -> preview data
   */
  async quickCreate(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      logger.info('[Controller:quickCreate] Request received', {
        userId: req.userId,
        hasFile: !!req.file,
        fileSize: req.file?.size,
        mimeType: req.file?.mimetype,
      });

      if (!req.file) {
        logger.error('[Controller:quickCreate] No audio file');
        sendError(res, ErrorCodes.VALIDATION_ERROR, 'No audio file provided', 400);
        return;
      }

      // Step 1: Transcribe audio
      logger.info('[Controller:quickCreate] Step 1: Transcribing...');
      const transcript = await transcriptionService.transcribeAudio(
        req.file.buffer,
        req.file.mimetype
      );
      logger.info('[Controller:quickCreate] Transcription done', {
        transcriptLength: transcript.length,
      });

      // Step 2: Extract coach attributes
      logger.info('[Controller:quickCreate] Step 2: Extracting...');
      const extractedData = await aiExtractionService.extractCoachFromDescription(transcript);
      logger.info('[Controller:quickCreate] Extraction done', {
        name: extractedData.name,
        category: extractedData.category,
      });

      sendSuccess(res, {
        transcript,
        ...extractedData,
      });
    } catch (error) {
      logger.error('[Controller:quickCreate] Error:', {
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to create coach from voice', 500);
    }
  }
}

export const coachController = new CoachController();
