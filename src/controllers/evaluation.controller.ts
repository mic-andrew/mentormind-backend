/**
 * Evaluation Controller
 * Handles HTTP requests for session evaluations
 */

import type { Request, Response } from 'express';
import { evaluationService } from '../services/evaluation.service';
import { sendSuccess, sendError, ErrorCodes } from '../utils/response';
import { logger } from '../config/logger';
import type { AuthenticatedRequest } from '../middleware/auth';

class EvaluationController {
  /**
   * Generate evaluation for a session
   * POST /api/sessions/:id/evaluation
   */
  async generateEvaluation(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req as AuthenticatedRequest;
      const { id: sessionId } = req.params;

      const result = await evaluationService.generateEvaluation(sessionId, userId);
      sendSuccess(res, result, 201);
    } catch (error) {
      if (error instanceof Error) {
        switch (error.message) {
          case 'INVALID_SESSION_ID':
            sendError(res, ErrorCodes.VALIDATION_ERROR, 'Invalid session ID', 400);
            return;
          case 'SESSION_NOT_FOUND':
            sendError(res, ErrorCodes.NOT_FOUND, 'Session not found', 404);
            return;
          case 'SESSION_NOT_ENDED':
            sendError(res, ErrorCodes.VALIDATION_ERROR, 'Session has not ended yet', 400);
            return;
          case 'EVALUATION_EXISTS':
            sendError(res, ErrorCodes.CONFLICT, 'Evaluation already exists for this session', 409);
            return;
          case 'TRANSCRIPT_EMPTY':
            sendError(res, ErrorCodes.VALIDATION_ERROR, 'Session transcript is empty', 400);
            return;
          case 'OPENAI_API_ERROR':
            sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to generate evaluation', 503);
            return;
        }
      }
      logger.error('Generate evaluation error:', error);
      sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to generate evaluation', 500);
    }
  }

  /**
   * Get evaluation for a session
   * GET /api/sessions/:id/evaluation
   */
  async getEvaluation(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req as AuthenticatedRequest;
      const { id: sessionId } = req.params;

      const result = await evaluationService.getEvaluation(sessionId, userId);
      sendSuccess(res, result);
    } catch (error) {
      if (error instanceof Error) {
        switch (error.message) {
          case 'INVALID_SESSION_ID':
            sendError(res, ErrorCodes.VALIDATION_ERROR, 'Invalid session ID', 400);
            return;
          case 'SESSION_NOT_FOUND':
            sendError(res, ErrorCodes.NOT_FOUND, 'Session not found', 404);
            return;
          case 'EVALUATION_NOT_FOUND':
            sendError(res, ErrorCodes.NOT_FOUND, 'Evaluation not found', 404);
            return;
        }
      }
      logger.error('Get evaluation error:', error);
      sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to get evaluation', 500);
    }
  }

  /**
   * Retry a failed evaluation
   * POST /api/sessions/:id/evaluation/retry
   */
  async retryEvaluation(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req as AuthenticatedRequest;
      const { id: sessionId } = req.params;

      const result = await evaluationService.retryEvaluation(sessionId, userId);
      sendSuccess(res, result);
    } catch (error) {
      if (error instanceof Error) {
        switch (error.message) {
          case 'INVALID_SESSION_ID':
            sendError(res, ErrorCodes.VALIDATION_ERROR, 'Invalid session ID', 400);
            return;
          case 'SESSION_NOT_FOUND':
            sendError(res, ErrorCodes.NOT_FOUND, 'Session not found', 404);
            return;
          case 'EVALUATION_NOT_FOUND':
            sendError(res, ErrorCodes.NOT_FOUND, 'Evaluation not found', 404);
            return;
          case 'EVALUATION_NOT_FAILED':
            sendError(res, ErrorCodes.VALIDATION_ERROR, 'Evaluation is not in failed state', 400);
            return;
          case 'OPENAI_API_ERROR':
            sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to regenerate evaluation', 503);
            return;
        }
      }
      logger.error('Retry evaluation error:', error);
      sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to retry evaluation', 500);
    }
  }
}

export const evaluationController = new EvaluationController();
