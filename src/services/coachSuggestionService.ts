/**
 * Coach Suggestion Service
 * Generates 3 diverse AI coach profiles tailored to user context,
 * with avatar matching from the Avatar collection.
 */

import { z } from 'zod';
import { avatarService } from './avatarService';
import { logger } from '../config/logger';
import {
  COACH_SUGGESTION_SYSTEM_MESSAGE,
  buildCoachSuggestionPrompt,
} from '../prompts/coachSuggestion';
import {
  SINGLE_COACH_SYSTEM_MESSAGE,
  buildSingleCoachPrompt,
} from '../prompts/coachCreation';

// --- Zod schema for validating AI response ---

const sampleTopicSchema = z.object({
  id: z.string(),
  icon: z.string(),
  title: z.string(),
  description: z.string(),
});

const coachSchema = z.object({
  name: z.string(),
  specialty: z.string(),
  category: z.string(),
  description: z.string(),
  bio: z.string(),
  tone: z.string(),
  coachingStyle: z.array(z.string()),
  systemPrompt: z.string(),
  suggestedAvatarStyle: z.string(),
  sampleTopics: z.array(sampleTopicSchema).min(3),
  conversationStarters: z.array(z.string()).min(3),
  matchReason: z.string(),
});

const suggestionResponseSchema = z.object({
  coaches: z.array(coachSchema).min(3),
});

const singleCoachResponseSchema = z.object({
  coach: coachSchema,
});

// --- Interfaces ---

interface CoachPreferences {
  role: string | null;
  challenges: string[];
  supportStyles: string[];
  goals: string[];
}

interface SanitizedAvatar {
  id: string;
  name: string;
  avatarImage: string;
  characteristics: {
    gender: string;
    ageRange: string;
    ethnicity: string;
    style: string;
    vibe: string;
  };
  characteristicsDescription: string;
  category: string;
  tags: string[];
  activeUsersCount: number;
}

export interface CoachSuggestion {
  name: string;
  specialty: string;
  category: string;
  description: string;
  bio: string;
  tone: string;
  coachingStyle: string[];
  systemPrompt: string;
  suggestedAvatarStyle: string;
  sampleTopics: { id: string; icon: string; title: string; description: string }[];
  conversationStarters: string[];
  matchReason: string;
  matchedAvatars: SanitizedAvatar[];
}

// --- Service ---

class CoachSuggestionService {
  /**
   * Generate 3 diverse coach suggestions with matched avatars.
   */
  async suggestCoaches(
    personalContext: string,
    preferences: CoachPreferences,
    userId: string
  ): Promise<CoachSuggestion[]> {
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const model = process.env.OPENAI_EVALUATION_MODEL || 'gpt-4o-mini';
    const userPrompt = buildCoachSuggestionPrompt(personalContext, preferences);

    logger.info('[CoachSuggestion] Generating 3 coach suggestions...');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: COACH_SUGGESTION_SYSTEM_MESSAGE },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.8,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('OpenAI coach suggestion error:', errorText);
      throw new Error('OPENAI_API_ERROR');
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string | null } }[];
    };
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      logger.error('OpenAI returned empty content for coach suggestion');
      throw new Error('OPENAI_API_ERROR');
    }

    // Parse and validate
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      logger.error('Failed to parse coach suggestion response:', content.substring(0, 200));
      throw new Error('OPENAI_API_ERROR');
    }

    const result = suggestionResponseSchema.safeParse(parsed);
    if (!result.success) {
      logger.error('Coach suggestion validation failed:', result.error.issues);
      throw new Error('OPENAI_API_ERROR');
    }

    const coaches = result.data.coaches.slice(0, 3);

    logger.info('[CoachSuggestion] Generated coaches:', coaches.map((c) => c.name));

    // Match avatars for each coach in parallel
    const suggestionsWithAvatars = await Promise.all(
      coaches.map(async (coach) => {
        let matchedAvatars: SanitizedAvatar[] = [];
        try {
          matchedAvatars = await avatarService.matchAvatarToCoach(
            {
              name: coach.name,
              specialty: coach.specialty,
              category: coach.category,
              description: coach.description,
              bio: coach.bio,
              tone: coach.tone,
              coachingStyle: coach.coachingStyle,
              suggestedAvatarStyle: coach.suggestedAvatarStyle,
            },
            userId
          );
          // Limit to top 3 avatar matches per coach
          matchedAvatars = matchedAvatars.slice(0, 3);
        } catch (error) {
          logger.warn(`[CoachSuggestion] Avatar matching failed for ${coach.name}:`, error);
        }

        return {
          ...coach,
          matchedAvatars,
        };
      })
    );

    logger.info('[CoachSuggestion] Complete with avatar matching');

    return suggestionsWithAvatars;
  }

  /**
   * Create a single personalized coach from freeform user context.
   */
  async createCoachFromContext(
    personalContext: string,
    userId?: string
  ): Promise<CoachSuggestion> {
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const model = process.env.OPENAI_EVALUATION_MODEL || 'gpt-4o-mini';
    const userPrompt = buildSingleCoachPrompt(personalContext);

    logger.info('[CoachCreation] Generating personalized coach from context...');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SINGLE_COACH_SYSTEM_MESSAGE },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.8,
        max_tokens: 3000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('OpenAI coach creation error:', errorText);
      throw new Error('OPENAI_API_ERROR');
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string | null } }[];
    };
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      logger.error('OpenAI returned empty content for coach creation');
      throw new Error('OPENAI_API_ERROR');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      logger.error('Failed to parse coach creation response:', content.substring(0, 200));
      throw new Error('OPENAI_API_ERROR');
    }

    const result = singleCoachResponseSchema.safeParse(parsed);
    if (!result.success) {
      logger.error('Coach creation validation failed:', result.error.issues);
      throw new Error('OPENAI_API_ERROR');
    }

    const coach = result.data.coach;
    logger.info('[CoachCreation] Generated coach:', coach.name);

    // Match avatar (top 1)
    let matchedAvatars: SanitizedAvatar[] = [];
    try {
      matchedAvatars = await avatarService.matchAvatarToCoach(
        {
          name: coach.name,
          specialty: coach.specialty,
          category: coach.category,
          description: coach.description,
          bio: coach.bio,
          tone: coach.tone,
          coachingStyle: coach.coachingStyle,
          suggestedAvatarStyle: coach.suggestedAvatarStyle,
        },
        userId || ''
      );
      matchedAvatars = matchedAvatars.slice(0, 1);
    } catch (error) {
      logger.warn(`[CoachCreation] Avatar matching failed for ${coach.name}:`, error);
    }

    logger.info('[CoachCreation] Complete with avatar matching');

    return {
      ...coach,
      matchedAvatars,
    };
  }
}

export const coachSuggestionService = new CoachSuggestionService();
