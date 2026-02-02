/**
 * Avatar Routes
 */

import type { Request, Response } from 'express';
import { Router } from 'express';
import { avatarController } from '../controllers/avatarController';
import { authenticate, type AuthenticatedRequest } from '../middleware/auth';

const router = Router();

// Public route: list all avatars
router.get('/', (req, res) => avatarController.getAvatars(req, res));

// Protected routes
router.get('/available', authenticate, (req, res) =>
  avatarController.getAvailableAvatars(req, res)
);

router.post('/match', authenticate, (req: Request, res: Response) =>
  avatarController.matchAvatars(req as AuthenticatedRequest, res)
);

// Parameterized route (must come last)
router.get('/:id', (req, res) => avatarController.getAvatarById(req, res));

export default router;
