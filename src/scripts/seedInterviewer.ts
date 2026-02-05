/**
 * Seed Script: Create the MentorMind context interviewer coach
 *
 * Creates a special system coach used for onboarding context extraction.
 * Queries the Avatar collection to find a suitable warm/professional avatar.
 * Idempotent — skips if interviewer coach already exists.
 *
 * Usage: npx ts-node src/scripts/seedInterviewer.ts
 */

import { connectDatabase } from '../config/database';
import { Coach } from '../models/Coach';
import { Avatar } from '../models/Avatar';
import { logger } from '../config/logger';
import { INTERVIEWER_SYSTEM_PROMPT } from '../prompts/interviewer';
import dotenv from 'dotenv';

dotenv.config();

async function seedInterviewer() {
  await connectDatabase();

  logger.info('[SeedInterviewer] Checking for existing interviewer coach...');

  const existing = await Coach.findOne({
    name: 'MentorMind',
    createdBy: 'system',
    isPublished: false,
  });

  if (existing) {
    logger.info(`[SeedInterviewer] Interviewer coach already exists: ${existing._id}`);
    logger.info(`[SeedInterviewer] Set INTERVIEWER_COACH_ID=${existing._id} in your .env`);
    process.exit(0);
  }

  // Query for a warm, professional avatar
  let avatar = await Avatar.findOne({
    isActive: true,
    'characteristics.vibe': 'warm',
    'characteristics.style': { $in: ['corporate', 'casual'] },
  }).sort({ activeUsersCount: 1 });

  // Fallback to any active avatar
  if (!avatar) {
    logger.warn('[SeedInterviewer] No warm/corporate avatar found, falling back to any active avatar');
    avatar = await Avatar.findOne({ isActive: true }).sort({ activeUsersCount: 1 });
  }

  if (!avatar) {
    logger.error('[SeedInterviewer] No avatars found in database. Seed avatars first.');
    process.exit(1);
  }

  logger.info(`[SeedInterviewer] Selected avatar: ${avatar.name} (${avatar._id})`);

  const interviewer = await Coach.create({
    name: 'MentorMind',
    avatar: avatar.avatarImage,
    avatarId: avatar._id,
    specialty: 'Personal Discovery',
    category: 'custom',
    description: 'Your onboarding guide',
    bio: 'I help you discover what you need from coaching through a friendly conversation. Together we\'ll find the perfect coach to accelerate your growth.',
    systemPrompt: INTERVIEWER_SYSTEM_PROMPT,
    tone: 'warm',
    coachingStyle: ['Empathetic', 'Socratic'],
    createdBy: 'system',
    isPublished: false,
    isFeatured: false,
    isVerified: true,
    moderationStatus: 'approved',
    language: 'English',
    sampleTopics: [
      { id: '1', icon: 'person-outline', title: 'Your Background', description: 'Tell me about your professional journey' },
      { id: '2', icon: 'flag-outline', title: 'Your Goals', description: 'What are you looking to achieve right now' },
      { id: '3', icon: 'heart-outline', title: 'Coaching Style', description: 'How do you prefer to be coached' },
    ],
    conversationStarters: [
      'Hey! I\'d love to get to know you a bit. What do you do professionally?',
      'Welcome! Let\'s figure out the perfect coach for you. What brings you here today?',
      'Hi there! I\'m excited to help match you with a great coach. Tell me about yourself!',
    ],
  });

  logger.info(`[SeedInterviewer] Interviewer coach created: ${interviewer._id}`);
  logger.info(`[SeedInterviewer] Add this to your .env: INTERVIEWER_COACH_ID=${interviewer._id}`);

  process.exit(0);
}

seedInterviewer().catch((error) => {
  logger.error('[SeedInterviewer] Fatal error:', error);
  process.exit(1);
});
