/**
 * Coach Model (MongoDB/Mongoose)
 * Represents AI coach personas in the marketplace
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

// Coach category enum
export const CoachCategories = [
  'productivity',
  'health',
  'business',
  'finance',
  'mindfulness',
  'career',
  'fitness',
  'marketing',
  'systems',
  'custom',
] as const;

export type CoachCategory = (typeof CoachCategories)[number];

// Coach tone enum
export const CoachTones = ['professional', 'casual', 'warm', 'direct', 'challenging'] as const;

export type CoachTone = (typeof CoachTones)[number];

// Coaching style tags
export const CoachingStyleTags = [
  'Analytical',
  'Direct Feedback',
  'Science-Based',
  'Empathetic',
  'Goal-Oriented',
  'Holistic',
  'Supportive',
  'Socratic',
] as const;

export type CoachingStyleTag = (typeof CoachingStyleTags)[number];

// Moderation status for user-created coaches
export const ModerationStatuses = ['approved', 'pending', 'rejected'] as const;

export type ModerationStatus = (typeof ModerationStatuses)[number];

// Sample topic interface
export interface ISampleTopic {
  id: string;
  icon: string;
  title: string;
  description: string;
}

// Coach document interface
export interface ICoach extends Document {
  // Identity & Presentation
  name: string;
  avatar: string;
  avatarId?: Types.ObjectId;
  specialty: string;
  category: CoachCategory;
  description: string;
  bio: string;
  coachingStyle: CoachingStyleTag[];

  // AI Behavior Configuration
  systemPrompt: string;
  tone: CoachTone;
  methodology?: string;

  // Conversation Guides
  sampleTopics: ISampleTopic[];
  conversationStarters: string[];

  // Social & Metadata
  rating: number;
  sessionsCount: number;
  isVerified: boolean;
  isAI: boolean;
  isPublished: boolean;
  isFeatured: boolean;
  createdBy: 'system' | Types.ObjectId;
  creditCost: number;

  // Discovery & Personalization
  popularityScore: number;
  tags: string[];
  targetAudience?: string;
  language: string;

  // Usage Tracking
  lastUsedAt?: Date;
  activeUsersCount: number;

  // Coach Relationships
  relatedCoaches: Types.ObjectId[];

  // Customization (for user-created coaches)
  knowledgeBase?: string;

  // Quality & Moderation
  moderationStatus: ModerationStatus;
  flagCount: number;
  lastReviewedAt?: Date;

  // Versioning
  version: number;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

// Sample topic schema
const SampleTopicSchema = new Schema<ISampleTopic>(
  {
    id: { type: String, required: true },
    icon: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
  },
  { _id: false }
);

// Coach schema
const CoachSchema = new Schema<ICoach>(
  {
    // Identity & Presentation
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    avatar: {
      type: String,
      required: true,
    },
    avatarId: {
      type: Schema.Types.ObjectId,
      ref: 'Avatar',
    },
    specialty: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    category: {
      type: String,
      required: true,
      enum: CoachCategories,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    bio: {
      type: String,
      required: true,
      maxlength: 2000,
    },
    coachingStyle: {
      type: [String],
      enum: CoachingStyleTags,
      default: [],
    },

    // AI Behavior Configuration
    systemPrompt: {
      type: String,
      required: true,
    },
    tone: {
      type: String,
      enum: CoachTones,
      default: 'professional',
    },
    methodology: {
      type: String,
    },

    // Conversation Guides
    sampleTopics: {
      type: [SampleTopicSchema],
      default: [],
    },
    conversationStarters: {
      type: [String],
      default: [],
    },

    // Social & Metadata
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    sessionsCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isAI: {
      type: Boolean,
      default: true,
    },
    isPublished: {
      type: Boolean,
      default: false,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: Schema.Types.Mixed,
      required: true,
    },
    creditCost: {
      type: Number,
      default: 1,
      min: 0,
    },

    // Discovery & Personalization
    popularityScore: {
      type: Number,
      default: 0,
    },
    tags: {
      type: [String],
      default: [],
    },
    targetAudience: {
      type: String,
    },
    language: {
      type: String,
      default: 'English',
    },

    // Usage Tracking
    lastUsedAt: {
      type: Date,
    },
    activeUsersCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Coach Relationships
    relatedCoaches: {
      type: [Schema.Types.ObjectId],
      ref: 'Coach',
      default: [],
    },

    // Customization
    knowledgeBase: {
      type: String,
    },

    // Quality & Moderation
    moderationStatus: {
      type: String,
      enum: ModerationStatuses,
      default: 'pending',
    },
    flagCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastReviewedAt: {
      type: Date,
    },

    // Versioning
    version: {
      type: Number,
      default: 1,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for performance
CoachSchema.index({ category: 1 });
CoachSchema.index({ isPublished: 1 });
CoachSchema.index({ category: 1, isPublished: 1 });
CoachSchema.index({ createdBy: 1 });
CoachSchema.index({ isFeatured: 1, isPublished: 1 });
CoachSchema.index({ popularityScore: -1 });
CoachSchema.index({ rating: -1 });
CoachSchema.index({ moderationStatus: 1 });

// Text index for search
CoachSchema.index(
  { name: 'text', specialty: 'text', description: 'text', bio: 'text', tags: 'text' },
  { weights: { name: 10, specialty: 5, tags: 3, description: 2, bio: 1 } }
);

// Helper function to generate avatar URL from coach name
export function generateAvatarUrl(name: string, bucketUrl: string): string {
  const kebabCase = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
  return `${bucketUrl}/coaches/${kebabCase}.png`;
}

export const Coach = mongoose.model<ICoach>('Coach', CoachSchema);
