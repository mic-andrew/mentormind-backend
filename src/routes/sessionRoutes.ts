/**
 * Session Routes
 * Voice coaching session API endpoints
 */

import { Router } from 'express';
import { sessionController } from '../controllers/sessionController';
import { evaluationController } from '../controllers/evaluationController';
import { authenticate } from '../middleware/auth';

const router = Router();

// All session routes require authentication

// Specific paths (before parameterized)
router.post('/start', authenticate, (req, res) => sessionController.startSession(req, res));
router.post('/sdp-exchange', authenticate, (req, res) => sessionController.sdpExchange(req, res));
router.get('/history', authenticate, (req, res) => sessionController.getSessionHistory(req, res));
router.get('/active', authenticate, (req, res) => sessionController.getActiveSession(req, res));
router.get('/context', authenticate, (req, res) => sessionController.getUserContext(req, res));
router.put('/context', authenticate, (req, res) => sessionController.updateUserContext(req, res));

// Parameterized routes (must come after specific paths)
router.get('/:id', authenticate, (req, res) => sessionController.getSession(req, res));
router.post('/:id/resume', authenticate, (req, res) => sessionController.resumeSession(req, res));
router.put('/:id/transcript', authenticate, (req, res) => sessionController.saveTranscript(req, res));
router.post('/:id/end', authenticate, (req, res) => sessionController.endSession(req, res));
router.post('/:id/pause', authenticate, (req, res) => sessionController.pauseSession(req, res));

// Evaluation routes (more specific path first)
router.post('/:id/evaluation/retry', authenticate, (req, res) => evaluationController.retryEvaluation(req, res));
router.post('/:id/evaluation', authenticate, (req, res) => evaluationController.generateEvaluation(req, res));
router.get('/:id/evaluation', authenticate, (req, res) => evaluationController.getEvaluation(req, res));

export default router;
