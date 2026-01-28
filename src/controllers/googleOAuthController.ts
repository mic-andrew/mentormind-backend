/**
 * Google OAuth Controllers (Server-driven flow)
 */

import type { Request, Response } from 'express';
import { generateGoogleAuthUrl, handleGoogleCallback, exchangeSessionId } from '../services/googleAuthService';
import { authService } from '../services/auth.service';
import { sendSuccess, sendError, ErrorCodes } from '../utils/response';
import { logger } from '../config/logger';

/**
 * GET /api/auth/google
 * Initiates Google OAuth flow by redirecting to Google
 */
export async function initiateGoogleAuth(req: Request, res: Response): Promise<void> {
  try {
    const { redirectUri, platform, platform_type } = req.query;

    if (!redirectUri || typeof redirectUri !== 'string') {
      sendError(res, ErrorCodes.VALIDATION_ERROR, 'redirectUri is required', 400);
      return;
    }

    // Generate Google OAuth URL
    const authUrl = generateGoogleAuthUrl(
      redirectUri,
      platform as string || platform_type as string
    );

    // Redirect to Google OAuth
    res.redirect(authUrl);
  } catch (error) {
    logger.error('Google OAuth initiation error:', error);
    sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to initiate Google authentication', 500);
  }
}

/**
 * GET /api/auth/google/callback
 * Handles Google OAuth callback after user authorizes
 */
export async function googleCallbackHandler(req: Request, res: Response): Promise<void> {
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

    // Handle callback - exchanges code for tokens, creates temp session
    const { sessionId, redirectUri } = await handleGoogleCallback(code, state);

    // Redirect back to mobile app with sessionId
    const redirectUrl = `${redirectUri}?sessionId=${sessionId}`;
    res.redirect(redirectUrl);
  } catch (error) {
    logger.error('Google OAuth callback error:', error);
    // In case of error, redirect to mobile with error
    res.redirect(`mentormind://auth/google?error=authentication_failed`);
  }
}

/**
 * POST /api/auth/exchange-session
 * Exchanges sessionId for access/refresh tokens
 */
export async function exchangeSessionHandler(req: Request, res: Response): Promise<void> {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      sendError(res, ErrorCodes.VALIDATION_ERROR, 'sessionId is required', 400);
      return;
    }

    // Exchange sessionId for user
    const user = await exchangeSessionId(sessionId);

    // Create auth session (access + refresh tokens)
    const session = await authService.createSession(user);

    sendSuccess(res, session);
  } catch (error) {
    logger.error('Session exchange error:', error);
    if (error instanceof Error && error.message === 'Invalid or expired session') {
      sendError(res, ErrorCodes.INVALID_CREDENTIALS, 'Invalid or expired session', 401);
    } else {
      sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to exchange session', 500);
    }
  }
}
