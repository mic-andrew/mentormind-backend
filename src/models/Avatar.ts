/**
 * Avatar Model (MongoDB/Mongoose)
 * Represents avatar personas that can be assigned to AI coaches
 */

import mongoose, { Schema, Document, Types } from 'mongoose';
import { CoachCategories, type CoachCategory } from './Coach';

// Gender options
export const AvatarGenders = ['male', 'female'] as const;
export type AvatarGender = (typeof AvatarGenders)[number];

// Age range options
export const AvatarAgeRanges = ['young-adult', 'mid-career', 'senior'] as const;
export type AvatarAgeRange = (typeof AvatarAgeRanges)[number];

// Style options
export const AvatarStyles = [
  'corporate',
  'casual',
  'creative',
  'academic',
  'athletic',
  'wellness',
] as const;
export type AvatarStyle = (typeof AvatarStyles)[number];

// Vibe options
export const AvatarVibes = [
  'warm',
  'authoritative',
  'energetic',
  'calm',
  'inspiring',
  'analytical',
] as const;
export type AvatarVibe = (typeof AvatarVibes)[number];

// Characteristics sub-document
export interface IAvatarCharacteristics {
  gender: AvatarGender;
  ageRange: AvatarAgeRange;
  ethnicity: string;
  style: AvatarStyle;
  vibe: AvatarVibe;
}

// Avatar document interface
export interface IAvatar extends Document {
  name: string;
  avatarImage: string;
  characteristics: IAvatarCharacteristics;
  characteristicsDescription: string;
  prompt: string;
  category: CoachCategory;
  tags: string[];
  users: Types.ObjectId[];
  activeUsersCount: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Characteristics schema
const CharacteristicsSchema = new Schema<IAvatarCharacteristics>(
  {
    gender: {
      type: String,
      required: true,
      enum: AvatarGenders,
    },
    ageRange: {
      type: String,
      required: true,
      enum: AvatarAgeRanges,
    },
    ethnicity: {
      type: String,
      required: true,
      trim: true,
    },
    style: {
      type: String,
      required: true,
      enum: AvatarStyles,
    },
    vibe: {
      type: String,
      required: true,
      enum: AvatarVibes,
    },
  },
  { _id: false }
);

// Avatar schema
const AvatarSchema = new Schema<IAvatar>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    avatarImage: {
      type: String,
      required: true,
    },
    characteristics: {
      type: CharacteristicsSchema,
      required: true,
    },
    characteristicsDescription: {
      type: String,
      required: true,
      maxlength: 500,
    },
    prompt: {
      type: String,
      required: true,
      maxlength: 2000,
    },
    category: {
      type: String,
      required: true,
      enum: CoachCategories,
    },
    tags: {
      type: [String],
      default: [],
    },
    users: {
      type: [Schema.Types.ObjectId],
      ref: 'User',
      default: [],
    },
    activeUsersCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for performance
AvatarSchema.index({ category: 1, isActive: 1 });
AvatarSchema.index({ 'characteristics.gender': 1, 'characteristics.style': 1 });
AvatarSchema.index({ users: 1 });
AvatarSchema.index({ activeUsersCount: 1 });
AvatarSchema.index({ isActive: 1 });

export const Avatar = mongoose.model<IAvatar>('Avatar', AvatarSchema);
