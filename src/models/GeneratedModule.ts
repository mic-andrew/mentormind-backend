/**
 * GeneratedModule Model (MongoDB/Mongoose)
 * Stores AI-generated module structures per user.
 * Modules are personalized thinking journeys created from the user's personal context.
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

export type ModuleColor = 'amber' | 'blue' | 'emerald' | 'violet';
export type ModuleType = 'sprint' | 'pattern_breaker' | 'foundation';
export type ModuleDifficulty = 'beginner' | 'intermediate' | 'advanced';

export interface IGeneratedModuleDay {
  dayNumber: number;
  title: string;
  subtitle: string;
  goal: string;
  framework: string;
  frameworkDescription: string;
  reflectionPrompt: string;
  shiftFocus: string;
}

export interface IGeneratedModule extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  title: string;
  subtitle: string;
  description: string;
  outcome: string;
  moduleColor: ModuleColor;
  icon: string;
  totalDays: number;
  minutesPerDay: number;
  type: ModuleType;
  difficulty: ModuleDifficulty;
  days: IGeneratedModuleDay[];
  status: 'ready' | 'error';
  createdAt: Date;
  updatedAt: Date;
}

const generatedModuleDaySchema = new Schema<IGeneratedModuleDay>(
  {
    dayNumber: { type: Number, required: true },
    title: { type: String, required: true },
    subtitle: { type: String, required: true },
    goal: { type: String, required: true },
    framework: { type: String, required: true },
    frameworkDescription: { type: String, required: true },
    reflectionPrompt: { type: String, required: true },
    shiftFocus: { type: String, required: true },
  },
  { _id: false }
);

const GeneratedModuleSchema = new Schema<IGeneratedModule>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: { type: String, required: true },
    subtitle: { type: String, required: true },
    description: { type: String, required: true },
    outcome: { type: String, required: true },
    moduleColor: {
      type: String,
      enum: ['amber', 'blue', 'emerald', 'violet'],
      required: true,
    },
    icon: { type: String, required: true },
    totalDays: { type: Number, required: true },
    minutesPerDay: { type: Number, default: 10 },
    type: {
      type: String,
      enum: ['sprint', 'pattern_breaker', 'foundation'],
      default: 'sprint',
    },
    difficulty: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced'],
      default: 'intermediate',
    },
    days: [generatedModuleDaySchema],
    status: {
      type: String,
      enum: ['ready', 'error'],
      default: 'ready',
    },
  },
  { timestamps: true }
);

GeneratedModuleSchema.index({ userId: 1, status: 1 });

export const GeneratedModule = mongoose.model<IGeneratedModule>(
  'GeneratedModule',
  GeneratedModuleSchema
);
