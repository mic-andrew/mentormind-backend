/**
 * User Model (MongoDB/Mongoose)
 */

import mongoose, { Schema, Document } from 'mongoose';

export interface IUserContext {
  primaryGoals?: string;
  coreValues?: string;
  keyChallenges?: string[];
  updatedAt?: Date;
}

export interface IUser extends Document {
  email: string;
  firstName?: string;
  lastName?: string;
  password?: string;
  picture?: string;
  emailVerified: boolean;
  isOnboarded: boolean;
  googleId?: string;
  appleId?: string;
  context?: IUserContext;
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
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
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
    context: {
      primaryGoals: {
        type: String,
        maxlength: 1000,
      },
      coreValues: {
        type: String,
        maxlength: 500,
      },
      keyChallenges: [{
        type: String,
        maxlength: 200,
      }],
      updatedAt: {
        type: Date,
      },
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
