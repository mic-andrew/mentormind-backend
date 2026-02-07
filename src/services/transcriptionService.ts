/**
 * Deepgram transcription service
 */

import { createClient } from '@deepgram/sdk';
import { env } from '../config/env';
import { logger } from '../config/logger';

class TranscriptionService {
  private deepgram;

  constructor() {
    this.deepgram = createClient(env.deepgramApiKey);
  }

  /**
   * Transcribe audio buffer to text using Deepgram
   */
  async transcribeAudio(audioBuffer: Buffer, mimeType: string = 'audio/webm'): Promise<string> {
    try {
      logger.info('[Transcription] Starting Deepgram transcription', {
        bufferSize: audioBuffer.length,
        mimeType,
        deepgramKeyConfigured: !!env.deepgramApiKey,
      });

      if (!audioBuffer || audioBuffer.length === 0) {
        logger.error('[Transcription] Empty audio buffer received');
        throw new Error('Empty audio buffer - no audio data to transcribe');
      }

      logger.info('[Transcription] Calling Deepgram API with nova-2 model...');

      const { result, error } = await this.deepgram.listen.prerecorded.transcribeFile(audioBuffer, {
        model: 'nova-2',
        smart_format: true,
        punctuate: true,
        paragraphs: true,
        language: 'en',
      });

      if (error) {
        logger.error('[Transcription] Deepgram API returned error:', {
          message: error.message,
          error,
        });
        throw new Error(`Transcription failed: ${error.message}`);
      }

      logger.info('[Transcription] Deepgram API responded successfully');

      const transcript = result?.results?.channels?.[0]?.alternatives?.[0]?.transcript;
      const confidence = result?.results?.channels?.[0]?.alternatives?.[0]?.confidence;

      if (!transcript) {
        logger.error('[Transcription] No transcript in Deepgram response', {
          hasResult: !!result,
          hasChannels: !!result?.results?.channels?.length,
        });
        throw new Error('No transcript generated - Deepgram returned empty result');
      }

      logger.info('[Transcription] SUCCESS', {
        transcriptLength: transcript.length,
        confidence,
        preview: transcript.substring(0, 100),
      });

      return transcript;
    } catch (error) {
      logger.error('[Transcription] Service error:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Transcribe audio from URL
   */
  async transcribeFromUrl(audioUrl: string): Promise<string> {
    try {
      logger.info('[Transcription] Transcribing from URL', { url: audioUrl });

      const { result, error } = await this.deepgram.listen.prerecorded.transcribeUrl(
        { url: audioUrl },
        {
          model: 'nova-2',
          smart_format: true,
          punctuate: true,
          paragraphs: true,
          language: 'en',
        }
      );

      if (error) {
        logger.error('[Transcription] Deepgram URL transcription error:', error);
        throw new Error(`Transcription failed: ${error.message}`);
      }

      const transcript = result?.results?.channels?.[0]?.alternatives?.[0]?.transcript;

      if (!transcript) {
        throw new Error('No transcript generated from URL');
      }

      logger.info('[Transcription] URL transcription SUCCESS', {
        transcriptLength: transcript.length,
        preview: transcript.substring(0, 100),
      });

      return transcript;
    } catch (error) {
      logger.error('[Transcription] URL transcription error:', error);
      throw error;
    }
  }
}

export const transcriptionService = new TranscriptionService();
