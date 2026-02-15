/**
 * Upload Service
 * Handles document text extraction and Note persistence.
 * No S3 dependency — extraction is done locally from the file buffer.
 */

import pdf from 'pdf-parse';
import AdmZip from 'adm-zip';
import { Note } from '../models/Note';
import { logger } from '../config/logger';

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'text/plain',
  'text/markdown',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_EXTRACTED_CHARS = 50_000;

interface ProcessResult {
  noteId: string;
  extractedText: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
}

class UploadService {
  /**
   * Extract text from the uploaded document and persist as a Note.
   */
  async processDocument(
    file: Express.Multer.File,
    userId: string
  ): Promise<ProcessResult> {
    this.validateFile(file);

    const extractedText = await this.extractText(file.buffer, file.mimetype);

    if (!extractedText || extractedText.trim().length === 0) {
      throw new Error('EMPTY_EXTRACTION');
    }

    const trimmedText = extractedText.slice(0, MAX_EXTRACTED_CHARS);
    const title = this.titleFromFileName(file.originalname);

    const note = await Note.create({
      userId,
      title,
      content: trimmedText,
      sourceFileName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
    });

    logger.info(
      `[Upload] Text extracted: ${trimmedText.length} chars from "${file.originalname}" → Note ${note._id}`
    );

    return {
      noteId: note._id.toString(),
      extractedText: trimmedText,
      originalName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
    };
  }

  /**
   * Validate file type and size. Throws coded errors for the controller to map.
   */
  private validateFile(file: Express.Multer.File): void {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new Error('UNSUPPORTED_FILE_TYPE');
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new Error('FILE_TOO_LARGE');
    }
  }

  /**
   * Extract text content from a file buffer based on MIME type.
   */
  private async extractText(
    buffer: Buffer,
    mimeType: string
  ): Promise<string> {
    switch (mimeType) {
      case 'application/pdf':
        return this.extractFromPdf(buffer);

      case 'text/plain':
      case 'text/markdown':
        return buffer.toString('utf-8').trim();

      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        return this.extractFromDocx(buffer);

      default:
        throw new Error('UNSUPPORTED_FILE_TYPE');
    }
  }

  /**
   * Extract text from a PDF buffer using pdf-parse.
   */
  private async extractFromPdf(buffer: Buffer): Promise<string> {
    try {
      const data = await pdf(buffer);
      return data.text.trim();
    } catch (error) {
      logger.error('[Upload] PDF parse failed:', error);
      throw new Error('PDF_PARSE_FAILED');
    }
  }

  /**
   * Extract text from a DOCX buffer by parsing the XML content.
   */
  private extractFromDocx(buffer: Buffer): string {
    try {
      const zip = new AdmZip(buffer);
      const entry = zip.getEntry('word/document.xml');

      if (!entry) {
        throw new Error('INVALID_DOCX');
      }

      const xml = entry.getData().toString('utf-8');
      const textMatches = xml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g);
      if (!textMatches) return '';

      return textMatches
        .map((match) => match.replace(/<[^>]+>/g, ''))
        .join('')
        .replace(/\s+/g, ' ')
        .trim();
    } catch (error) {
      if (error instanceof Error && error.message === 'INVALID_DOCX') {
        throw error;
      }
      logger.error('[Upload] DOCX parse failed:', error);
      throw new Error('INVALID_DOCX');
    }
  }

  /**
   * Derive a human-readable title from the filename.
   * "my_resume_2024.pdf" → "my resume 2024"
   */
  private titleFromFileName(fileName: string): string {
    const withoutExt = fileName.replace(/\.[^.]+$/, '');
    return withoutExt
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 200);
  }
}

export const uploadService = new UploadService();
