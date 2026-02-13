/**
 * Daily Coach Backend API
 * Main entry point
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { logger } from './config/logger';
import { connectDatabase } from './config/database';
import { apiRoutes } from './routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure MongoDB is connected before handling any API request.
// On Vercel cold starts, the top-level connectDatabase() may still be in-flight
// when the first request arrives — this middleware awaits that same promise.
app.use('/api', async (_req, res, next) => {
  try {
    await connectDatabase();
    next();
  } catch (error) {
    logger.error('Database connection failed in middleware:', error);
    res.status(503).json({
      success: false,
      error: { code: 'SERVICE_UNAVAILABLE', message: 'Database temporarily unavailable. Please retry.' },
    });
  }
});

// Routes
app.use('/api', apiRoutes);

// Health check
app.get('/health', async (_req, res) => {
  try {
    await connectDatabase();
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: 'degraded', timestamp: new Date().toISOString() });
  }
});

// Start connection eagerly (warms up during cold start)
connectDatabase().catch((err) => {
  logger.error('MongoDB initial connection failed:', err);
});

// Start server (used in local dev; Vercel ignores this)
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
