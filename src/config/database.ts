/**
 * MongoDB Database Connection
 */

import mongoose from 'mongoose';
import { logger } from './logger';

export async function connectDatabase() {
  try {
    const dbUrl = process.env.DATABASE_URL;

    if (!dbUrl) {
      throw new Error('DATABASE_URL not defined in environment variables');
    }

    await mongoose.connect(dbUrl);

    logger.info('MongoDB connected successfully');

    mongoose.connection.on('error', (error) => {
      logger.error('MongoDB connection error:', error);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });
  } catch (error) {
    logger.error('Failed to connect to MongoDB:', error);
    process.exit(1);
  }
}
