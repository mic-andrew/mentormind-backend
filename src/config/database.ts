/**
 * MongoDB Database Connection
 * Serverless-compatible: caches connection promise, retries on failure, never calls process.exit
 */

import mongoose from 'mongoose';
import { logger } from './logger';
import { User } from '../models/User';

/**
 * Cached connection promise — shared across warm invocations on Vercel.
 * We cache the *promise*, not just a boolean, so concurrent requests
 * during a cold start all await the same in-flight connection.
 */
let connectionPromise: Promise<typeof mongoose> | null = null;

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Connect to MongoDB with retry logic.
 * Safe to call multiple times — returns cached promise if already connecting/connected.
 */
export async function connectDatabase(): Promise<void> {
  // Already connected — fast path for warm starts
  if (mongoose.connection.readyState === 1) {
    return;
  }

  // Connection in progress — wait for it
  if (connectionPromise) {
    await connectionPromise;
    return;
  }

  const dbUrl = process.env.DATABASE_URL;

  if (!dbUrl) {
    throw new Error('DATABASE_URL not defined in environment variables');
  }

  connectionPromise = attemptConnection(dbUrl);

  try {
    await connectionPromise;
  } catch (error) {
    // Clear the cached promise so the next call retries
    connectionPromise = null;
    throw error;
  }
}

async function attemptConnection(dbUrl: string): Promise<typeof mongoose> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const conn = await mongoose.connect(dbUrl, {
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        family: 4, // Force IPv4 — avoids Vercel IPv6 DNS issues
        maxPoolSize: 10,
        minPoolSize: 1,
      });

      logger.info(`MongoDB connected successfully (attempt ${attempt})`);

      // Sync indexes: drops stale indexes (e.g. old non-partial unique indexes)
      // and creates the correct partial filter indexes defined in schemas.
      // This is idempotent — no-op if indexes already match.
      try {
        await User.syncIndexes();
        logger.info('User indexes synced');
      } catch (indexErr) {
        logger.warn('Index sync failed (non-fatal):', indexErr);
      }

      mongoose.connection.on('error', (error) => {
        logger.error('MongoDB connection error:', error);
        connectionPromise = null;
      });

      mongoose.connection.on('disconnected', () => {
        logger.warn('MongoDB disconnected');
        connectionPromise = null;
      });

      return conn;
    } catch (error) {
      lastError = error;
      logger.warn(
        `MongoDB connection attempt ${attempt}/${MAX_RETRIES} failed:`,
        error instanceof Error ? error.message : error
      );

      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS * attempt);
      }
    }
  }

  logger.error('All MongoDB connection attempts failed');
  throw lastError;
}
