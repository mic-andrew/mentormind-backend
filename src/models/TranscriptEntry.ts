/**
 * @deprecated Transcripts are now stored in the Transcript model (one document per session).
 * Kept for data migration purposes only. See Transcript.ts for the new schema.
 *
 * TranscriptEntry Model (MongoDB/Mongoose)
 * Represents a single transcript entry in a voice session
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

export type Speaker = 'user' | 'coach';

export interface ITranscriptEntry extends Document {
  _id: Types.ObjectId;
  sessionId: Types.ObjectId;
  entryId: string; // Client UUID for deduplication
  speaker: Speaker;
  content: string;
  timestamp: Date;
  offsetMs: number; // From session start
  createdAt: Date;
}

const TranscriptEntrySchema = new Schema<ITranscriptEntry>(
  {
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: 'VoiceSession',
      required: true,
      index: true,
    },
    entryId: {
      type: String,
      required: true,
    },
    speaker: {
      type: String,
      enum: ['user', 'coach'],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      required: true,
    },
    offsetMs: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Index for fetching transcript in order
TranscriptEntrySchema.index({ sessionId: 1, timestamp: 1 });

// Unique index for deduplication
TranscriptEntrySchema.index({ sessionId: 1, entryId: 1 }, { unique: true });

export const TranscriptEntry = mongoose.model<ITranscriptEntry>(
  'TranscriptEntry',
  TranscriptEntrySchema
);
