/**
 * Social Authentication Controllers
 */

import type { Request, Response } from 'express';
import { verifyGoogleToken } from '../services/googleAuthService';
import { verifyAppleToken } from '../services/appleAuthService';
import { sendSuccess, sendError, ErrorCodes } from '../utils/response';
import { logger } from '../config/logger';

/**
 * POST /api/auth/social/google
 */
export async function googleAuthController(req: Request, res: Response): Promise<void> {
  try {
    const { token } = req.body;

    if (!token) {
      sendError(res, ErrorCodes.VALIDATION_ERROR, 'Token is required', 400);
      return;
    }

    const googleUserInfo = await verifyGoogleToken(token);

    // TODO: Find or create user in database
    // For now, return mock response
    const mockUser = {
      id: 'mock-user-id',
      email: googleUserInfo.email,
      firstName: googleUserInfo.firstName,
      lastName: googleUserInfo.lastName,
      picture: googleUserInfo.picture,
    };

    const mockTokens = {
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
    };

    sendSuccess(res, { user: mockUser, tokens: mockTokens });
  } catch (error) {
    logger.error('Google auth error:', error);
    sendError(res, ErrorCodes.INTERNAL_ERROR, 'Google authentication failed', 500);
  }
}

/**
 * POST /api/auth/social/apple
 */
export async function appleAuthController(req: Request, res: Response): Promise<void> {
  try {
    const { identityToken } = req.body;

    if (!identityToken) {
      sendError(res, ErrorCodes.VALIDATION_ERROR, 'Identity token is required', 400);
      return;
    }

    const appleUserInfo = await verifyAppleToken(identityToken);

    // TODO: Find or create user in database
    // For now, return mock response
    const mockUser = {
      id: 'mock-user-id',
      email: appleUserInfo.email,
    };

    const mockTokens = {
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
    };

    sendSuccess(res, { user: mockUser, tokens: mockTokens });
  } catch (error) {
    logger.error('Apple auth error:', error);
    sendError(res, ErrorCodes.INTERNAL_ERROR, 'Apple authentication failed', 500);
  }
}
