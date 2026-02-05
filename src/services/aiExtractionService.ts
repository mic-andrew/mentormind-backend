/**
 * AI coach extraction service using OpenAI
 */

import OpenAI from 'openai';
import { env } from '../config/env';
import { logger } from '../config/logger';
import type { CoachCategory, CoachTone, CoachingStyleTag } from '../models/Coach';
import {
  COACH_EXTRACTION_SYSTEM_MESSAGE,
  buildCoachExtractionPrompt,
  buildSystemPromptGenerationPrompt,
} from '../prompts/coachExtraction';

interface SampleTopic {
  id: string;
  icon: string;
  title: string;
  description: string;
}

interface ExtractedCoachData {
  name: string;
  specialty: string;
  category: CoachCategory;
  description: string;
  bio: string;
  systemPrompt: string;
  tone: CoachTone;
  coachingStyle: CoachingStyleTag[];
  sampleTopics: SampleTopic[];
  conversationStarters: string[];
  suggestedAvatarStyle?: string;
}

class AIExtractionService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: env.openaiApiKey,
    });
  }

  /**
   * Extract coach attributes from user description
   */
  async extractCoachFromDescription(description: string): Promise<ExtractedCoachData> {
    try {
      logger.info('[AIExtraction] Starting coach extraction', {
        descriptionLength: description.length,
        preview: description.substring(0, 150),
        openaiKeyConfigured: !!env.openaiApiKey,
      });

      const prompt = buildCoachExtractionPrompt(description);

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: COACH_EXTRACTION_SYSTEM_MESSAGE },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' },
      });

      const responseText = completion.choices[0]?.message?.content;

      if (!responseText) {
        logger.error('[AIExtraction] OpenAI returned empty response');
        throw new Error('No response from OpenAI');
      }

      logger.info('[AIExtraction] OpenAI responded, parsing JSON...', {
        responseLength: responseText.length,
      });

      const extractedData = JSON.parse(responseText) as ExtractedCoachData;

      // Validate required fields
      if (!extractedData.name || !extractedData.specialty || !extractedData.category) {
        logger.error('[AIExtraction] Missing required fields', {
          hasName: !!extractedData.name,
          hasSpecialty: !!extractedData.specialty,
          hasCategory: !!extractedData.category,
        });
        throw new Error('Missing required fields in extracted data');
      }

      logger.info('[AIExtraction] SUCCESS', {
        name: extractedData.name,
        specialty: extractedData.specialty,
        category: extractedData.category,
        tone: extractedData.tone,
        coachingStyles: extractedData.coachingStyle,
        suggestedAvatarStyle: extractedData.suggestedAvatarStyle,
        hasBio: !!extractedData.bio,
        hasSystemPrompt: !!extractedData.systemPrompt,
        sampleTopicsCount: extractedData.sampleTopics?.length ?? 0,
        conversationStartersCount: extractedData.conversationStarters?.length ?? 0,
      });

      return extractedData;
    } catch (error) {
      logger.error('[AIExtraction] Error:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw new Error('Failed to extract coach attributes from description');
    }
  }

  /**
   * Generate system prompt from coach attributes (if user wants to customize later)
   */
  async generateSystemPrompt(
    name: string,
    specialty: string,
    category: string,
    tone: string,
    coachingStyle: string[]
  ): Promise<string> {
    try {
      const prompt = buildSystemPromptGenerationPrompt(name, specialty, category, tone, coachingStyle);

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
      });

      return completion.choices[0]?.message?.content || '';
    } catch (error) {
      logger.error('System prompt generation error:', error);
      throw new Error('Failed to generate system prompt');
    }
  }
}

export const aiExtractionService = new AIExtractionService();
