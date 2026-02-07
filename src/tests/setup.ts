/**
 * Vitest global setup
 * Sets environment variables before any module imports
 */

process.env.NODE_ENV = 'test';
process.env.PORT = '8000';
process.env.JWT_SECRET = 'test-jwt-secret-key';
process.env.JWT_EXPIRES_IN = '1h';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.DATABASE_URL = 'mongodb://localhost:27017/mentormind-test';
process.env.RESEND_API_KEY = 'test-resend-key';
process.env.EMAIL_FROM = 'test@example.com';
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
process.env.GOOGLE_CLIENT_SECRET = 'test-google-secret';
process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.DEEPGRAM_API_KEY = 'test-deepgram-key';
process.env.FRONTEND_URL = 'http://localhost:3000';
