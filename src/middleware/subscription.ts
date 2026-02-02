/**
 * Subscription middleware
 * Checks free tier limits before allowing coach creation or session start
 */

import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from './auth';
import { subscriptionService } from '../services/subscriptionService';
import { sendError, ErrorCodes } from '../utils/response';

/**
 * Middleware to check if user can create a new coach
 */
export async function checkCoachCreationLimit(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const canCreate = await subscriptionService.canCreateCoach(req.userId);
    if (!canCreate) {
      sendError(
        res,
        ErrorCodes.COACH_LIMIT_EXCEEDED,
        'Free plan allows only 1 custom coach. Upgrade to create unlimited coaches.',
        403
      );
      return;
    }
    next();
  } catch (error) {
    sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to check subscription limits', 500);
  }
}

/**
 * Middleware to check if user can start a new session
 */
export async function checkSessionLimit(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const canStart = await subscriptionService.canStartSession(req.userId);
    if (!canStart) {
      sendError(
        res,
        ErrorCodes.SESSION_LIMIT_EXCEEDED,
        'Free plan allows only 1 coaching session. Upgrade for unlimited sessions.',
        403
      );
      return;
    }
    next();
  } catch (error) {
    sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to check subscription limits', 500);
  }
}
