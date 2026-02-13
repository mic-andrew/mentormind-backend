/**
 * User Model (MongoDB/Mongoose)
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  email?: string;
  firstName?: string;
  lastName?: string;
  password?: string;
  picture?: string;
  emailVerified: boolean;
  isOnboarded: boolean;
  deviceId?: string;
  isAnonymous: boolean;
  googleId?: string;
  appleId?: string;
  personalContext?: string;
  language: string;
  isDeleted: boolean;
  deletedAt?: Date;
  deletionScheduledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      lowercase: true,
      trim: true,
    },
    deviceId: {
      type: String,
    },
    isAnonymous: {
      type: Boolean,
      default: false,
    },
    firstName: {
      type: String,
      trim: true,
    },
    lastName: {
      type: String,
      trim: true,
    },
    password: {
      type: String,
    },
    picture: {
      type: String,
    },
    emailVerified: {
      type: Boolean,
      default: false,
    },
    isOnboarded: {
      type: Boolean,
      default: false,
    },
    googleId: {
      type: String,
    },
    appleId: {
      type: String,
    },
    personalContext: {
      type: String,
      maxlength: 5000,
    },
    language: {
      type: String,
      default: 'English',
      maxlength: 50,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
    },
    deletionScheduledAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Partial filter indexes: only enforce uniqueness when the field is an actual
// string. Documents where the field is null or missing are excluded entirely.
// This is required because Mongoose serializes undefined schema fields as null,
// and sparse indexes still index null values — only truly absent fields are skipped.
UserSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: 'string' } } }
);

UserSchema.index(
  { deviceId: 1 },
  { unique: true, partialFilterExpression: { deviceId: { $type: 'string' } } }
);

UserSchema.index(
  { googleId: 1 },
  { unique: true, partialFilterExpression: { googleId: { $type: 'string' } } }
);

UserSchema.index(
  { appleId: 1 },
  { unique: true, partialFilterExpression: { appleId: { $type: 'string' } } }
);

export const User = mongoose.model<IUser>('User', UserSchema);
