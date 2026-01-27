/**
 * VoiceSession Model (MongoDB/Mongoose)
 * Represents a voice coaching session between user and coach
 *
 * Transcript data lives in a separate Transcript document (one per session),
 * referenced via transcriptId.
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

export type SessionStatus = 'active' | 'paused' | 'ended' | 'error' | 'abandoned';

export interface IVoiceSession extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  coachId: Types.ObjectId;
  status: SessionStatus;
  openaiSessionId?: string;
  startedAt: Date;
  endedAt?: Date;
  durationMs: number;
  transcriptId?: Types.ObjectId;
  // AI-generated at session end
  title?: string;
  summary?: string;
  createdAt: Date;
  updatedAt: Date;
}

const VoiceSessionSchema = new Schema<IVoiceSession>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    coachId: {
      type: Schema.Types.ObjectId,
      ref: 'Coach',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'paused', 'ended', 'error', 'abandoned'],
      default: 'active',
    },
    openaiSessionId: {
      type: String,
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    endedAt: {
      type: Date,
    },
    durationMs: {
      type: Number,
      default: 0,
    },
    transcriptId: {
      type: Schema.Types.ObjectId,
      ref: 'Transcript',
    },
    title: {
      type: String,
      maxlength: 200,
    },
    summary: {
      type: String,
      maxlength: 2000,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for common queries
VoiceSessionSchema.index({ userId: 1, createdAt: -1 });
VoiceSessionSchema.index({ coachId: 1, createdAt: -1 });
VoiceSessionSchema.index({ userId: 1, status: 1 });

export const VoiceSession = mongoose.model<IVoiceSession>('VoiceSession', VoiceSessionSchema);
