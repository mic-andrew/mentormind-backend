/**
 * Migration Script: Backfill userId and coachId on Transcript documents
 *
 * Joins through VoiceSession to populate the denormalized fields.
 * Idempotent — skips transcripts that already have both fields set.
 *
 * Usage: npx ts-node src/scripts/migrateTranscripts.ts
 */

import { connectDatabase } from '../config/database';
import { Transcript } from '../models/Transcript';
import { VoiceSession } from '../models/VoiceSession';
import { logger } from '../config/logger';
import dotenv from 'dotenv';

dotenv.config();

async function migrateTranscripts() {
  await connectDatabase();

  logger.info('[Migration] Starting transcript userId/coachId backfill...');

  // Find transcripts missing userId or coachId
  const transcripts = await Transcript.find({
    $or: [{ userId: { $exists: false } }, { coachId: { $exists: false } }],
  }).lean();

  logger.info(`[Migration] Found ${transcripts.length} transcripts to backfill`);

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const transcript of transcripts) {
    try {
      const session = await VoiceSession.findById(transcript.sessionId).lean();

      if (!session) {
        logger.warn(`[Migration] No session found for transcript ${transcript._id}, skipping`);
        skipped++;
        continue;
      }

      await Transcript.updateOne(
        { _id: transcript._id },
        {
          $set: {
            userId: session.userId,
            coachId: session.coachId,
          },
        }
      );

      updated++;

      if (updated % 100 === 0) {
        logger.info(`[Migration] Progress: ${updated} updated, ${skipped} skipped, ${failed} failed`);
      }
    } catch (error) {
      logger.error(`[Migration] Failed to update transcript ${transcript._id}:`, error);
      failed++;
    }
  }

  logger.info(
    `[Migration] Complete: ${updated} updated, ${skipped} skipped, ${failed} failed out of ${transcripts.length} total`
  );

  process.exit(0);
}

migrateTranscripts().catch((error) => {
  logger.error('[Migration] Fatal error:', error);
  process.exit(1);
});
