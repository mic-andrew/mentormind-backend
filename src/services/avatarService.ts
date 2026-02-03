/**
 * Avatar Service
 * Handles avatar retrieval, matching, and assignment logic
 */

import { Avatar, IAvatar } from '../models/Avatar';
import { Coach } from '../models/Coach';
import { Types } from 'mongoose';
import { logger } from '../config/logger';
import OpenAI from 'openai';
import { env } from '../config/env';
import type { CoachCategory } from '../models/Coach';

interface PaginationOptions {
  page?: number;
  limit?: number;
  category?: CoachCategory;
}

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
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

// Threshold: users with 10+ coaches can reuse avatars
const REUSE_THRESHOLD = 10;

class AvatarService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: env.openaiApiKey,
    });
  }

  /**
   * Sanitize avatar for API response
   */
  private sanitizeAvatar(avatar: IAvatar): SanitizedAvatar {
    return {
      id: avatar._id.toString(),
      name: avatar.name,
      avatarImage: avatar.avatarImage,
      characteristics: {
        gender: avatar.characteristics.gender,
        ageRange: avatar.characteristics.ageRange,
        ethnicity: avatar.characteristics.ethnicity,
        style: avatar.characteristics.style,
        vibe: avatar.characteristics.vibe,
      },
      characteristicsDescription: avatar.characteristicsDescription,
      category: avatar.category,
      tags: avatar.tags,
      activeUsersCount: avatar.activeUsersCount,
    };
  }

  /**
   * Get all active avatars (paginated, optional category filter)
   */
  async getAvatars(options: PaginationOptions = {}): Promise<PaginatedResponse<SanitizedAvatar>> {
    const { page = 1, limit = 20, category } = options;
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = { isActive: true };
    if (category) {
      query.category = category;
    }

    const [avatars, total] = await Promise.all([
      Avatar.find(query).sort({ activeUsersCount: -1, createdAt: -1 }).skip(skip).limit(limit),
      Avatar.countDocuments(query),
    ]);

    return {
      data: avatars.map((a) => this.sanitizeAvatar(a)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get avatars available to a specific user
   * Excludes avatars the user is already using (unless 10+ coaches)
   */
  async getAvailableAvatars(
    userId: string,
    options: PaginationOptions = {}
  ): Promise<PaginatedResponse<SanitizedAvatar>> {
    const { page = 1, limit = 20, category } = options;
    const skip = (page - 1) * limit;

    const userObjectId = new Types.ObjectId(userId);

    // Check if user has 10+ coaches (unlocks reuse)
    const coachCount = await this.getUserCoachCount(userId);
    const canReuse = coachCount >= REUSE_THRESHOLD;

    const query: Record<string, unknown> = { isActive: true };
    if (category) {
      query.category = category;
    }

    // If user can't reuse, exclude avatars they already have
    if (!canReuse) {
      query.users = { $ne: userObjectId };
    }

    const [avatars, total] = await Promise.all([
      Avatar.find(query).sort({ activeUsersCount: -1, createdAt: -1 }).skip(skip).limit(limit),
      Avatar.countDocuments(query),
    ]);

    // If no available avatars (all used by this user), fall back to showing all
    if (total === 0 && !canReuse) {
      const fallbackQuery: Record<string, unknown> = { isActive: true };
      if (category) {
        fallbackQuery.category = category;
      }

      const [fallbackAvatars, fallbackTotal] = await Promise.all([
        Avatar.find(fallbackQuery)
          .sort({ activeUsersCount: -1, createdAt: -1 })
          .skip(skip)
          .limit(limit),
        Avatar.countDocuments(fallbackQuery),
      ]);

      return {
        data: fallbackAvatars.map((a) => this.sanitizeAvatar(a)),
        total: fallbackTotal,
        page,
        limit,
        totalPages: Math.ceil(fallbackTotal / limit),
      };
    }

    return {
      data: avatars.map((a) => this.sanitizeAvatar(a)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Match avatars to coach description using LLM
   * Returns top 5 matches ranked by relevance
   */
  async matchAvatarToCoach(
    extractedData: {
      name: string;
      specialty: string;
      category: string;
      description: string;
      bio: string;
      tone: string;
      coachingStyle: string[];
      suggestedAvatarStyle?: string;
    },
    userId: string
  ): Promise<SanitizedAvatar[]> {
    try {
      logger.info('[AvatarMatch] Starting avatar matching', {
        coachName: extractedData.name,
        category: extractedData.category,
        tone: extractedData.tone,
        suggestedStyle: extractedData.suggestedAvatarStyle,
        userId,
      });

      const userObjectId = new Types.ObjectId(userId);
      const coachCount = await this.getUserCoachCount(userId);
      const canReuse = coachCount >= REUSE_THRESHOLD;

      logger.info('[AvatarMatch] User stats', { coachCount, canReuse, threshold: REUSE_THRESHOLD });

      // Fetch available avatars for matching
      const query: Record<string, unknown> = { isActive: true };
      if (!canReuse) {
        query.users = { $ne: userObjectId };
      }

      let avatars = await Avatar.find(query).limit(100);

      logger.info('[AvatarMatch] Available avatars found', { count: avatars.length });

      // Fallback: if no available avatars, use all
      if (avatars.length === 0 && !canReuse) {
        logger.warn('[AvatarMatch] No available avatars, falling back to all');
        avatars = await Avatar.find({ isActive: true }).limit(100);
      }

      if (avatars.length === 0) {
        logger.warn('[AvatarMatch] No avatars found at all in database');
        return [];
      }

      // Build avatar list for LLM
      const avatarList = avatars.map((a, i) => ({
        index: i,
        id: a._id.toString(),
        name: a.name,
        description: a.characteristicsDescription,
        category: a.category,
        gender: a.characteristics.gender,
        ageRange: a.characteristics.ageRange,
        style: a.characteristics.style,
        vibe: a.characteristics.vibe,
        tags: a.tags.join(', '),
      }));

      const prompt = `You are an avatar matching assistant. Given a coach profile, select the 5 best matching avatars from the list below.

Coach Profile:
- Name: ${extractedData.name}
- Specialty: ${extractedData.specialty}
- Category: ${extractedData.category}
- Description: ${extractedData.description}
- Bio: ${extractedData.bio}
- Tone: ${extractedData.tone}
- Coaching Style: ${extractedData.coachingStyle.join(', ')}
${extractedData.suggestedAvatarStyle ? `- Suggested Avatar Style: ${extractedData.suggestedAvatarStyle}` : ''}

Available Avatars:
${avatarList.map((a) => `[${a.index}] ${a.name} - ${a.description} (Category: ${a.category}, Gender: ${a.gender}, Age: ${a.ageRange}, Style: ${a.style}, Vibe: ${a.vibe}, Tags: ${a.tags})`).join('\n')}

Return a JSON object with a "matches" array containing exactly 5 avatar indices (numbers) ranked from best to worst match. Consider the coach's category, tone, style, and overall personality when matching.

Example: {"matches": [3, 7, 12, 0, 45]}`;

      logger.info('[AvatarMatch] Calling OpenAI for matching...');

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'You select the best matching avatar for AI coaches. Respond only with valid JSON.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      });

      const responseText = completion.choices[0]?.message?.content;
      if (!responseText) {
        logger.error('[AvatarMatch] OpenAI returned empty response');
        throw new Error('No response from OpenAI');
      }

      logger.info('[AvatarMatch] OpenAI responded, parsing matches...');

      const result = JSON.parse(responseText) as { matches: number[] };
      const matchedIndices = result.matches.slice(0, 5);

      logger.info('[AvatarMatch] Matched indices', { matchedIndices });

      // Map indices to sanitized avatars
      const matchedAvatars = matchedIndices
        .filter((idx) => idx >= 0 && idx < avatars.length)
        .map((idx) => this.sanitizeAvatar(avatars[idx]));

      if (matchedAvatars.length === 0) {
        logger.warn('[AvatarMatch] No valid matches, returning random 5');
        return avatars.slice(0, 5).map((a) => this.sanitizeAvatar(a));
      }

      logger.info('[AvatarMatch] SUCCESS', {
        matchCount: matchedAvatars.length,
        matchedNames: matchedAvatars.map((a) => a.name),
        matchedIds: matchedAvatars.map((a) => a.id),
      });

      return matchedAvatars;
    } catch (error) {
      logger.error('[AvatarMatch] Error:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });

      // Fallback: return random available avatars
      const fallbackAvatars = await Avatar.find({ isActive: true }).limit(5);
      logger.info('[AvatarMatch] Returning fallback avatars', { count: fallbackAvatars.length });
      return fallbackAvatars.map((a) => this.sanitizeAvatar(a));
    }
  }

  /**
   * Get a single avatar by ID
   */
  async getAvatarById(id: string): Promise<SanitizedAvatar> {
    if (!Types.ObjectId.isValid(id)) {
      throw new Error('INVALID_AVATAR_ID');
    }

    const avatar = await Avatar.findById(id);
    if (!avatar || !avatar.isActive) {
      throw new Error('AVATAR_NOT_FOUND');
    }

    return this.sanitizeAvatar(avatar);
  }

  /**
   * Assign an avatar to a user (when coach is created)
   * Uses $addToSet to prevent duplicates and atomic $inc for count
   */
  async assignAvatarToUser(avatarId: string, userId: string): Promise<void> {
    if (!Types.ObjectId.isValid(avatarId)) {
      throw new Error('INVALID_AVATAR_ID');
    }

    const userObjectId = new Types.ObjectId(userId);

    // Check if user is already assigned (for count accuracy)
    const avatar = await Avatar.findById(avatarId);
    if (!avatar) {
      throw new Error('AVATAR_NOT_FOUND');
    }

    const alreadyAssigned = avatar.users.some((u) => u.toString() === userId);

    if (alreadyAssigned) {
      // User already assigned, no need to update
      return;
    }

    // Atomically add user and increment count
    await Avatar.findByIdAndUpdate(avatarId, {
      $addToSet: { users: userObjectId },
      $inc: { activeUsersCount: 1 },
    });

    logger.info(`Avatar ${avatarId} assigned to user ${userId}`);
  }

  /**
   * Check if a user can use a specific avatar
   */
  async canUserUseAvatar(avatarId: string, userId: string): Promise<boolean> {
    if (!Types.ObjectId.isValid(avatarId)) {
      return false;
    }

    const avatar = await Avatar.findById(avatarId);
    if (!avatar || !avatar.isActive) {
      return false;
    }

    const alreadyUsing = avatar.users.some((u) => u.toString() === userId);

    if (!alreadyUsing) {
      return true;
    }

    // If already using, check if user has 10+ coaches
    const coachCount = await this.getUserCoachCount(userId);
    return coachCount >= REUSE_THRESHOLD;
  }

  /**
   * Get user's coach count
   */
  async getUserCoachCount(userId: string): Promise<number> {
    return Coach.countDocuments({
      createdBy: new Types.ObjectId(userId),
    });
  }
}

export const avatarService = new AvatarService();
