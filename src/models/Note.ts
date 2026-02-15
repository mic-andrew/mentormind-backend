/**
 * Note Model
 * Stores extracted text from uploaded documents, linked to the user.
 */

import mongoose, { Schema, type Document } from 'mongoose';

export interface INote extends Document {
  userId: mongoose.Types.ObjectId;
  title: string;
  content: string;
  sourceFileName?: string;
  mimeType?: string;
  sizeBytes?: number;
  createdAt: Date;
  updatedAt: Date;
}

const NoteSchema = new Schema<INote>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    content: {
      type: String,
      required: true,
      maxlength: 50000,
    },
    sourceFileName: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    mimeType: {
      type: String,
      trim: true,
    },
    sizeBytes: {
      type: Number,
      min: 0,
    },
  },
  { timestamps: true }
);

NoteSchema.index({ userId: 1, createdAt: -1 });

export const Note = mongoose.model<INote>('Note', NoteSchema);
