/**
 * Environment configuration
 */

import * as dotenv from 'dotenv';

dotenv.config();

export const env = {
  // Server
  port: parseInt(process.env.PORT || '8000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isDev: process.env.NODE_ENV !== 'production',

  // Database
  databaseUrl: process.env.DATABASE_URL!,

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'fallback-secret-change-me',
    expiresIn: (process.env.JWT_EXPIRES_IN || '15m') as string,
    refreshExpiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as string,
  },

  // Email (Resend)
  resendApiKey: process.env.RESEND_API_KEY!,
  emailFrom: process.env.EMAIL_FROM || 'MentorMind <onboarding@resend.dev>',

  // Google OAuth
  googleClientId: process.env.GOOGLE_CLIENT_ID!,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  googleCallbackUrl: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/auth/google/callback',

  // URLs
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:8081',
};
