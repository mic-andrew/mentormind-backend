/**
 * Authentication Routes
 */

import { Router } from 'express';
import { authController } from '../controllers/authController';
import { authenticate } from '../middleware/auth';

const router = Router();

// Public routes
router.post('/register', (req, res) => authController.register(req, res));
router.post('/login', (req, res) => authController.login(req, res));
router.post('/forgot-password', (req, res) => authController.forgotPassword(req, res));
router.post('/verify-otp', (req, res) => authController.verifyOTP(req, res));
router.post('/resend-otp', (req, res) => authController.resendOTP(req, res));
router.post('/reset-password', (req, res) => authController.resetPassword(req, res));
router.post('/refresh', (req, res) => authController.refreshToken(req, res));

// OAuth routes
router.get('/google', (req, res) => authController.initiateGoogleAuth(req, res));
router.get('/google/callback', (req, res) => authController.googleCallback(req, res));
router.post('/exchange-session', (req, res) => authController.exchangeSession(req, res));
router.post('/apple', (req, res) => authController.appleAuth(req, res));

// Protected routes
router.get('/me', authenticate, (req, res) => authController.getCurrentUser(req, res));
router.patch('/profile', authenticate, (req, res) => authController.updateProfile(req, res));
router.patch('/password', authenticate, (req, res) => authController.updatePassword(req, res));
router.post('/schedule-deletion', authenticate, (req, res) => authController.scheduleAccountDeletion(req, res));
router.post('/cancel-deletion', authenticate, (req, res) => authController.cancelAccountDeletion(req, res));
router.post('/logout', authenticate, (req, res) => authController.logout(req, res));

export default router;
