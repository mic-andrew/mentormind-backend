/**
 * Upload Service
 * Handles S3 document uploads and text extraction for context documents.
 */

import * as crypto from 'crypto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import pdf from 'pdf-parse';
import AdmZip from 'adm-zip';
import { env } from '../config/env';
import { logger } from '../config/logger';

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'text/plain',
  'text/markdown',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

interface UploadResult {
  s3Key: string;
  extractedText: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
}

class UploadService {
  private s3: S3Client;

  constructor() {
    this.s3 = new S3Client({
      region: env.aws.s3Region,
      credentials: {
        accessKeyId: env.aws.accessKeyId,
        secretAccessKey: env.aws.secretAccessKey,
      },
    });
  }

  /**
   * Upload a document to S3 and extract its text content.
   */
  async uploadAndExtract(
    file: Express.Multer.File,
    userId: string
  ): Promise<UploadResult> {
    // Validate file type
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new Error('UNSUPPORTED_FILE_TYPE');
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      throw new Error('FILE_TOO_LARGE');
    }

    // Generate unique S3 key
    const uuid = crypto.randomUUID();
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const s3Key = `documents/${userId}/${uuid}-${sanitizedName}`;

    // Upload to S3
    await this.s3.send(
      new PutObjectCommand({
        Bucket: env.aws.s3Bucket,
        Key: s3Key,
        Body: file.buffer,
        ContentType: file.mimetype,
        Metadata: {
          userId,
          originalName: file.originalname,
        },
      })
    );

    logger.info(`[Upload] File uploaded to S3: ${s3Key} (${file.size} bytes)`);

    // Extract text
    const extractedText = await this.extractText(file.buffer, file.mimetype);

    logger.info(`[Upload] Text extracted: ${extractedText.length} chars from ${file.originalname}`);

    return {
      s3Key,
      extractedText,
      originalName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
    };
  }

  /**
   * Extract text content from a file buffer based on MIME type.
   */
  private async extractText(buffer: Buffer, mimeType: string): Promise<string> {
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
    const data = await pdf(buffer);
    return data.text.trim();
  }

  /**
   * Extract text from a DOCX buffer by parsing the XML content.
   * Lightweight approach — parses document.xml directly without heavy dependencies.
   */
  private async extractFromDocx(buffer: Buffer): Promise<string> {
    const zip = new AdmZip(buffer);
    const entry = zip.getEntry('word/document.xml');

    if (!entry) {
      throw new Error('INVALID_DOCX');
    }

    const xml = entry.getData().toString('utf-8');
    // Extract text between <w:t> tags
    const textMatches = xml.match(/<w:t[^>]*>([^<]*)<\/w:t>/g);
    if (!textMatches) return '';

    return textMatches
      .map((match) => {
        const content = match.replace(/<[^>]+>/g, '');
        return content;
      })
      .join('')
      .replace(/\s+/g, ' ')
      .trim();
  }
}

export const uploadService = new UploadService();
