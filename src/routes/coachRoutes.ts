/**
 * Coach Routes
 */

import type { Request, Response } from 'express';
import { Router } from 'express';
import multer from 'multer';
import { coachController } from '../controllers/coachController';
import { authenticate, optionalAuthenticate, type AuthenticatedRequest } from '../middleware/auth';

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
});

const router = Router();

// Public routes (specific paths before parameterized)
router.get('/', (req, res) => coachController.getCoaches(req, res));
router.get('/featured', (req, res) => coachController.getFeaturedCoaches(req, res));
router.get('/categories', (req, res) => coachController.getCategories(req, res));

// Protected routes (specific paths before parameterized)
router.get('/my-coaches', authenticate, (req, res) => coachController.getMyCoaches(req, res));
router.get('/pending-shares', authenticate, (req, res) =>
  coachController.getPendingShares(req, res)
);

// Voice creation routes
router.post('/transcribe', authenticate, upload.single('audio'), (req: Request, res: Response) =>
  coachController.transcribeAudio(req as AuthenticatedRequest, res)
);
router.post('/extract-from-description', authenticate, (req: Request, res: Response) =>
  coachController.extractFromDescription(req as AuthenticatedRequest, res)
);
router.post('/quick-create', authenticate, upload.single('audio'), (req: Request, res: Response) =>
  coachController.quickCreate(req as AuthenticatedRequest, res)
);

router.post('/', authenticate, (req, res) => coachController.createCoach(req, res));

// Share invitation actions (before :id routes)
router.post('/shares/:shareId/accept', authenticate, (req, res) =>
  coachController.acceptShare(req, res)
);
router.post('/shares/:shareId/decline', authenticate, (req, res) =>
  coachController.declineShare(req, res)
);

// Parameterized routes (must come after specific paths)
router.get('/:id', optionalAuthenticate, (req, res) => coachController.getCoachById(req, res));
router.get('/:id/session', authenticate, (req, res) =>
  coachController.getCoachForSession(req, res)
);
router.put('/:id', authenticate, (req, res) => coachController.updateCoach(req, res));
router.delete('/:id', authenticate, (req, res) => coachController.deleteCoach(req, res));
router.post('/:id/flag', authenticate, (req, res) => coachController.flagCoach(req, res));

// Sharing routes
router.post('/:id/share', authenticate, (req, res) => coachController.shareCoach(req, res));
router.get('/:id/shares', authenticate, (req, res) => coachController.getCoachShares(req, res));
router.delete('/:id/shares/:shareId', authenticate, (req, res) =>
  coachController.revokeShare(req, res)
);

export default router;
