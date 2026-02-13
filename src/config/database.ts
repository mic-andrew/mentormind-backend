/**
 * MongoDB Database Connection
 * Serverless-compatible: caches connection between invocations, never calls process.exit
 */

import mongoose from 'mongoose';
import { logger } from './logger';

let isConnected = false;

export async function connectDatabase() {
  // Reuse existing connection (Vercel warm starts)
  if (isConnected && mongoose.connection.readyState === 1) {
    return;
  }

  try {
    const dbUrl = process.env.DATABASE_URL;

    if (!dbUrl) {
      throw new Error('DATABASE_URL not defined in environment variables');
    }

    await mongoose.connect(dbUrl, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      bufferCommands: false,
    });

    isConnected = true;
    logger.info('MongoDB connected successfully');

    mongoose.connection.on('error', (error) => {
      logger.error('MongoDB connection error:', error);
      isConnected = false;
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
      isConnected = false;
    });
  } catch (error) {
    isConnected = false;
    logger.error('Failed to connect to MongoDB:', error);
    throw error;
  }
}
