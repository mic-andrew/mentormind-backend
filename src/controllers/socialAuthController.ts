/**
 * Social Authentication Controllers (Apple only - Google uses server-driven OAuth)
 */

import type { Request, Response } from 'express';
import { verifyAppleToken, findOrCreateAppleUser } from '../services/appleAuthService';
import { authService } from '../services/auth.service';
import { sendSuccess, sendError, ErrorCodes } from '../utils/response';
import { logger } from '../config/logger';

/**
 * POST /api/auth/social/apple
 * Authenticate with Apple ID token (client-driven)
 */
export async function appleAuthController(req: Request, res: Response): Promise<void> {
  try {
    const { token, identityToken, fullName } = req.body;
    const appleToken = token || identityToken;

    if (!appleToken) {
      sendError(res, ErrorCodes.VALIDATION_ERROR, 'Identity token is required', 400);
      return;
    }

    await handleAppleAuth(appleToken, fullName, res);
  } catch (error) {
    logger.error('Apple auth error:', error);
    sendError(res, ErrorCodes.INTERNAL_ERROR, 'Apple authentication failed', 500);
  }
}

async function handleAppleAuth(
  token: string,
  fullName: { firstName?: string; lastName?: string } | undefined,
  res: Response
): Promise<void> {
  const appleUserInfo = await verifyAppleToken(token);
  const user = await findOrCreateAppleUser(appleUserInfo, fullName);
  const session = await authService.createSession(user);
  sendSuccess(res, session);
}
