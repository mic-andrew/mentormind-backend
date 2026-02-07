/**
 * Review Service
 * Business logic for coach reviews
 */

import { Types } from 'mongoose';
import { Review } from '../models/Review';
import { Coach } from '../models/Coach';
import { User } from '../models/User';
import { logger } from '../config/logger';

interface CreateReviewData {
  rating: number;
  content: string;
  sessionId?: string;
}

class ReviewService {
  async createReview(userId: string, coachId: string, data: CreateReviewData) {
    if (!Types.ObjectId.isValid(coachId)) {
      throw new Error('INVALID_COACH_ID');
    }

    const coach = await Coach.findById(coachId);
    if (!coach) {
      throw new Error('COACH_NOT_FOUND');
    }

    if (coach.createdBy.toString() === userId) {
      throw new Error('CANNOT_REVIEW_OWN_COACH');
    }

    const existing = await Review.findOne({
      userId: new Types.ObjectId(userId),
      coachId: new Types.ObjectId(coachId),
    });
    if (existing) {
      throw new Error('ALREADY_REVIEWED');
    }

    const review = await Review.create({
      userId: new Types.ObjectId(userId),
      coachId: new Types.ObjectId(coachId),
      sessionId: data.sessionId ? new Types.ObjectId(data.sessionId) : undefined,
      rating: data.rating,
      content: data.content,
    });

    await this.recalculateCoachRating(coachId);

    logger.info(`Review created for coach ${coachId} by user ${userId}`);

    return this.sanitizeReview(review, userId);
  }

  async getCoachReviews(coachId: string, page = 1, limit = 10) {
    if (!Types.ObjectId.isValid(coachId)) {
      throw new Error('INVALID_COACH_ID');
    }

    const skip = (page - 1) * limit;
    const coachObjectId = new Types.ObjectId(coachId);

    const [reviews, total] = await Promise.all([
      Review.find({ coachId: coachObjectId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Review.countDocuments({ coachId: coachObjectId }),
    ]);

    const userIds = reviews.map((r) => r.userId);
    const users = await User.find({ _id: { $in: userIds } })
      .select('firstName lastName picture')
      .lean();
    const userMap = new Map(users.map((u) => [u._id.toString(), u]));

    const sanitized = reviews.map((review) => {
      const user = userMap.get(review.userId.toString());
      const firstName = user?.firstName || 'Anonymous';
      const lastName = user?.lastName || '';
      const userName = lastName ? `${firstName} ${lastName.charAt(0)}.` : firstName;
      const initials = `${firstName.charAt(0)}${lastName ? lastName.charAt(0) : ''}`.toUpperCase();

      return {
        id: review._id.toString(),
        userId: review.userId.toString(),
        userName,
        userAvatar: user?.picture || undefined,
        userInitials: initials,
        coachId: review.coachId.toString(),
        rating: review.rating,
        content: review.content,
        createdAt: review.createdAt.toISOString(),
      };
    });

    return {
      reviews: sanitized,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async deleteReview(reviewId: string, userId: string) {
    if (!Types.ObjectId.isValid(reviewId)) {
      throw new Error('INVALID_REVIEW_ID');
    }

    const review = await Review.findById(reviewId);
    if (!review) {
      throw new Error('REVIEW_NOT_FOUND');
    }

    if (review.userId.toString() !== userId) {
      throw new Error('UNAUTHORIZED');
    }

    const coachId = review.coachId.toString();
    await Review.deleteOne({ _id: review._id });

    await this.recalculateCoachRating(coachId);

    logger.info(`Review ${reviewId} deleted by user ${userId}`);

    return { message: 'Review deleted' };
  }

  async getUserReviewForCoach(userId: string, coachId: string) {
    if (!Types.ObjectId.isValid(coachId) || !Types.ObjectId.isValid(userId)) {
      return null;
    }

    const review = await Review.findOne({
      userId: new Types.ObjectId(userId),
      coachId: new Types.ObjectId(coachId),
    }).lean();

    if (!review) return null;

    return {
      id: review._id.toString(),
      userId: review.userId.toString(),
      coachId: review.coachId.toString(),
      rating: review.rating,
      content: review.content,
      createdAt: review.createdAt.toISOString(),
    };
  }

  private async recalculateCoachRating(coachId: string) {
    const result = await Review.aggregate([
      { $match: { coachId: new Types.ObjectId(coachId) } },
      {
        $group: {
          _id: null,
          avgRating: { $avg: '$rating' },
          count: { $sum: 1 },
        },
      },
    ]);

    if (result.length > 0) {
      const avgRating = Math.round(result[0].avgRating * 10) / 10;
      await Coach.findByIdAndUpdate(coachId, {
        rating: avgRating,
        reviewCount: result[0].count,
      });
    } else {
      await Coach.findByIdAndUpdate(coachId, {
        rating: 0,
        reviewCount: 0,
      });
    }
  }

  private async sanitizeReview(review: any, userId: string) {
    const user = await User.findById(userId).select('firstName lastName picture').lean();
    const firstName = user?.firstName || 'Anonymous';
    const lastName = user?.lastName || '';
    const userName = lastName ? `${firstName} ${lastName.charAt(0)}.` : firstName;
    const initials = `${firstName.charAt(0)}${lastName ? lastName.charAt(0) : ''}`.toUpperCase();

    return {
      id: review._id.toString(),
      userId: review.userId.toString(),
      userName,
      userAvatar: user?.picture || undefined,
      userInitials: initials,
      coachId: review.coachId.toString(),
      rating: review.rating,
      content: review.content,
      createdAt: review.createdAt.toISOString(),
    };
  }
}

export const reviewService = new ReviewService();
