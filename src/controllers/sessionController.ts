/**
 * Session Controller
 * Handles HTTP requests for voice coaching sessions
 */

import type { Request, Response } from 'express';
import { sessionService } from '../services/sessionService';
import { sendSuccess, sendError, ErrorCodes } from '../utils/response';
import { logger } from '../config/logger';
import type { AuthenticatedRequest } from '../middleware/auth';

class SessionController {
  /**
   * Start a new voice session
   * POST /api/sessions/start
   */
  async startSession(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req as AuthenticatedRequest;
      const { coachId, type } = req.body;
      logger.info(`[API] POST /sessions/start user=${userId} coach=${coachId} type=${type || 'regular'}`);

      if (!coachId) {
        sendError(res, ErrorCodes.VALIDATION_ERROR, 'Coach ID is required', 400);
        return;
      }

      const result = await sessionService.startSession(userId, { coachId, type });
      logger.info(`[API] start-session success session=${result.sessionId}`);
      sendSuccess(res, result, 201);
    } catch (error) {
      if (error instanceof Error) {
        switch (error.message) {
          case 'INVALID_COACH_ID':
            sendError(res, ErrorCodes.VALIDATION_ERROR, 'Invalid coach ID', 400);
            return;
          case 'COACH_NOT_FOUND':
            sendError(res, ErrorCodes.NOT_FOUND, 'Coach not found', 404);
            return;
          case 'USER_NOT_FOUND':
            sendError(res, ErrorCodes.NOT_FOUND, 'User not found', 404);
            return;
          case 'OPENAI_API_ERROR':
            sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to initialize voice session', 503);
            return;
          case 'SESSION_LIMIT_EXCEEDED':
            sendError(res, ErrorCodes.FORBIDDEN, 'Free session limit reached. Upgrade to continue.', 403);
            return;
        }
      }
      logger.error('Start session error:', error);
      sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to start session', 500);
    }
  }

  /**
   * Proxy SDP exchange with OpenAI
   * POST /api/sessions/sdp-exchange
   */
  async sdpExchange(req: Request, res: Response): Promise<void> {
    try {
      const { sdp, token } = req.body;
      logger.info(`[API] POST /sessions/sdp-exchange sdpLen=${sdp?.length || 0} hasToken=${!!token}`);

      if (!sdp || typeof sdp !== 'string') {
        sendError(res, ErrorCodes.VALIDATION_ERROR, 'SDP offer is required', 400);
        return;
      }

      if (!token || typeof token !== 'string') {
        sendError(res, ErrorCodes.VALIDATION_ERROR, 'Ephemeral token is required', 400);
        return;
      }

      const answerSdp = await sessionService.sdpExchange(sdp, token);
      logger.info(`[API] sdp-exchange success answerLen=${answerSdp?.length || 0}`);
      sendSuccess(res, { sdp: answerSdp });
    } catch (error) {
      if (error instanceof Error && error.message === 'SDP_EXCHANGE_FAILED') {
        sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to exchange SDP with OpenAI', 502);
        return;
      }
      logger.error('SDP exchange error:', error);
      sendError(res, ErrorCodes.INTERNAL_ERROR, 'SDP exchange failed', 500);
    }
  }

  /**
   * Resume an existing session (get new token)
   * POST /api/sessions/:id/resume
   */
  async resumeSession(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req as AuthenticatedRequest;
      const { id: sessionId } = req.params;
      logger.info(`[API] POST /sessions/${sessionId}/resume user=${userId}`);

      const result = await sessionService.resumeSession(sessionId, userId);
      logger.info(`[API] resume-session success session=${sessionId}`);
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
          case 'COACH_NOT_FOUND':
            sendError(res, ErrorCodes.NOT_FOUND, 'Coach not found', 404);
            return;
          case 'OPENAI_API_ERROR':
            sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to resume voice session', 503);
            return;
        }
      }
      logger.error('Resume session error:', error);
      sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to resume session', 500);
    }
  }

  /**
   * Update/append transcript utterances
   * PUT /api/sessions/:id/transcript
   */
  async saveTranscript(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req as AuthenticatedRequest;
      const { id: sessionId } = req.params;
      const { speakers, utterances } = req.body;
      logger.info(`[API] PUT /sessions/${sessionId}/transcript user=${userId} utterances=${utterances?.length || 0}`);

      if (!utterances || !Array.isArray(utterances)) {
        sendError(res, ErrorCodes.VALIDATION_ERROR, 'Utterances array is required', 400);
        return;
      }

      const result = await sessionService.saveTranscript(sessionId, userId, {
        speakers: speakers || [],
        utterances,
      });
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
        }
      }
      logger.error('Save transcript error:', error);
      sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to save transcript', 500);
    }
  }

  /**
   * End a voice session
   * POST /api/sessions/:id/end
   */
  async endSession(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req as AuthenticatedRequest;
      const { id: sessionId } = req.params;
      const { durationMs, finalUtterances, speakers } = req.body;
      logger.info(`[API] POST /sessions/${sessionId}/end user=${userId} durationMs=${durationMs} utterances=${finalUtterances?.length || 0}`);

      if (typeof durationMs !== 'number') {
        sendError(res, ErrorCodes.VALIDATION_ERROR, 'Duration is required', 400);
        return;
      }

      const result = await sessionService.endSession(sessionId, userId, {
        durationMs,
        finalUtterances,
        speakers,
      });
      logger.info(`[API] end-session success session=${sessionId}`);
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
        }
      }
      logger.error('End session error:', error);
      sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to end session', 500);
    }
  }

  /**
   * Pause a voice session
   * POST /api/sessions/:id/pause
   */
  async pauseSession(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req as AuthenticatedRequest;
      const { id: sessionId } = req.params;

      const result = await sessionService.pauseSession(sessionId, userId);
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
        }
      }
      logger.error('Pause session error:', error);
      sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to pause session', 500);
    }
  }

  /**
   * Get session by ID with transcript
   * GET /api/sessions/:id
   */
  async getSession(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req as AuthenticatedRequest;
      const { id: sessionId } = req.params;

      const result = await sessionService.getSession(sessionId, userId);
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
        }
      }
      logger.error('Get session error:', error);
      sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to get session', 500);
    }
  }

  /**
   * Get user's session history
   * GET /api/sessions/history
   */
  async getSessionHistory(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req as AuthenticatedRequest;
      const { coachId, status, page, limit } = req.query;

      const result = await sessionService.getSessionHistory(userId, {
        coachId: coachId as string,
        status: status as 'active' | 'paused' | 'ended' | 'error' | 'abandoned',
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? Math.min(parseInt(limit as string, 10), 50) : 20,
      });

      sendSuccess(res, result);
    } catch (error) {
      if (error instanceof Error && error.message === 'INVALID_USER_ID') {
        sendError(res, ErrorCodes.VALIDATION_ERROR, 'Invalid user ID', 400);
        return;
      }
      logger.error('Get session history error:', error);
      sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to get session history', 500);
    }
  }

  /**
   * Get active session (if any)
   * GET /api/sessions/active
   */
  async getActiveSession(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req as AuthenticatedRequest;

      const result = await sessionService.getActiveSession(userId);
      sendSuccess(res, { session: result });
    } catch (error) {
      if (error instanceof Error && error.message === 'INVALID_USER_ID') {
        sendError(res, ErrorCodes.VALIDATION_ERROR, 'Invalid user ID', 400);
        return;
      }
      logger.error('Get active session error:', error);
      sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to get active session', 500);
    }
  }

  /**
   * Update user context
   * PUT /api/sessions/context
   */
  async updateUserContext(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req as AuthenticatedRequest;
      const { personalContext } = req.body;

      const result = await sessionService.updateUserContext(userId, personalContext || '');

      sendSuccess(res, result);
    } catch (error) {
      if (error instanceof Error) {
        switch (error.message) {
          case 'INVALID_USER_ID':
            sendError(res, ErrorCodes.VALIDATION_ERROR, 'Invalid user ID', 400);
            return;
          case 'USER_NOT_FOUND':
            sendError(res, ErrorCodes.NOT_FOUND, 'User not found', 404);
            return;
        }
      }
      logger.error('Update user context error:', error);
      sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to update user context', 500);
    }
  }

  /**
   * Extract context from an interview session
   * POST /api/sessions/:id/extract-context
   */
  async extractContext(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req as AuthenticatedRequest;
      const { id: sessionId } = req.params;
      logger.info(`[API] POST /sessions/${sessionId}/extract-context user=${userId}`);

      const result = await sessionService.extractContextFromSession(sessionId, userId);
      logger.info(`[API] extract-context success for session=${sessionId}`);
      sendSuccess(res, result);
    } catch (error) {
      if (error instanceof Error) {
        logger.warn(`[API] extract-context failed: ${error.message} session=${req.params.id}`);
        switch (error.message) {
          case 'INVALID_SESSION_ID':
            sendError(res, ErrorCodes.VALIDATION_ERROR, 'Invalid session ID', 400);
            return;
          case 'SESSION_NOT_FOUND':
            sendError(res, ErrorCodes.NOT_FOUND, 'Session not found', 404);
            return;
          case 'TRANSCRIPT_EMPTY':
            sendError(res, ErrorCodes.VALIDATION_ERROR, 'Session has no transcript data', 400);
            return;
          case 'OPENAI_API_ERROR':
            sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to analyze conversation', 503);
            return;
        }
      }
      logger.error('Extract context error:', error);
      sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to extract context', 500);
    }
  }

  /**
   * Get user context
   * GET /api/sessions/context
   */
  async getUserContext(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req as AuthenticatedRequest;

      const result = await sessionService.getUserContext(userId);
      sendSuccess(res, result);
    } catch (error) {
      if (error instanceof Error) {
        switch (error.message) {
          case 'INVALID_USER_ID':
            sendError(res, ErrorCodes.VALIDATION_ERROR, 'Invalid user ID', 400);
            return;
          case 'USER_NOT_FOUND':
            sendError(res, ErrorCodes.NOT_FOUND, 'User not found', 404);
            return;
        }
      }
      logger.error('Get user context error:', error);
      sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to get user context', 500);
    }
  }
}

export const sessionController = new SessionController();
