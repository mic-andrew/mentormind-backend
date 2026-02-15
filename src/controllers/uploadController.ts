/**
 * Upload Controller
 * Handles document upload HTTP requests.
 */

import type { Request, Response } from 'express';
import { uploadService } from '../services/uploadService';
import { sendSuccess, sendError, ErrorCodes } from '../utils/response';
import { logger } from '../config/logger';
import type { AuthenticatedRequest } from '../middleware/auth';

const ERROR_MAP: Record<string, { message: string; status: number }> = {
  UNSUPPORTED_FILE_TYPE: {
    message: 'Unsupported file type. Use PDF, TXT, MD, or DOCX.',
    status: 400,
  },
  FILE_TOO_LARGE: {
    message: 'File exceeds the 10MB limit. Choose a smaller file.',
    status: 400,
  },
  INVALID_DOCX: {
    message: 'This DOCX file appears corrupted or invalid. Try another file.',
    status: 400,
  },
  PDF_PARSE_FAILED: {
    message:
      'Could not extract text from this PDF. It may be image-based or corrupted.',
    status: 422,
  },
  EMPTY_EXTRACTION: {
    message: 'No text could be extracted from this file. Try a different document.',
    status: 422,
  },
};

class UploadController {
  /**
   * Upload a context document, extract text, and persist as a Note.
   * POST /api/uploads/document
   */
  async uploadDocument(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req as AuthenticatedRequest;
      const file = req.file;

      if (!file) {
        sendError(res, ErrorCodes.VALIDATION_ERROR, 'No file provided.', 400);
        return;
      }

      const result = await uploadService.processDocument(file, userId);

      sendSuccess(res, {
        noteId: result.noteId,
        extractedText: result.extractedText,
        originalName: result.originalName,
        mimeType: result.mimeType,
        sizeBytes: result.sizeBytes,
      });
    } catch (error) {
      if (error instanceof Error && error.message in ERROR_MAP) {
        const mapped = ERROR_MAP[error.message];
        sendError(res, ErrorCodes.VALIDATION_ERROR, mapped.message, mapped.status);
        return;
      }

      logger.error('[Upload] Document processing failed:', error);
      sendError(
        res,
        ErrorCodes.INTERNAL_ERROR,
        'Failed to process your document. Please try again.',
        500
      );
    }
  }
}

export const uploadController = new UploadController();
