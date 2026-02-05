/**
 * Avatar Service
 * Handles avatar retrieval, matching, and assignment logic
 */

import { Avatar, IAvatar } from '../models/Avatar';
import { Coach } from '../models/Coach';
import { Types } from 'mongoose';
import { logger } from '../config/logger';
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
   * Match avatars to coach description using fast rule-based matching
   * Returns top 5 matches ranked by relevance score
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
      logger.info('[AvatarMatch] Starting fast rule-based matching', {
        coachName: extractedData.name,
        category: extractedData.category,
        suggestedStyle: extractedData.suggestedAvatarStyle,
      });

      // For anonymous users, skip user-based filtering
      const isAnonymous = userId === 'anonymous' || !Types.ObjectId.isValid(userId);
      let avatars: IAvatar[];

      if (isAnonymous) {
        // Anonymous users get all active avatars
        avatars = await Avatar.find({ isActive: true }).limit(100);
      } else {
        const userObjectId = new Types.ObjectId(userId);
        const coachCount = await this.getUserCoachCount(userId);
        const canReuse = coachCount >= REUSE_THRESHOLD;

        // Fetch available avatars
        const query: Record<string, unknown> = { isActive: true };
        if (!canReuse) {
          query.users = { $ne: userObjectId };
        }

        avatars = await Avatar.find(query).limit(100);

        // Fallback: if no available avatars, use all
        if (avatars.length === 0 && !canReuse) {
          avatars = await Avatar.find({ isActive: true }).limit(100);
        }
      }

      if (avatars.length === 0) {
        return [];
      }

      // Parse suggested style into keywords
      const styleKeywords = this.parseStyleKeywords(extractedData.suggestedAvatarStyle || '');
      const coachCategory = extractedData.category.toLowerCase();

      // Score each avatar
      const scoredAvatars = avatars.map((avatar) => {
        let score = 0;

        // Category match (highest weight)
        if (avatar.category.toLowerCase() === coachCategory) {
          score += 50;
        }

        // Gender match
        if (styleKeywords.gender && avatar.characteristics.gender.toLowerCase() === styleKeywords.gender) {
          score += 30;
        }

        // Age range match
        if (styleKeywords.ageRange && avatar.characteristics.ageRange.toLowerCase().includes(styleKeywords.ageRange)) {
          score += 20;
        }

        // Style keywords match
        const avatarDesc = `${avatar.characteristicsDescription} ${avatar.characteristics.style} ${avatar.characteristics.vibe} ${avatar.tags.join(' ')}`.toLowerCase();
        for (const keyword of styleKeywords.keywords) {
          if (avatarDesc.includes(keyword)) {
            score += 10;
          }
        }

        // Prefer avatars with lower usage (for variety)
        if (avatar.activeUsersCount < 5) {
          score += 5;
        }

        return { avatar, score };
      });

      // Sort by score (descending) and take top 5
      scoredAvatars.sort((a, b) => b.score - a.score);
      const topMatches = scoredAvatars.slice(0, 5).map((s) => this.sanitizeAvatar(s.avatar));

      logger.info('[AvatarMatch] Fast matching complete', {
        matchCount: topMatches.length,
        topScore: scoredAvatars[0]?.score,
      });

      return topMatches;
    } catch (error) {
      logger.error('[AvatarMatch] Error:', {
        message: error instanceof Error ? error.message : 'Unknown error',
      });

      // Fallback: return random available avatars
      const fallbackAvatars = await Avatar.find({ isActive: true }).limit(5);
      return fallbackAvatars.map((a) => this.sanitizeAvatar(a));
    }
  }

  /**
   * Parse suggested avatar style string into keywords for matching
   */
  private parseStyleKeywords(style: string): {
    gender: string | null;
    ageRange: string | null;
    keywords: string[];
  } {
    const lowered = style.toLowerCase();

    // Detect gender
    let gender: string | null = null;
    if (lowered.includes('female') || lowered.includes('woman')) {
      gender = 'female';
    } else if (lowered.includes('male') || lowered.includes('man')) {
      gender = 'male';
    }

    // Detect age range
    let ageRange: string | null = null;
    if (lowered.includes('20s') || lowered.includes('young')) {
      ageRange = '20s';
    } else if (lowered.includes('30s')) {
      ageRange = '30s';
    } else if (lowered.includes('40s') || lowered.includes('middle')) {
      ageRange = '40s';
    } else if (lowered.includes('50s') || lowered.includes('mature') || lowered.includes('senior')) {
      ageRange = '50s';
    }

    // Extract other keywords
    const keywords = lowered
      .split(/[\s,]+/)
      .filter((w) => w.length > 3)
      .filter((w) => !['male', 'female', 'woman', 'man', 'with', 'and', 'the'].includes(w));

    return { gender, ageRange, keywords };
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
