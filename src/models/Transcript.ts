/**
 * Transcript Model (MongoDB/Mongoose)
 *
 * One transcript document per voice session, containing all speakers and
 * utterances in a Rev/Deepgram-inspired format.
 *
 * Replaces the old TranscriptEntry model which created a separate document
 * per utterance (scaling concern with millions of documents).
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

// --- Sub-document types ---

export interface ITranscriptSpeaker {
  id: string; // 'user' | 'coach'
  name: string; // Real name (e.g., "John" or "Dr. Elena Ray")
  role: 'user' | 'coach';
}

export interface ITranscriptUtterance {
  entryId: string; // Client-generated UUID for deduplication
  speakerId: string; // References ITranscriptSpeaker.id
  content: string;
  startOffsetMs: number; // Offset from session start
  endOffsetMs: number; // End offset from session start
  timestamp: Date; // Absolute wall-clock time
  confidence?: number; // Transcription confidence 0-1 (optional, future use)
}

export interface ITranscript extends Document {
  _id: Types.ObjectId;
  sessionId: Types.ObjectId;
  userId: Types.ObjectId;
  coachId: Types.ObjectId;
  speakers: ITranscriptSpeaker[];
  utterances: ITranscriptUtterance[];
  metadata: {
    totalUtterances: number;
    language: string;
    lastSyncedAt?: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

// --- Sub-schemas ---

const TranscriptSpeakerSchema = new Schema<ITranscriptSpeaker>(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    role: { type: String, enum: ['user', 'coach'], required: true },
  },
  { _id: false }
);

const TranscriptUtteranceSchema = new Schema<ITranscriptUtterance>(
  {
    entryId: { type: String, required: true },
    speakerId: { type: String, required: true },
    content: { type: String, required: true },
    startOffsetMs: { type: Number, required: true },
    endOffsetMs: { type: Number, required: true },
    timestamp: { type: Date, required: true },
    confidence: { type: Number, min: 0, max: 1 },
  },
  { _id: false }
);

// --- Main schema ---

const TranscriptSchema = new Schema<ITranscript>(
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
    },
    coachId: {
      type: Schema.Types.ObjectId,
      ref: 'Coach',
    },
    speakers: { type: [TranscriptSpeakerSchema], default: [] },
    utterances: { type: [TranscriptUtteranceSchema], default: [] },
    metadata: {
      totalUtterances: { type: Number, default: 0 },
      language: { type: String, default: 'en' },
      lastSyncedAt: { type: Date },
    },
  },
  {
    timestamps: true,
  }
);

// Fast lookup by session
TranscriptSchema.index({ sessionId: 1 });
// Multi-session history queries
TranscriptSchema.index({ userId: 1, coachId: 1, createdAt: -1 });
TranscriptSchema.index({ userId: 1, createdAt: -1 });

export const Transcript = mongoose.model<ITranscript>('Transcript', TranscriptSchema);
