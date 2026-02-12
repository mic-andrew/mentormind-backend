/**
 * Module Routes
 * Endpoints for AI-powered module generation, enrollment, and daily step interactions
 */

import { Router } from 'express';
import { moduleController } from '../controllers/moduleController';
import { authenticate } from '../middleware/auth';

const router = Router();

// Module generation + listing
router.post('/generate', authenticate, (req, res) => moduleController.generateModules(req, res));
router.get('/', authenticate, (req, res) => moduleController.getModules(req, res));

// Enrollments (specific before parameterized)
router.get('/enrollments', authenticate, (req, res) => moduleController.getActiveEnrollments(req, res));

// Single module enrollment
router.post('/:moduleId/enroll', authenticate, (req, res) => moduleController.enroll(req, res));
router.get('/:moduleId/enrollment', authenticate, (req, res) => moduleController.getEnrollment(req, res));

// Daily step interactions
router.post('/:moduleId/days/:dayNumber/frame', authenticate, (req, res) => moduleController.generateFrame(req, res));
router.post('/:moduleId/days/:dayNumber/reflect', authenticate, (req, res) => moduleController.startReflect(req, res));
router.post('/:moduleId/days/:dayNumber/reflect/complete', authenticate, (req, res) => moduleController.completeReflection(req, res));
router.post('/:moduleId/days/:dayNumber/shift', authenticate, (req, res) => moduleController.generateShift(req, res));
router.post('/:moduleId/days/:dayNumber/complete', authenticate, (req, res) => moduleController.completeDay(req, res));

export default router;
