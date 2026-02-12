/**
 * ModuleEnrollment Model (MongoDB/Mongoose)
 * Tracks user progress through a generated module.
 * Stores reflection summaries (from voice transcripts) for the summary chain.
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IDayCompletion {
  dayNumber: number;
  completedAt: Date;
  reflectionSummary?: string;
  shiftAction?: string;
  voiceSessionId?: Types.ObjectId;
}

export interface IModuleEnrollment extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  moduleId: Types.ObjectId;
  currentDay: number;
  completedDays: IDayCompletion[];
  status: 'active' | 'completed' | 'abandoned';
  startedAt: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const dayCompletionSchema = new Schema<IDayCompletion>(
  {
    dayNumber: { type: Number, required: true },
    completedAt: { type: Date, required: true },
    reflectionSummary: { type: String },
    shiftAction: { type: String },
    voiceSessionId: { type: Schema.Types.ObjectId, ref: 'VoiceSession' },
  },
  { _id: false }
);

const ModuleEnrollmentSchema = new Schema<IModuleEnrollment>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    moduleId: {
      type: Schema.Types.ObjectId,
      ref: 'GeneratedModule',
      required: true,
    },
    currentDay: { type: Number, default: 1 },
    completedDays: [dayCompletionSchema],
    status: {
      type: String,
      enum: ['active', 'completed', 'abandoned'],
      default: 'active',
    },
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
  },
  { timestamps: true }
);

ModuleEnrollmentSchema.index({ userId: 1, moduleId: 1, status: 1 });
ModuleEnrollmentSchema.index({ userId: 1, status: 1 });

export const ModuleEnrollment = mongoose.model<IModuleEnrollment>(
  'ModuleEnrollment',
  ModuleEnrollmentSchema
);
