/**
 * AI coach extraction service using OpenAI
 */

import OpenAI from 'openai';
import { env } from '../config/env';
import { logger } from '../config/logger';
import type { CoachCategory, CoachTone, CoachingStyleTag } from '../models/Coach';

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

      const prompt = `You are an AI assistant that helps create personalized AI coach profiles.
A user has described the type of coach they want. Extract and generate the following information in valid JSON format:

User's description: "${description}"

Extract/generate:
1. "name": A realistic human name for the coach persona. Use a first name and last name like a real person (e.g., "Dr. Sarah Chen", "Marcus Thompson", "Elena Voss"). NEVER use generic titles like "Coach Focused Mind" or "Productivity Pro" — always use a believable human name. You may optionally prefix with Dr. or Prof. if appropriate for the specialty.
2. "specialty": Their specialty (e.g., "Executive Productivity Coach", "Marathon Training Expert")
3. "category": One of: productivity, health, business, finance, mindfulness, career, fitness, marketing, systems, custom
4. "description": A catchy 1-sentence tagline (max 100 chars)
5. "bio": A detailed 2-3 sentence biography describing their background and approach (100-300 chars)
6. "systemPrompt": A comprehensive system prompt (200-500 words) that defines the coach's personality, methodology, and how they interact. Use this format:

You are [Name], a [specialty] who specializes in [area].

## Core Identity
- Background: [Professional history]
- Philosophy: [Guiding principles]
- Style: [Communication approach]

## How You Help
- [Specific value proposition 1]
- [Specific value proposition 2]
- [Specific value proposition 3]

## Conversation Guidelines
- Start by understanding the user's current situation
- Ask clarifying questions before giving advice
- Provide actionable, specific recommendations
- Use [tone] communication style

7. "tone": One of: professional, casual, warm, direct, challenging
8. "coachingStyle": Array of 1-3 from: Analytical, Direct Feedback, Science-Based, Empathetic, Goal-Oriented, Holistic, Supportive, Socratic
9. "sampleTopics": Array of 3 conversation topics, each with:
   - "id": number as string (e.g., "1", "2", "3")
   - "icon": ionicon name (e.g., "trophy-outline", "calendar-outline", "people-outline")
   - "title": Short topic title (2-4 words)
   - "description": Brief description of what you'll discuss (8-12 words)
10. "conversationStarters": Array of 3 opening questions the coach would ask (each 10-20 words)
11. "suggestedAvatarStyle": Brief description for avatar matching (e.g., "athletic male, 30s, professional")

Respond ONLY with valid JSON, no markdown code blocks or explanations.`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that extracts structured data and responds only in valid JSON format.',
          },
          {
            role: 'user',
            content: prompt,
          },
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
      const prompt = `Generate a detailed system prompt for an AI coach with these attributes:
- Name: ${name}
- Specialty: ${specialty}
- Category: ${category}
- Tone: ${tone}
- Coaching Style: ${coachingStyle.join(', ')}

Use this format and make it 200-400 words:

You are [Name], a [specialty] who specializes in [area].

## Core Identity
- Background: [Create realistic professional history]
- Philosophy: [Guiding principles]
- Style: [Communication approach]

## How You Help
- [Specific value proposition 1]
- [Specific value proposition 2]
- [Specific value proposition 3]

## Conversation Guidelines
- Start by understanding the user's current situation
- Ask clarifying questions before giving advice
- Provide actionable, specific recommendations
- Use ${tone} communication style`;

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
