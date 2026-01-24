/**
 * MentorMind API Server
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { connectDatabase } from './config/database.js';
import { apiRoutes } from './routes/index.js';
import { logger } from './config/logger.js';

const app = express();

// Middleware
app.use(helmet());
app.use(cors({
  origin: env.frontendUrl,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api', apiRoutes);

// Error handling
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error:', { error: err.message, stack: err.stack });
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: env.isDev ? err.message : 'An unexpected error occurred',
    },
  });
});

// Connect to database and start server
async function start() {
  await connectDatabase();

  app.listen(env.port, () => {
    logger.info(`
🚀 MentorMind API Server
━━━━━━━━━━━━━━━━━━━━━━━
📍 URL: http://localhost:${env.port}
🌍 Environment: ${env.nodeEnv}
━━━━━━━━━━━━━━━━━━━━━━━
    `);
  });
}

start().catch((error) => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});
