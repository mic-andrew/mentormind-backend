/**
 * Coach Service
 * Handles all coach-related business logic including sharing
 */

import { Coach, ICoach, CoachCategory, generateAvatarUrl } from '../models/Coach';
import { SharedCoach, SharePermission } from '../models/SharedCoach';
import { Avatar } from '../models/Avatar';
import { User } from '../models/User';
import { Types } from 'mongoose';
import { logger } from '../config/logger';
import { emailService } from './emailService';
import { notificationService } from './notificationService';
import { env } from '../config/env';
import { subscriptionService } from './subscriptionService';

interface CreateCoachData {
  name: string;
  avatar?: string;
  avatarId?: string;
  specialty: string;
  category: CoachCategory;
  description: string;
  bio: string;
  coachingStyle?: string[];
  systemPrompt: string;
  tone?: string;
  methodology?: string;
  sampleTopics?: Array<{
    id: string;
    icon: string;
    title: string;
    description: string;
  }>;
  conversationStarters?: string[];
  isAI?: boolean;
  creditCost?: number;
  tags?: string[];
  targetAudience?: string;
  knowledgeBase?: string;
}

interface UpdateCoachData extends Partial<CreateCoachData> {
  isPublished?: boolean;
  isFeatured?: boolean;
}

interface CoachFilters {
  category?: CoachCategory | 'all';
  search?: string;
  isPublished?: boolean;
  isFeatured?: boolean;
  createdBy?: string;
  page?: number;
  limit?: number;
}

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface ShareCoachData {
  email: string;
  permission: SharePermission;
}

class CoachService {
  /**
   * Sanitize coach for API response (includes ownership info)
   */
  private sanitizeCoach(coach: ICoach, userId?: string, shareInfo?: { permission: SharePermission; isOwner: boolean }) {
    const isOwner = shareInfo?.isOwner ?? (userId ? this.isOwner(coach, userId) : false);

    return {
      id: coach._id.toString(),
      name: coach.name,
      avatar: coach.avatar,
      specialty: coach.specialty,
      category: coach.category,
      description: coach.description,
      bio: coach.bio,
      coachingStyle: coach.coachingStyle,
      systemPrompt: coach.systemPrompt,
      tone: coach.tone,
      methodology: coach.methodology,
      sampleTopics: coach.sampleTopics,
      conversationStarters: coach.conversationStarters,
      rating: coach.rating,
      sessionsCount: coach.sessionsCount,
      isVerified: coach.isVerified,
      isAI: coach.isAI,
      isPublished: coach.isPublished,
      isFeatured: coach.isFeatured,
      createdBy: coach.createdBy === 'system' ? 'system' : coach.createdBy.toString(),
      creditCost: coach.creditCost,
      popularityScore: coach.popularityScore,
      tags: coach.tags,
      targetAudience: coach.targetAudience,
      language: coach.language,
      activeUsersCount: coach.activeUsersCount,
      createdAt: coach.createdAt.toISOString(),
      updatedAt: coach.updatedAt.toISOString(),
      // Access info
      isOwner,
      permission: shareInfo?.permission || (isOwner ? 'edit' : undefined),
    };
  }

  /**
   * Sanitize coach for public API (excludes system prompt and internal fields)
   */
  private sanitizeCoachPublic(coach: ICoach) {
    return {
      id: coach._id.toString(),
      name: coach.name,
      avatar: coach.avatar,
      specialty: coach.specialty,
      category: coach.category,
      description: coach.description,
      bio: coach.bio,
      coachingStyle: coach.coachingStyle,
      sampleTopics: coach.sampleTopics,
      rating: coach.rating,
      sessionsCount: coach.sessionsCount,
      isVerified: coach.isVerified,
      isAI: coach.isAI,
      isFeatured: coach.isFeatured,
      creditCost: coach.creditCost,
      tags: coach.tags,
      targetAudience: coach.targetAudience,
      language: coach.language,
      createdAt: coach.createdAt.toISOString(),
      updatedAt: coach.updatedAt.toISOString(),
    };
  }

  /**
   * Check if user is owner of a coach
   */
  private isOwner(coach: ICoach, userId: string): boolean {
    if (coach.createdBy === 'system') return false;
    return coach.createdBy.toString() === userId;
  }

  /**
   * Check if user has access to a coach (owner or shared with)
   */
  private async checkAccess(coachId: string, userId: string, requiredPermission: SharePermission = 'view'): Promise<{ hasAccess: boolean; isOwner: boolean; permission?: SharePermission }> {
    const coach = await Coach.findById(coachId);
    if (!coach) {
      return { hasAccess: false, isOwner: false };
    }

    // System coaches are accessible to everyone
    if (coach.createdBy === 'system' && coach.isPublished) {
      return { hasAccess: true, isOwner: false, permission: 'use' };
    }

    // Check if owner
    if (this.isOwner(coach, userId)) {
      return { hasAccess: true, isOwner: true, permission: 'edit' };
    }

    // Check if shared with user
    const user = await User.findById(userId);
    if (!user) {
      return { hasAccess: false, isOwner: false };
    }

    const share = await SharedCoach.findOne({
      coachId: new Types.ObjectId(coachId),
      $or: [
        { sharedWithUserId: new Types.ObjectId(userId) },
        { sharedWithEmail: user.email.toLowerCase() },
      ],
      status: 'accepted',
    });

    if (!share) {
      return { hasAccess: false, isOwner: false };
    }

    // Check permission level
    const permissionLevels: Record<SharePermission, number> = { view: 1, use: 2, edit: 3 };
    const hasRequiredPermission = permissionLevels[share.permission] >= permissionLevels[requiredPermission];

    return { hasAccess: hasRequiredPermission, isOwner: false, permission: share.permission };
  }

  /**
   * Get all published coaches with filters and pagination
   */
  async getCoaches(filters: CoachFilters): Promise<PaginatedResponse<ReturnType<typeof this.sanitizeCoachPublic>>> {
    const { category, search, isPublished = true, isFeatured, page = 1, limit = 20 } = filters;

    const query: Record<string, unknown> = {};

    // Only show published coaches in public queries
    if (isPublished !== undefined) {
      query.isPublished = isPublished;
    }

    // Category filter
    if (category && category !== 'all') {
      query.category = category;
    }

    // Featured filter
    if (isFeatured !== undefined) {
      query.isFeatured = isFeatured;
    }

    // Build search query
    let searchQuery = {};
    if (search && search.trim()) {
      searchQuery = { $text: { $search: search } };
    }

    const skip = (page - 1) * limit;

    const [coaches, total] = await Promise.all([
      Coach.find({ ...query, ...searchQuery })
        .sort({ isFeatured: -1, popularityScore: -1, rating: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Coach.countDocuments({ ...query, ...searchQuery }),
    ]);

    return {
      data: coaches.map((coach) => this.sanitizeCoachPublic(coach)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get featured coaches
   */
  async getFeaturedCoaches(limit: number = 6) {
    const coaches = await Coach.find({
      isPublished: true,
      isFeatured: true,
    })
      .sort({ popularityScore: -1, rating: -1 })
      .limit(limit);

    return coaches.map((coach) => this.sanitizeCoachPublic(coach));
  }

  /**
   * Get a single coach by ID (public view for published coaches)
   */
  async getCoachById(id: string, userId?: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new Error('INVALID_COACH_ID');
    }

    const coach = await Coach.findById(id);
    if (!coach) {
      throw new Error('COACH_NOT_FOUND');
    }

    // If published and system coach, return public view
    if (coach.isPublished && coach.createdBy === 'system') {
      return this.sanitizeCoachPublic(coach);
    }

    // For user-created coaches, check access
    if (userId) {
      const access = await this.checkAccess(id, userId);
      if (access.hasAccess) {
        return this.sanitizeCoach(coach, userId, { permission: access.permission!, isOwner: access.isOwner });
      }
    }

    // If published, show public view
    if (coach.isPublished) {
      return this.sanitizeCoachPublic(coach);
    }

    throw new Error('COACH_NOT_FOUND');
  }

  /**
   * Get coach with system prompt (for AI sessions)
   */
  async getCoachForSession(id: string, userId: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new Error('INVALID_COACH_ID');
    }

    const coach = await Coach.findById(id);
    if (!coach) {
      throw new Error('COACH_NOT_FOUND');
    }

    // Check access for session (need at least 'use' permission)
    const access = await this.checkAccess(id, userId, 'use');
    if (!access.hasAccess) {
      throw new Error('FORBIDDEN');
    }

    // Increment session count
    coach.sessionsCount += 1;
    coach.lastUsedAt = new Date();
    await coach.save();

    return this.sanitizeCoach(coach, userId, { permission: access.permission!, isOwner: access.isOwner });
  }

  /**
   * Create a new coach (user-created or system)
   */
  async createCoach(data: CreateCoachData, createdBy: 'system' | string) {
    const bucketUrl = process.env.S3_BUCKET_URL || 'https://mentormind-assets.s3.amazonaws.com';
    const isSystem = createdBy === 'system';

    // Check free tier coach creation limit (skip for system-created coaches)
    if (!isSystem) {
      const canCreate = await subscriptionService.canCreateCoach(createdBy);
      if (!canCreate) {
        throw new Error('COACH_LIMIT_EXCEEDED');
      }
    }

    let avatar = data.avatar || generateAvatarUrl(data.name, bucketUrl);
    let avatarId: Types.ObjectId | undefined;

    // If avatarId is provided, resolve the avatar image URL from the Avatar collection
    if (data.avatarId && Types.ObjectId.isValid(data.avatarId)) {
      const avatarDoc = await Avatar.findById(data.avatarId);
      if (avatarDoc) {
        avatar = avatarDoc.avatarImage;
        avatarId = avatarDoc._id as Types.ObjectId;

        // Assign avatar to user (track usage)
        if (!isSystem) {
          const userObjectId = new Types.ObjectId(createdBy);
          const alreadyAssigned = avatarDoc.users.some(
            (u) => u.toString() === createdBy
          );
          if (!alreadyAssigned) {
            await Avatar.findByIdAndUpdate(data.avatarId, {
              $addToSet: { users: userObjectId },
              $inc: { activeUsersCount: 1 },
            });
          }
        }
      }
    }

    const coach = await Coach.create({
      ...data,
      avatar,
      avatarId,
      createdBy: isSystem ? 'system' : new Types.ObjectId(createdBy),
      isVerified: isSystem,
      isPublished: isSystem, // User coaches start unpublished (only visible to owner/shared)
      moderationStatus: isSystem ? 'approved' : 'pending',
    });

    logger.info(`Coach created: ${coach.name} (${coach._id}) by ${createdBy}`);
    return this.sanitizeCoach(coach, isSystem ? undefined : createdBy, { permission: 'edit', isOwner: !isSystem });
  }

  /**
   * Update a coach
   */
  async updateCoach(id: string, data: UpdateCoachData, userId: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new Error('INVALID_COACH_ID');
    }

    const coach = await Coach.findById(id);
    if (!coach) {
      throw new Error('COACH_NOT_FOUND');
    }

    // Check edit permission
    const access = await this.checkAccess(id, userId, 'edit');
    if (!access.hasAccess) {
      throw new Error('FORBIDDEN');
    }

    // System coaches can't be edited by regular users
    if (coach.createdBy === 'system') {
      throw new Error('CANNOT_EDIT_SYSTEM_COACH');
    }

    // Update version if system prompt changed
    if (data.systemPrompt && data.systemPrompt !== coach.systemPrompt) {
      coach.version += 1;
    }

    Object.assign(coach, data);
    await coach.save();

    logger.info(`Coach updated: ${coach.name} (${coach._id}) by ${userId}`);
    return this.sanitizeCoach(coach, userId, { permission: 'edit', isOwner: access.isOwner });
  }

  /**
   * Delete a coach
   */
  async deleteCoach(id: string, userId: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new Error('INVALID_COACH_ID');
    }

    const coach = await Coach.findById(id);
    if (!coach) {
      throw new Error('COACH_NOT_FOUND');
    }

    // Only owner can delete
    if (!this.isOwner(coach, userId)) {
      throw new Error('FORBIDDEN');
    }

    // Don't allow deletion of system coaches
    if (coach.createdBy === 'system') {
      throw new Error('CANNOT_DELETE_SYSTEM_COACH');
    }

    // Delete all shares
    await SharedCoach.deleteMany({ coachId: new Types.ObjectId(id) });

    // Delete the coach
    await Coach.findByIdAndDelete(id);
    logger.info(`Coach deleted: ${coach.name} (${coach._id}) by ${userId}`);

    return { message: 'Coach deleted successfully' };
  }

  /**
   * Get coaches created by the user + coaches shared with them
   */
  async getMyCoaches(userId: string, page: number = 1, limit: number = 20) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new Error('INVALID_USER_ID');
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }

    const skip = (page - 1) * limit;
    const userObjectId = new Types.ObjectId(userId);

    // Get coaches owned by user
    const ownedCoaches = await Coach.find({ createdBy: userObjectId })
      .sort({ updatedAt: -1 });

    // Get coaches shared with user (accepted)
    const shares = await SharedCoach.find({
      $or: [
        { sharedWithUserId: userObjectId },
        { sharedWithEmail: user.email.toLowerCase() },
      ],
      status: 'accepted',
    }).populate('coachId');

    // Combine and dedupe
    const ownedCoachesData = ownedCoaches.map((coach) => ({
      ...this.sanitizeCoach(coach, userId, { permission: 'edit', isOwner: true }),
      shareType: 'owned' as const,
    }));

    const sharedCoachesData = shares
      .filter((share) => share.coachId) // Filter out any null references
      .map((share) => ({
        ...this.sanitizeCoach(share.coachId as unknown as ICoach, userId, { permission: share.permission, isOwner: false }),
        shareType: 'shared' as const,
        sharedBy: share.ownerId.toString(),
      }));

    const allCoaches = [...ownedCoachesData, ...sharedCoachesData];

    // Sort by updatedAt
    allCoaches.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    // Paginate
    const paginatedCoaches = allCoaches.slice(skip, skip + limit);

    return {
      data: paginatedCoaches,
      total: allCoaches.length,
      page,
      limit,
      totalPages: Math.ceil(allCoaches.length / limit),
    };
  }

  /**
   * Share a coach with another user
   */
  async shareCoach(coachId: string, ownerId: string, data: ShareCoachData) {
    if (!Types.ObjectId.isValid(coachId)) {
      throw new Error('INVALID_COACH_ID');
    }

    const coach = await Coach.findById(coachId);
    if (!coach) {
      throw new Error('COACH_NOT_FOUND');
    }

    // Only owner can share
    if (!this.isOwner(coach, ownerId)) {
      throw new Error('FORBIDDEN');
    }

    // Can't share system coaches
    if (coach.createdBy === 'system') {
      throw new Error('CANNOT_SHARE_SYSTEM_COACH');
    }

    const email = data.email.toLowerCase().trim();

    // Can't share with yourself
    const owner = await User.findById(ownerId);
    if (owner && owner.email.toLowerCase() === email) {
      throw new Error('CANNOT_SHARE_WITH_SELF');
    }

    // Check if already shared
    const existingShare = await SharedCoach.findOne({
      coachId: new Types.ObjectId(coachId),
      sharedWithEmail: email,
    });

    if (existingShare) {
      // Update existing share
      existingShare.permission = data.permission;
      existingShare.status = 'pending';
      existingShare.sharedAt = new Date();
      await existingShare.save();

      logger.info(`Coach share updated: ${coach.name} -> ${email}`);
      return {
        id: existingShare._id.toString(),
        coachId: coachId,
        email: email,
        permission: existingShare.permission,
        status: existingShare.status,
        sharedAt: existingShare.sharedAt.toISOString(),
      };
    }

    // Check if recipient exists
    const recipient = await User.findOne({ email });

    // Create new share
    const share = await SharedCoach.create({
      coachId: new Types.ObjectId(coachId),
      ownerId: new Types.ObjectId(ownerId),
      sharedWithEmail: email,
      sharedWithUserId: recipient?._id,
      permission: data.permission,
      status: 'pending',
    });

    logger.info(`Coach shared: ${coach.name} -> ${email}`);

    // Send email notification based on whether recipient is a user
    if (recipient) {
      // Existing user - send notification
      emailService.sendCoachShareNotification({
        to: email,
        recipientName: recipient.firstName || 'there',
        senderName: owner?.firstName || 'A user',
        coachName: coach.name,
        coachSpecialty: coach.specialty,
        coachBio: coach.bio,
        coachAvatar: coach.avatar,
        permissionLevel: data.permission,
        coachUrl: `${env.frontendUrl}/coaches/${coachId}`,
      }).catch((err) => logger.error('Failed to send coach share notification:', err));

      // Create in-app notification for existing user
      notificationService.createCoachShareNotification(
        recipient._id.toString(),
        ownerId,
        coachId,
        coach.name,
        share._id.toString()
      ).catch((err) => logger.error('Failed to create share notification:', err));
    } else {
      // New user - send invitation
      emailService.sendCoachInvitation({
        to: email,
        senderName: owner?.firstName || 'A user',
        senderEmail: owner?.email || '',
        coachName: coach.name,
        coachSpecialty: coach.specialty,
        coachBio: coach.bio,
        coachAvatar: coach.avatar,
        acceptUrl: `${env.frontendUrl}/signup?invite=${share._id}`,
      }).catch((err) => logger.error('Failed to send coach invitation:', err));
    }

    return {
      id: share._id.toString(),
      coachId: coachId,
      email: email,
      permission: share.permission,
      status: share.status,
      sharedAt: share.sharedAt.toISOString(),
    };
  }

  /**
   * Accept a coach share invitation
   */
  async acceptShare(shareId: string, userId: string) {
    if (!Types.ObjectId.isValid(shareId)) {
      throw new Error('INVALID_SHARE_ID');
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }

    const share = await SharedCoach.findOne({
      _id: new Types.ObjectId(shareId),
      $or: [
        { sharedWithUserId: new Types.ObjectId(userId) },
        { sharedWithEmail: user.email.toLowerCase() },
      ],
      status: 'pending',
    });

    if (!share) {
      throw new Error('SHARE_NOT_FOUND');
    }

    share.status = 'accepted';
    share.acceptedAt = new Date();
    share.sharedWithUserId = new Types.ObjectId(userId);
    await share.save();

    logger.info(`Share accepted: ${shareId} by ${userId}`);

    // Notify the coach owner
    const coach = await Coach.findById(share.coachId);
    if (coach) {
      notificationService.createCoachAcceptedNotification(
        share.ownerId.toString(),
        userId,
        share.coachId.toString(),
        coach.name
      ).catch((err) => logger.error('Failed to create accept notification:', err));
    }

    return { message: 'Share invitation accepted' };
  }

  /**
   * Decline a coach share invitation
   */
  async declineShare(shareId: string, userId: string) {
    if (!Types.ObjectId.isValid(shareId)) {
      throw new Error('INVALID_SHARE_ID');
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }

    const share = await SharedCoach.findOne({
      _id: new Types.ObjectId(shareId),
      $or: [
        { sharedWithUserId: new Types.ObjectId(userId) },
        { sharedWithEmail: user.email.toLowerCase() },
      ],
      status: 'pending',
    });

    if (!share) {
      throw new Error('SHARE_NOT_FOUND');
    }

    share.status = 'declined';
    await share.save();

    logger.info(`Share declined: ${shareId} by ${userId}`);

    // Notify the coach owner
    const coach = await Coach.findById(share.coachId);
    if (coach) {
      notificationService.createCoachDeclinedNotification(
        share.ownerId.toString(),
        userId,
        share.coachId.toString(),
        coach.name
      ).catch((err) => logger.error('Failed to create decline notification:', err));
    }

    return { message: 'Share invitation declined' };
  }

  /**
   * Revoke a coach share
   */
  async revokeShare(coachId: string, shareId: string, ownerId: string) {
    if (!Types.ObjectId.isValid(coachId) || !Types.ObjectId.isValid(shareId)) {
      throw new Error('INVALID_ID');
    }

    const coach = await Coach.findById(coachId);
    if (!coach) {
      throw new Error('COACH_NOT_FOUND');
    }

    // Only owner can revoke
    if (!this.isOwner(coach, ownerId)) {
      throw new Error('FORBIDDEN');
    }

    const share = await SharedCoach.findOne({
      _id: new Types.ObjectId(shareId),
      coachId: new Types.ObjectId(coachId),
    });

    if (!share) {
      throw new Error('SHARE_NOT_FOUND');
    }

    share.status = 'revoked';
    await share.save();

    logger.info(`Share revoked: ${shareId} by ${ownerId}`);

    return { message: 'Share revoked successfully' };
  }

  /**
   * Get all shares for a coach
   */
  async getCoachShares(coachId: string, ownerId: string) {
    if (!Types.ObjectId.isValid(coachId)) {
      throw new Error('INVALID_COACH_ID');
    }

    const coach = await Coach.findById(coachId);
    if (!coach) {
      throw new Error('COACH_NOT_FOUND');
    }

    // Only owner can view shares
    if (!this.isOwner(coach, ownerId)) {
      throw new Error('FORBIDDEN');
    }

    const shares = await SharedCoach.find({
      coachId: new Types.ObjectId(coachId),
      status: { $ne: 'declined' },
    }).sort({ sharedAt: -1 });

    return shares.map((share) => ({
      id: share._id.toString(),
      email: share.sharedWithEmail,
      permission: share.permission,
      status: share.status,
      sharedAt: share.sharedAt.toISOString(),
      acceptedAt: share.acceptedAt?.toISOString(),
    }));
  }

  /**
   * Get pending share invitations for a user
   */
  async getPendingShares(userId: string) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new Error('INVALID_USER_ID');
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }

    const shares = await SharedCoach.find({
      $or: [
        { sharedWithUserId: new Types.ObjectId(userId) },
        { sharedWithEmail: user.email.toLowerCase() },
      ],
      status: 'pending',
    })
      .populate('coachId', 'name avatar specialty')
      .populate('ownerId', 'firstName lastName email')
      .sort({ sharedAt: -1 });

    return shares.map((share) => {
      const coach = share.coachId as unknown as { _id: Types.ObjectId; name: string; avatar: string; specialty: string };
      const owner = share.ownerId as unknown as { _id: Types.ObjectId; firstName: string; lastName: string; email: string };

      return {
        id: share._id.toString(),
        coach: coach ? {
          id: coach._id.toString(),
          name: coach.name,
          avatar: coach.avatar,
          specialty: coach.specialty,
        } : null,
        sharedBy: owner ? {
          id: owner._id.toString(),
          name: `${owner.firstName} ${owner.lastName}`.trim(),
          email: owner.email,
        } : null,
        permission: share.permission,
        sharedAt: share.sharedAt.toISOString(),
      };
    });
  }

  /**
   * Get coach categories with counts
   */
  async getCategories() {
    const categories = await Coach.aggregate([
      { $match: { isPublished: true } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    const totalCount = await Coach.countDocuments({ isPublished: true });

    return [
      { value: 'all', label: 'All', count: totalCount },
      ...categories.map((cat) => ({
        value: cat._id,
        label: cat._id.charAt(0).toUpperCase() + cat._id.slice(1),
        count: cat.count,
      })),
    ];
  }

  /**
   * Increment active users count
   */
  async incrementActiveUsers(coachId: string) {
    if (!Types.ObjectId.isValid(coachId)) {
      return;
    }

    await Coach.findByIdAndUpdate(coachId, {
      $inc: { activeUsersCount: 1 },
      lastUsedAt: new Date(),
    });
  }

  /**
   * Update coach rating (called after review)
   */
  async updateRating(coachId: string, newRating: number) {
    if (!Types.ObjectId.isValid(coachId)) {
      throw new Error('INVALID_COACH_ID');
    }

    const coach = await Coach.findById(coachId);
    if (!coach) {
      throw new Error('COACH_NOT_FOUND');
    }

    const totalSessions = coach.sessionsCount || 1;
    const currentTotal = coach.rating * totalSessions;
    const newAverage = (currentTotal + newRating) / (totalSessions + 1);

    coach.rating = Math.round(newAverage * 10) / 10;
    await coach.save();

    return coach.rating;
  }

  /**
   * Flag a coach for review
   */
  async flagCoach(coachId: string) {
    if (!Types.ObjectId.isValid(coachId)) {
      throw new Error('INVALID_COACH_ID');
    }

    await Coach.findByIdAndUpdate(coachId, {
      $inc: { flagCount: 1 },
    });

    return { message: 'Coach flagged for review' };
  }
}

export const coachService = new CoachService();
