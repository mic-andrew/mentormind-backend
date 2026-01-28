/**
 * Social Authentication Routes
 * Defines routes for Google (server-driven OAuth) and Apple Sign In
 */

import { Router } from 'express';
import { appleAuthController } from '../controllers/socialAuthController';
import {
  initiateGoogleAuth,
  googleCallbackHandler,
  exchangeSessionHandler,
} from '../controllers/googleOAuthController';

const router = Router();

/**
 * GET /api/auth/social/google
 * Initiates Google OAuth flow (redirects to Google)
 */
router.get('/google', initiateGoogleAuth);

/**
 * GET /api/auth/social/google/callback
 * Handles Google OAuth callback
 */
router.get('/google/callback', googleCallbackHandler);

/**
 * POST /api/auth/social/exchange-session
 * Exchanges sessionId for access/refresh tokens
 */
router.post('/exchange-session', exchangeSessionHandler);

/**
 * POST /api/auth/social/apple
 * Authenticate with Apple ID token (client-driven)
 */
router.post('/apple', appleAuthController);

export default router;
