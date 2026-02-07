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
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
    },
    deviceId: {
      type: String,
      unique: true,
      sparse: true,
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
      unique: true,
      sparse: true,
    },
    appleId: {
      type: String,
      unique: true,
      sparse: true,
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

export const User = mongoose.model<IUser>('User', UserSchema);
