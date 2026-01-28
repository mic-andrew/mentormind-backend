/**
 * Authentication Routes
 */

import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth';
import { exchangeSessionHandler } from '../controllers/googleOAuthController';

const router = Router();

// Public routes
router.post('/register', (req, res) => authController.register(req, res));
router.post('/login', (req, res) => authController.login(req, res));
router.post('/forgot-password', (req, res) => authController.forgotPassword(req, res));
router.post('/verify-otp', (req, res) => authController.verifyOTP(req, res));
router.post('/resend-otp', (req, res) => authController.resendOTP(req, res));
router.post('/reset-password', (req, res) => authController.resetPassword(req, res));
router.post('/refresh', (req, res) => authController.refreshToken(req, res));
router.post('/exchange-session', exchangeSessionHandler);

// Protected routes
router.get('/me', authenticate, (req, res) => authController.getCurrentUser(req, res));
router.post('/logout', authenticate, (req, res) => authController.logout(req, res));

export default router;
