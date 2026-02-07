/**
 * SessionEvaluation Model (MongoDB/Mongoose)
 *
 * One evaluation document per completed voice session. Contains AI-generated
 * insights, action commitments, performance scores, tips, and resources
 * derived from analyzing the session transcript.
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

// --- Enums ---

export type ImpactLevel = 'high' | 'medium' | 'low';
export type DifficultyLevel = 'easy' | 'moderate' | 'hard';
export type ResourceType = 'book' | 'article' | 'podcast' | 'video' | 'course' | 'exercise';
export type EvaluationStatus = 'pending' | 'generating' | 'completed' | 'failed';

// --- Sub-document types ---

export interface IInsight {
  title: string;
  description: string;
  impactLevel: ImpactLevel;
  evidence: string;
}

export type CommitmentStatus = 'pending' | 'in_progress' | 'completed';

export interface IActionCommitment {
  title: string;
  description: string;
  specifics: string[];
  difficulty: DifficultyLevel;
  impactLevel: ImpactLevel;
  status: CommitmentStatus;
  completedAt?: Date;
}

export interface IPerformanceScore {
  category: string;
  name: string;
  score: number;
  description: string;
  nextLevelAdvice: string;
}

export interface ITip {
  title: string;
  doAdvice: string;
  dontAdvice: string;
  evidence: string;
}

export interface IResource {
  type: ResourceType;
  title: string;
  author: string;
  matchScore: number;
  reasoning: string;
  url?: string;
}

// --- Main document type ---

export interface ISessionEvaluation extends Document {
  _id: Types.ObjectId;
  sessionId: Types.ObjectId;
  userId: Types.ObjectId;
  coachId: Types.ObjectId;
  status: EvaluationStatus;
  overallSummary?: string;
  insights: IInsight[];
  actionCommitments: IActionCommitment[];
  performanceScores: IPerformanceScore[];
  tips: ITip[];
  resources: IResource[];
  modelUsed: string;
  generationTimeMs?: number;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

// --- Sub-schemas ---

const InsightSchema = new Schema<IInsight>(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    impactLevel: { type: String, enum: ['high', 'medium', 'low'], required: true },
    evidence: { type: String, required: true },
  },
  { _id: false }
);

const ActionCommitmentSchema = new Schema<IActionCommitment>(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    specifics: { type: [String], default: [] },
    difficulty: { type: String, enum: ['easy', 'moderate', 'hard'], required: true },
    impactLevel: { type: String, enum: ['high', 'medium', 'low'], required: true },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed'],
      default: 'pending',
    },
    completedAt: { type: Date },
  },
  { _id: false }
);

const PerformanceScoreSchema = new Schema<IPerformanceScore>(
  {
    category: { type: String, required: true },
    name: { type: String, required: true },
    score: { type: Number, required: true, min: 0, max: 10 },
    description: { type: String, required: true },
    nextLevelAdvice: { type: String, required: true },
  },
  { _id: false }
);

const TipSchema = new Schema<ITip>(
  {
    title: { type: String, required: true },
    doAdvice: { type: String, required: true },
    dontAdvice: { type: String, required: true },
    evidence: { type: String, required: true },
  },
  { _id: false }
);

const ResourceSchema = new Schema<IResource>(
  {
    type: {
      type: String,
      enum: ['book', 'article', 'podcast', 'video', 'course', 'exercise'],
      required: true,
    },
    title: { type: String, required: true },
    author: { type: String, required: true },
    matchScore: { type: Number, required: true, min: 0, max: 100 },
    reasoning: { type: String, required: true },
    url: { type: String },
  },
  { _id: false }
);

// --- Main schema ---

const SessionEvaluationSchema = new Schema<ISessionEvaluation>(
  {
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: 'VoiceSession',
      required: true,
      unique: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    coachId: {
      type: Schema.Types.ObjectId,
      ref: 'Coach',
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'generating', 'completed', 'failed'],
      default: 'pending',
    },
    overallSummary: { type: String },
    insights: { type: [InsightSchema], default: [] },
    actionCommitments: { type: [ActionCommitmentSchema], default: [] },
    performanceScores: { type: [PerformanceScoreSchema], default: [] },
    tips: { type: [TipSchema], default: [] },
    resources: { type: [ResourceSchema], default: [] },
    modelUsed: { type: String, default: 'gpt-4o-mini' },
    generationTimeMs: { type: Number },
    errorMessage: { type: String },
  },
  {
    timestamps: true,
  }
);

// One evaluation per session
SessionEvaluationSchema.index({ sessionId: 1 }, { unique: true });
// User evaluation history
SessionEvaluationSchema.index({ userId: 1, createdAt: -1 });
// Active commitments lookup for dashboard
SessionEvaluationSchema.index({ userId: 1, 'actionCommitments.status': 1 });

export const SessionEvaluation = mongoose.model<ISessionEvaluation>(
  'SessionEvaluation',
  SessionEvaluationSchema
);
