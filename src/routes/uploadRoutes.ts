/**
 * Upload Routes
 * Document upload API endpoints
 */

import { Router } from 'express';
import multer from 'multer';
import { uploadController } from '../controllers/uploadController';
import { authenticate } from '../middleware/auth';

const router = Router();

// Configure multer for memory storage (buffer) with 10MB limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// Upload a context document and extract text
router.post(
  '/document',
  authenticate,
  upload.single('document'),
  (req, res) => uploadController.uploadDocument(req, res)
);

export default router;
