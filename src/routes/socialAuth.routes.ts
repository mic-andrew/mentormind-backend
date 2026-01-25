/**
 * Social Authentication Routes
 * Defines routes for Google and Apple Sign In
 */

import { Router } from 'express';
import { googleAuthController, appleAuthController } from '../controllers/socialAuthController';

const router = Router();

/**
 * POST /api/auth/social/google
 * Authenticate with Google OAuth token
 */
router.post('/google', googleAuthController);

/**
 * POST /api/auth/social/apple
 * Authenticate with Apple ID token
 */
router.post('/apple', appleAuthController);

export default router;
