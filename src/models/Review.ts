/**
 * Review Model (MongoDB/Mongoose)
 * Represents user reviews for coaches
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IReview extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  coachId: Types.ObjectId;
  sessionId?: Types.ObjectId;
  rating: number;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

const ReviewSchema = new Schema<IReview>(
  {
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
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: 'VoiceSession',
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
  },
  {
    timestamps: true,
  }
);

// One review per user per coach
ReviewSchema.index({ userId: 1, coachId: 1 }, { unique: true });
// Fetch reviews for a coach sorted by recent
ReviewSchema.index({ coachId: 1, createdAt: -1 });

export const Review = mongoose.model<IReview>('Review', ReviewSchema);
