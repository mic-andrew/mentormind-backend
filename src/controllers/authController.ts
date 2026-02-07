/**
 * Authentication controller
 */

import type { Request, Response } from 'express';
import { authService } from '../services/authService';
import { sendSuccess, sendError, ErrorCodes } from '../utils/response';
import type { AuthenticatedRequest } from '../middleware/auth';
import { logger } from '../config/logger';

export class AuthController {
  /**
   * POST /api/auth/anonymous
   */
  async createAnonymousUser(req: Request, res: Response): Promise<void> {
    try {
      const { deviceId } = req.body;
      if (!deviceId || typeof deviceId !== 'string') {
        sendError(res, ErrorCodes.VALIDATION_ERROR, 'Device ID is required', 400);
        return;
      }
      const result = await authService.createAnonymousUser(deviceId);
      sendSuccess(res, result, 201);
    } catch (error) {
      logger.error('Anonymous user creation error:', error);
      sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to create anonymous user', 500);
    }
  }

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
      if (error instanceof Error && error.message === 'INVALID_ANONYMOUS_USER') {
        sendError(res, ErrorCodes.VALIDATION_ERROR, 'Invalid anonymous user', 400);
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
      if (error instanceof Error && error.message === 'EMAIL_NOT_VERIFIED') {
        sendError(res, ErrorCodes.EMAIL_NOT_VERIFIED, 'Please verify your email first', 403);
        return;
      }
      logger.error('Login error:', error);
      sendError(res, ErrorCodes.INTERNAL_ERROR, 'Login failed', 500);
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
      if (error instanceof Error && error.message.startsWith('OTP_COOLDOWN:')) {
        const retryAfter = parseInt(error.message.split(':')[1], 10);
        res.status(429).json({
          success: false,
          error: {
            code: ErrorCodes.OTP_COOLDOWN,
            message: 'Please wait before requesting a new code',
            retryAfter,
          },
        });
        return;
      }
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
   * PATCH /api/auth/profile
   */
  async updateProfile(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req as AuthenticatedRequest;
      const { firstName, lastName } = req.body;
      const user = await authService.updateUser(userId, { firstName, lastName });
      sendSuccess(res, user);
    } catch (error) {
      if (error instanceof Error && error.message === 'NOT_FOUND') {
        sendError(res, ErrorCodes.NOT_FOUND, 'User not found', 404);
        return;
      }
      logger.error('Update profile error:', error);
      sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to update profile', 500);
    }
  }

  /**
   * PATCH /api/auth/password
   */
  async updatePassword(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req as AuthenticatedRequest;
      const { currentPassword, newPassword } = req.body;
      const result = await authService.updatePassword(userId, currentPassword, newPassword);
      sendSuccess(res, result);
    } catch (error) {
      if (error instanceof Error && error.message === 'NOT_FOUND') {
        sendError(res, ErrorCodes.NOT_FOUND, 'User not found', 404);
        return;
      }
      if (error instanceof Error && error.message === 'CURRENT_PASSWORD_REQUIRED') {
        sendError(res, ErrorCodes.VALIDATION_ERROR, 'Current password is required', 400);
        return;
      }
      if (error instanceof Error && error.message === 'INVALID_PASSWORD') {
        sendError(res, ErrorCodes.INVALID_CREDENTIALS, 'Current password is incorrect', 401);
        return;
      }
      logger.error('Update password error:', error);
      sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to update password', 500);
    }
  }

  /**
   * POST /api/auth/schedule-deletion
   */
  async scheduleAccountDeletion(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req as AuthenticatedRequest;
      const result = await authService.scheduleAccountDeletion(userId);
      sendSuccess(res, result);
    } catch (error) {
      if (error instanceof Error && error.message === 'NOT_FOUND') {
        sendError(res, ErrorCodes.NOT_FOUND, 'User not found', 404);
        return;
      }
      if (error instanceof Error && error.message === 'ALREADY_DELETED') {
        sendError(
          res,
          ErrorCodes.VALIDATION_ERROR,
          'Account is already scheduled for deletion',
          400
        );
        return;
      }
      logger.error('Schedule deletion error:', error);
      sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to schedule account deletion', 500);
    }
  }

  /**
   * POST /api/auth/cancel-deletion
   */
  async cancelAccountDeletion(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req as AuthenticatedRequest;
      const result = await authService.cancelAccountDeletion(userId);
      sendSuccess(res, result);
    } catch (error) {
      if (error instanceof Error && error.message === 'NOT_FOUND') {
        sendError(res, ErrorCodes.NOT_FOUND, 'User not found', 404);
        return;
      }
      if (error instanceof Error && error.message === 'NO_DELETION_SCHEDULED') {
        sendError(res, ErrorCodes.VALIDATION_ERROR, 'No deletion is scheduled', 400);
        return;
      }
      logger.error('Cancel deletion error:', error);
      sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to cancel account deletion', 500);
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

  /**
   * GET /api/auth/google
   * Initiates Google OAuth flow
   */
  async initiateGoogleAuth(req: Request, res: Response): Promise<void> {
    try {
      const { redirectUri, platform, platform_type } = req.query;

      if (!redirectUri || typeof redirectUri !== 'string') {
        sendError(res, ErrorCodes.VALIDATION_ERROR, 'redirectUri is required', 400);
        return;
      }

      const authUrl = authService.generateGoogleAuthUrl(
        redirectUri,
        (platform as string) || (platform_type as string)
      );

      res.redirect(authUrl);
    } catch (error) {
      logger.error('Google OAuth initiation error:', error);
      sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to initiate Google authentication', 500);
    }
  }

  /**
   * GET /api/auth/google/callback
   * Handles Google OAuth callback
   */
  async googleCallback(req: Request, res: Response): Promise<void> {
    try {
      const { code, state } = req.query;

      if (!code || typeof code !== 'string') {
        sendError(res, ErrorCodes.VALIDATION_ERROR, 'Authorization code is required', 400);
        return;
      }

      if (!state || typeof state !== 'string') {
        sendError(res, ErrorCodes.VALIDATION_ERROR, 'State parameter is required', 400);
        return;
      }

      const { sessionId, redirectUri } = await authService.handleGoogleCallback(code, state);

      // Redirect back to mobile app with sessionId
      const redirectUrl = `${redirectUri}?sessionId=${sessionId}`;
      res.redirect(redirectUrl);
    } catch (error) {
      logger.error('Google OAuth callback error:', error);
      res.redirect(`mentormind://auth/google?error=authentication_failed`);
    }
  }

  /**
   * POST /api/auth/exchange-session
   * Exchanges sessionId for tokens
   */
  async exchangeSession(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.body;

      if (!sessionId) {
        sendError(res, ErrorCodes.VALIDATION_ERROR, 'sessionId is required', 400);
        return;
      }

      const result = await authService.exchangeSessionId(sessionId);
      sendSuccess(res, result);
    } catch (error) {
      if (error instanceof Error && error.message === 'INVALID_SESSION') {
        sendError(res, ErrorCodes.INVALID_CREDENTIALS, 'Invalid or expired session', 401);
        return;
      }
      if (error instanceof Error && error.message === 'USER_NOT_FOUND') {
        sendError(res, ErrorCodes.NOT_FOUND, 'User not found', 404);
        return;
      }
      logger.error('Session exchange error:', error);
      sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to exchange session', 500);
    }
  }

  /**
   * POST /api/auth/apple
   * Apple Sign In authentication
   */
  async appleAuth(req: Request, res: Response): Promise<void> {
    try {
      const { token, identityToken, fullName, anonymousUserId } = req.body;
      const appleToken = token || identityToken;

      if (!appleToken) {
        sendError(res, ErrorCodes.VALIDATION_ERROR, 'Identity token is required', 400);
        return;
      }

      const result = await authService.handleAppleAuth(appleToken, fullName, anonymousUserId);
      sendSuccess(res, result);
    } catch (error) {
      if (error instanceof Error && error.message === 'APPLE_AUTH_FAILED') {
        sendError(res, ErrorCodes.INVALID_CREDENTIALS, 'Apple authentication failed', 401);
        return;
      }
      logger.error('Apple auth error:', error);
      sendError(res, ErrorCodes.INTERNAL_ERROR, 'Apple authentication failed', 500);
    }
  }
}

export const authController = new AuthController();
