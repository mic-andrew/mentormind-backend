/**
 * Module Controller
 * Handles HTTP requests for AI-powered module generation and daily step interactions
 */

import type { Request, Response } from 'express';
import { moduleService } from '../services/moduleService';
import { sendSuccess, sendError, ErrorCodes } from '../utils/response';
import { logger } from '../config/logger';
import type { AuthenticatedRequest } from '../middleware/auth';

class ModuleController {
  /**
   * Generate personalized modules from user context
   * POST /api/modules/generate
   */
  async generateModules(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req as AuthenticatedRequest;
      const result = await moduleService.generateModules(userId);
      sendSuccess(res, { modules: result }, 201);
    } catch (error) {
      if (error instanceof Error) {
        switch (error.message) {
          case 'USER_NOT_FOUND':
            sendError(res, ErrorCodes.NOT_FOUND, 'User not found', 404);
            return;
          case 'NO_PERSONAL_CONTEXT':
            sendError(res, ErrorCodes.VALIDATION_ERROR, 'Personal context is required to generate modules', 400);
            return;
          case 'OPENAI_API_ERROR':
            sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to generate modules', 503);
            return;
        }
      }
      logger.error('Generate modules error:', error);
      sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to generate modules', 500);
    }
  }

  /**
   * Get user's generated modules
   * GET /api/modules
   */
  async getModules(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req as AuthenticatedRequest;
      const modules = await moduleService.getModules(userId);
      sendSuccess(res, { modules });
    } catch (error) {
      logger.error('Get modules error:', error);
      sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to get modules', 500);
    }
  }

  /**
   * Enroll in a module
   * POST /api/modules/:moduleId/enroll
   */
  async enroll(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req as AuthenticatedRequest;
      const { moduleId } = req.params;

      if (!moduleId) {
        sendError(res, ErrorCodes.VALIDATION_ERROR, 'Module ID is required', 400);
        return;
      }

      const enrollment = await moduleService.enrollInModule(userId, moduleId);
      sendSuccess(res, enrollment, 201);
    } catch (error) {
      if (error instanceof Error) {
        switch (error.message) {
          case 'INVALID_MODULE_ID':
            sendError(res, ErrorCodes.VALIDATION_ERROR, 'Invalid module ID', 400);
            return;
          case 'MODULE_NOT_FOUND':
            sendError(res, ErrorCodes.NOT_FOUND, 'Module not found', 404);
            return;
        }
      }
      logger.error('Enroll error:', error);
      sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to enroll in module', 500);
    }
  }

  /**
   * Get enrollment for a module
   * GET /api/modules/:moduleId/enrollment
   */
  async getEnrollment(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req as AuthenticatedRequest;
      const { moduleId } = req.params;

      const enrollment = await moduleService.getEnrollment(userId, moduleId);
      if (!enrollment) {
        sendError(res, ErrorCodes.NOT_FOUND, 'Enrollment not found', 404);
        return;
      }

      sendSuccess(res, enrollment);
    } catch (error) {
      logger.error('Get enrollment error:', error);
      sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to get enrollment', 500);
    }
  }

  /**
   * Get all active enrollments
   * GET /api/modules/enrollments
   */
  async getActiveEnrollments(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req as AuthenticatedRequest;
      const enrollments = await moduleService.getActiveEnrollments(userId);
      sendSuccess(res, { enrollments });
    } catch (error) {
      logger.error('Get enrollments error:', error);
      sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to get enrollments', 500);
    }
  }

  /**
   * Generate Frame content for a day
   * POST /api/modules/:moduleId/days/:dayNumber/frame
   */
  async generateFrame(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req as AuthenticatedRequest;
      const { moduleId, dayNumber } = req.params;

      const result = await moduleService.generateFrame(userId, moduleId, parseInt(dayNumber, 10));
      sendSuccess(res, result);
    } catch (error) {
      if (error instanceof Error) {
        switch (error.message) {
          case 'MODULE_NOT_FOUND':
            sendError(res, ErrorCodes.NOT_FOUND, 'Module not found', 404);
            return;
          case 'DAY_NOT_FOUND':
            sendError(res, ErrorCodes.NOT_FOUND, 'Day not found', 404);
            return;
          case 'OPENAI_API_ERROR':
            sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to generate frame content', 503);
            return;
        }
      }
      logger.error('Generate frame error:', error);
      sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to generate frame content', 500);
    }
  }

  /**
   * Start a voice reflection session
   * POST /api/modules/:moduleId/days/:dayNumber/reflect
   */
  async startReflect(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req as AuthenticatedRequest;
      const { moduleId, dayNumber } = req.params;

      const result = await moduleService.startReflectSession(
        userId,
        moduleId,
        parseInt(dayNumber, 10)
      );
      sendSuccess(res, result, 201);
    } catch (error) {
      if (error instanceof Error) {
        switch (error.message) {
          case 'MODULE_NOT_FOUND':
            sendError(res, ErrorCodes.NOT_FOUND, 'Module not found', 404);
            return;
          case 'DAY_NOT_FOUND':
            sendError(res, ErrorCodes.NOT_FOUND, 'Day not found', 404);
            return;
          case 'OPENAI_API_ERROR':
            sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to start reflection session', 503);
            return;
        }
      }
      logger.error('Start reflect error:', error);
      sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to start reflection session', 500);
    }
  }

  /**
   * Complete a voice reflection — extract summary from transcript
   * POST /api/modules/:moduleId/days/:dayNumber/reflect/complete
   */
  async completeReflection(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req as AuthenticatedRequest;
      const { moduleId, dayNumber } = req.params;
      const { sessionId } = req.body;

      if (!sessionId) {
        sendError(res, ErrorCodes.VALIDATION_ERROR, 'Session ID is required', 400);
        return;
      }

      const result = await moduleService.completeReflection(
        userId,
        moduleId,
        parseInt(dayNumber, 10),
        sessionId
      );
      sendSuccess(res, result);
    } catch (error) {
      if (error instanceof Error) {
        switch (error.message) {
          case 'INVALID_SESSION_ID':
            sendError(res, ErrorCodes.VALIDATION_ERROR, 'Invalid session ID', 400);
            return;
          case 'MODULE_NOT_FOUND':
            sendError(res, ErrorCodes.NOT_FOUND, 'Module not found', 404);
            return;
          case 'DAY_NOT_FOUND':
            sendError(res, ErrorCodes.NOT_FOUND, 'Day not found', 404);
            return;
        }
      }
      logger.error('Complete reflection error:', error);
      sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to complete reflection', 500);
    }
  }

  /**
   * Generate Shift (micro-action) content for a day
   * POST /api/modules/:moduleId/days/:dayNumber/shift
   */
  async generateShift(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req as AuthenticatedRequest;
      const { moduleId, dayNumber } = req.params;

      const result = await moduleService.generateShift(userId, moduleId, parseInt(dayNumber, 10));
      sendSuccess(res, result);
    } catch (error) {
      if (error instanceof Error) {
        switch (error.message) {
          case 'MODULE_NOT_FOUND':
            sendError(res, ErrorCodes.NOT_FOUND, 'Module not found', 404);
            return;
          case 'DAY_NOT_FOUND':
            sendError(res, ErrorCodes.NOT_FOUND, 'Day not found', 404);
            return;
          case 'OPENAI_API_ERROR':
            sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to generate shift content', 503);
            return;
        }
      }
      logger.error('Generate shift error:', error);
      sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to generate shift content', 500);
    }
  }

  /**
   * Mark a day as complete
   * POST /api/modules/:moduleId/days/:dayNumber/complete
   */
  async completeDay(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req as AuthenticatedRequest;
      const { moduleId, dayNumber } = req.params;
      const { shiftAction } = req.body;

      const result = await moduleService.completeDay(
        userId,
        moduleId,
        parseInt(dayNumber, 10),
        shiftAction
      );
      sendSuccess(res, result);
    } catch (error) {
      if (error instanceof Error) {
        switch (error.message) {
          case 'ENROLLMENT_NOT_FOUND':
            sendError(res, ErrorCodes.NOT_FOUND, 'Enrollment not found', 404);
            return;
          case 'MODULE_NOT_FOUND':
            sendError(res, ErrorCodes.NOT_FOUND, 'Module not found', 404);
            return;
        }
      }
      logger.error('Complete day error:', error);
      sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to complete day', 500);
    }
  }
}

export const moduleController = new ModuleController();
