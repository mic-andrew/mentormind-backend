/**
 * Upload Controller
 * Handles document upload HTTP requests.
 */

import type { Request, Response } from 'express';
import { uploadService } from '../services/uploadService';
import { sendSuccess, sendError, ErrorCodes } from '../utils/response';
import { logger } from '../config/logger';
import type { AuthenticatedRequest } from '../middleware/auth';

class UploadController {
  /**
   * Upload a context document, extract text, and return it.
   * POST /api/uploads/document
   */
  async uploadDocument(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req as AuthenticatedRequest;
      const file = req.file;

      if (!file) {
        sendError(res, ErrorCodes.VALIDATION_ERROR, 'No file provided', 400);
        return;
      }

      const result = await uploadService.uploadAndExtract(file, userId);

      sendSuccess(res, {
        extractedText: result.extractedText,
        originalName: result.originalName,
        mimeType: result.mimeType,
        sizeBytes: result.sizeBytes,
      });
    } catch (error) {
      if (error instanceof Error) {
        switch (error.message) {
          case 'UNSUPPORTED_FILE_TYPE':
            sendError(
              res,
              ErrorCodes.VALIDATION_ERROR,
              'Unsupported file type. Allowed: PDF, TXT, MD, DOCX',
              400
            );
            return;
          case 'FILE_TOO_LARGE':
            sendError(res, ErrorCodes.VALIDATION_ERROR, 'File too large. Maximum 10MB', 400);
            return;
          case 'INVALID_DOCX':
            sendError(res, ErrorCodes.VALIDATION_ERROR, 'Invalid DOCX file', 400);
            return;
        }
      }
      logger.error('Document upload error:', error);
      sendError(res, ErrorCodes.INTERNAL_ERROR, 'Failed to process document', 500);
    }
  }
}

export const uploadController = new UploadController();
