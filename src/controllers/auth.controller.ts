/**
 * Authentication controller
 */

import type { Request, Response } from 'express';
import { authService } from '../services/auth.service.js';
import { sendSuccess, sendError, ErrorCodes } from '../utils/response.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { logger } from '../config/logger.js';

export class AuthController {
  /**
   * POST /api/auth/register
   */
  async register(req: Request, res: Response): Promise<void> {
    try {
      const result = await authService.register(req.body);
      sendSuccess(res, result, 201);
    } catch (error) {
      if (error instanceof Error && error.message === 'USER_EXISTS') {
        sendError(res, ErrorCodes.USER_EXISTS, 'An account with this email already exists', 409);
        return;
      }
      logger.error('Register error:', error);
      sendError(res, ErrorCodes.INTERNAL_ERROR, 'Registration failed', 500);
    }
  }

  /**
   * POST /api/auth/login
   */
  async login(req: Request, res: Response): Promise<void> {
    try {
      const result = await authService.login(req.body);
      sendSuccess(res, result);
    } catch (error) {
      if (error instanceof Error && error.message === 'INVALID_CREDENTIALS') {
        sendError(res, ErrorCodes.INVALID_CREDENTIALS, 'Invalid email or password', 401);
        return;
      }
      logger.error('Login error:', error);
      sendError(res, ErrorCodes.INTERNAL_ERROR, 'Login failed', 500);
    }
  }

  /**
   * POST /api/auth/social
   */
  async socialAuth(req: Request, res: Response): Promise<void> {
    try {
      // In production, you'd validate the social token here
      // For now, we'll accept the data directly
      const result = await authService.socialAuth(req.body);
      sendSuccess(res, result);
    } catch (error) {
      logger.error('Social auth error:', error);
      sendError(res, ErrorCodes.INTERNAL_ERROR, 'Social authentication failed', 500);
    }
  }

  /**
   * POST /api/auth/forgot-password
   */
  async forgotPassword(req: Request, res: Response): Promise<void> {
    try {
      const result = await authService.forgotPassword(req.body.email);
      sendSuccess(res, result);
    } catch (error) {
      logger.error('Forgot password error:', error);
      sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to process request', 500);
    }
  }

  /**
   * POST /api/auth/verify-otp
   */
  async verifyOTP(req: Request, res: Response): Promise<void> {
    try {
      const { email, otp } = req.body;
      const result = await authService.verifyOTP(email, otp);
      sendSuccess(res, result);
    } catch (error) {
      if (error instanceof Error && error.message === 'INVALID_OTP') {
        sendError(res, ErrorCodes.INVALID_OTP, 'Invalid or expired verification code', 400);
        return;
      }
      logger.error('Verify OTP error:', error);
      sendError(res, ErrorCodes.INTERNAL_ERROR, 'Verification failed', 500);
    }
  }

  /**
   * POST /api/auth/resend-otp
   */
  async resendOTP(req: Request, res: Response): Promise<void> {
    try {
      const result = await authService.resendOTP(req.body.email);
      sendSuccess(res, result);
    } catch (error) {
      logger.error('Resend OTP error:', error);
      sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to resend code', 500);
    }
  }

  /**
   * POST /api/auth/reset-password
   */
  async resetPassword(req: Request, res: Response): Promise<void> {
    try {
      const { resetToken, newPassword } = req.body;
      const result = await authService.resetPassword(resetToken, newPassword);
      sendSuccess(res, result);
    } catch (error) {
      if (error instanceof Error && error.message === 'INVALID_RESET_TOKEN') {
        sendError(res, ErrorCodes.INVALID_TOKEN, 'Invalid or expired reset token', 400);
        return;
      }
      if (error instanceof Error && error.message === 'USER_NOT_FOUND') {
        sendError(res, ErrorCodes.NOT_FOUND, 'User not found', 404);
        return;
      }
      logger.error('Reset password error:', error);
      sendError(res, ErrorCodes.INTERNAL_ERROR, 'Password reset failed', 500);
    }
  }

  /**
   * POST /api/auth/refresh
   */
  async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body;
      const tokens = await authService.refreshToken(refreshToken);
      sendSuccess(res, { tokens });
    } catch (error) {
      if (error instanceof Error && error.message === 'INVALID_TOKEN') {
        sendError(res, ErrorCodes.UNAUTHORIZED, 'Invalid or expired refresh token', 401);
        return;
      }
      logger.error('Refresh token error:', error);
      sendError(res, ErrorCodes.INTERNAL_ERROR, 'Token refresh failed', 500);
    }
  }

  /**
   * GET /api/auth/me
   */
  async getCurrentUser(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req as AuthenticatedRequest;
      const user = await authService.getCurrentUser(userId);
      sendSuccess(res, user);
    } catch (error) {
      if (error instanceof Error && error.message === 'NOT_FOUND') {
        sendError(res, ErrorCodes.NOT_FOUND, 'User not found', 404);
        return;
      }
      logger.error('Get current user error:', error);
      sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to get user', 500);
    }
  }

  /**
   * POST /api/auth/logout
   */
  async logout(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req as AuthenticatedRequest;
      const result = await authService.logout(userId);
      sendSuccess(res, result);
    } catch (error) {
      logger.error('Logout error:', error);
      sendError(res, ErrorCodes.INTERNAL_ERROR, 'Logout failed', 500);
    }
  }
}

export const authController = new AuthController();
