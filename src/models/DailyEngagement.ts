/**
 * DailyEngagement Model
 * Caches AI-generated daily prompts, coach nudges, and check-in state per user per day
 */

import { Schema, model, Types } from 'mongoose';

export type CheckInStatus = 'none' | 'done' | 'partial' | 'skipped';

export interface IDailyEngagement {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  date: string; // YYYY-MM-DD format
  dailyPrompt?: {
    title: string;
    description: string;
    relatedCommitmentTitle: string;
    generatedAt: Date;
  };
  coachNudge?: {
    coachId: Types.ObjectId;
    coachName: string;
    message: string;
    generatedAt: Date;
  };
  checkInStatus: CheckInStatus;
  checkedInAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const DailyPromptSchema = new Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    relatedCommitmentTitle: { type: String, required: true },
    generatedAt: { type: Date, required: true },
  },
  { _id: false }
);

const CoachNudgeSchema = new Schema(
  {
    coachId: { type: Schema.Types.ObjectId, ref: 'Coach' },
    coachName: { type: String, required: true },
    message: { type: String, required: true },
    generatedAt: { type: Date, required: true },
  },
  { _id: false }
);

const DailyEngagementSchema = new Schema<IDailyEngagement>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    date: { type: String, required: true },
    dailyPrompt: { type: DailyPromptSchema, default: undefined },
    coachNudge: { type: CoachNudgeSchema, default: undefined },
    checkInStatus: {
      type: String,
      enum: ['none', 'done', 'partial', 'skipped'],
      default: 'none',
    },
    checkedInAt: { type: Date },
  },
  { timestamps: true }
);

DailyEngagementSchema.index({ userId: 1, date: 1 }, { unique: true });
DailyEngagementSchema.index({ userId: 1, checkInStatus: 1, date: -1 });

export const DailyEngagement = model<IDailyEngagement>(
  'DailyEngagement',
  DailyEngagementSchema
);
