/**
 * Environment configuration
 */

import * as dotenv from 'dotenv';

dotenv.config();

export const env = {
  // Server
  port: parseInt(process.env.PORT || '8000', 10),
  nodeEnv: process.env.NODE_ENV,
  isDev: process.env.NODE_ENV !== 'production',

  // Database
  databaseUrl: process.env.DATABASE_URL!,

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: (process.env.JWT_EXPIRES_IN || '15m') as string,
    refreshExpiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as string,
  },

  // Email (Resend)
  resendApiKey: process.env.RESEND_API_KEY!,
  emailFrom: process.env.EMAIL_FROM,

  // Google OAuth
  googleClientId: process.env.GOOGLE_CLIENT_ID!,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  googleCallbackUrl: process.env.GOOGLE_CALLBACK_URL,

  // URLs
  frontendUrl: process.env.FRONTEND_URL,

  // Deepgram (Voice transcription)
  deepgramApiKey: process.env.DEEPGRAM_API_KEY!,

  // OpenAI (AI coach extraction)
  openaiApiKey: process.env.OPENAI_API_KEY!,

  // AWS S3 (Document uploads)
  aws: {
    s3Bucket: process.env.AWS_S3_BUCKET || '',
    s3Region: process.env.AWS_S3_REGION || 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
};
