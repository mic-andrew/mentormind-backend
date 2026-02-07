/**
 * Engagement Service
 * Generates daily practice prompts and coach nudges, handles check-ins
 */

import OpenAI from 'openai';
import { Types } from 'mongoose';
import { DailyEngagement, CheckInStatus } from '../models/DailyEngagement';
import { SessionEvaluation } from '../models/SessionEvaluation';
import { VoiceSession } from '../models/VoiceSession';
import { User } from '../models/User';
import { Coach } from '../models/Coach';
import { env } from '../config/env';
import { logger } from '../config/logger';
import {
  DAILY_PROMPT_SYSTEM_MESSAGE,
  buildDailyPromptUserMessage,
  COACH_NUDGE_SYSTEM_MESSAGE,
  buildCoachNudgeUserMessage,
} from '../prompts/dailyEngagement';

interface DailyEngagementResponse {
  dailyPrompt: {
    title: string;
    description: string;
    relatedCommitmentTitle: string;
  } | null;
  coachNudge: {
    coachName: string;
    coachAvatar?: string;
    message: string;
  } | null;
  checkInStatus: CheckInStatus;
  checkInStreak: number;
}

class EngagementService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({ apiKey: env.openaiApiKey });
  }

  /**
   * Get or generate today's engagement content
   */
  async getDailyEngagement(userId: string): Promise<DailyEngagementResponse> {
    const userObjectId = new Types.ObjectId(userId);
    const today = new Date().toISOString().split('T')[0];

    // Check if already generated today
    const existing = await DailyEngagement.findOne({
      userId: userObjectId,
      date: today,
    }).lean();

    if (existing?.dailyPrompt?.generatedAt) {
      const streak = await this.calculateCheckInStreak(userObjectId);
      return this.formatResponse(existing, streak);
    }

    // Fetch data needed for generation
    const [evaluations, recentSession, user] = await Promise.all([
      SessionEvaluation.find({
        userId: userObjectId,
        status: 'completed',
      })
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
      VoiceSession.findOne({ userId: userObjectId, status: 'ended' })
        .populate('coachId', 'name avatar tone coachingStyle')
        .sort({ endedAt: -1 })
        .lean(),
      User.findById(userId).select('firstName personalContext').lean(),
    ]);

    // Collect active commitments
    const commitmentTitles: string[] = [];
    const commitmentDescriptions: string[] = [];
    for (const evaluation of evaluations) {
      for (const commitment of evaluation.actionCommitments) {
        const status = commitment.status || 'pending';
        if (status !== 'completed') {
          commitmentTitles.push(commitment.title);
          commitmentDescriptions.push(commitment.description);
        }
      }
    }

    // If no active commitments, nothing to generate
    if (commitmentTitles.length === 0) {
      const streak = await this.calculateCheckInStreak(userObjectId);
      return {
        dailyPrompt: null,
        coachNudge: null,
        checkInStatus: existing?.checkInStatus || 'none',
        checkInStreak: streak,
      };
    }

    // Generate daily prompt and coach nudge in parallel
    const coach = recentSession?.coachId as unknown as {
      _id: Types.ObjectId;
      name: string;
      avatar: string;
      tone: string;
      coachingStyle: string[];
    } | null;

    const [promptResult, nudgeResult] = await Promise.all([
      this.generateDailyPrompt({
        commitmentTitles: commitmentTitles.slice(0, 5),
        commitmentDescriptions: commitmentDescriptions.slice(0, 5),
        personalContext: user?.personalContext,
        lastSessionSummary: recentSession?.summary,
        coachName: coach?.name,
      }),
      coach
        ? this.generateCoachNudge({
            coachName: coach.name,
            coachTone: coach.tone || 'warm',
            userName: user?.firstName || 'there',
            commitmentTitles: commitmentTitles.slice(0, 3),
          })
        : null,
    ]);

    // Upsert today's engagement
    const engagement = await DailyEngagement.findOneAndUpdate(
      { userId: userObjectId, date: today },
      {
        $set: {
          dailyPrompt: promptResult
            ? { ...promptResult, generatedAt: new Date() }
            : undefined,
          coachNudge:
            nudgeResult && coach
              ? {
                  coachId: coach._id,
                  coachName: coach.name,
                  message: nudgeResult.message,
                  generatedAt: new Date(),
                }
              : undefined,
        },
        $setOnInsert: {
          checkInStatus: 'none',
        },
      },
      { upsert: true, new: true }
    );

    const streak = await this.calculateCheckInStreak(userObjectId);

    return {
      dailyPrompt: promptResult,
      coachNudge: nudgeResult && coach
        ? { coachName: coach.name, coachAvatar: coach.avatar, message: nudgeResult.message }
        : null,
      checkInStatus: engagement.checkInStatus,
      checkInStreak: streak,
    };
  }

  /**
   * Record a daily check-in
   */
  async checkIn(userId: string, status: CheckInStatus): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    await DailyEngagement.findOneAndUpdate(
      { userId: new Types.ObjectId(userId), date: today },
      {
        $set: { checkInStatus: status, checkedInAt: new Date() },
      },
      { upsert: true }
    );
  }

  /**
   * Calculate consecutive days of check-ins
   */
  async calculateCheckInStreak(userId: Types.ObjectId): Promise<number> {
    try {
      const engagements = await DailyEngagement.find({
        userId,
        checkInStatus: { $ne: 'none' },
      })
        .sort({ date: -1 })
        .limit(365)
        .select('date')
        .lean();

      if (engagements.length === 0) return 0;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0];

      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      const dates = engagements.map((e) => e.date);

      // Streak must start from today or yesterday
      if (dates[0] !== todayStr && dates[0] !== yesterdayStr) return 0;

      let streak = 1;
      for (let i = 1; i < dates.length; i++) {
        const prevDate = new Date(dates[i - 1]);
        const currDate = new Date(dates[i]);
        const diffDays =
          (prevDate.getTime() - currDate.getTime()) / (1000 * 60 * 60 * 24);

        if (Math.round(diffDays) === 1) {
          streak++;
        } else {
          break;
        }
      }

      return streak;
    } catch (error) {
      logger.error('Error calculating check-in streak:', error);
      return 0;
    }
  }

  private async generateDailyPrompt(
    context: Parameters<typeof buildDailyPromptUserMessage>[0]
  ) {
    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: DAILY_PROMPT_SYSTEM_MESSAGE },
          { role: 'user', content: buildDailyPromptUserMessage(context) },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.8,
        max_tokens: 150,
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) return null;

      return JSON.parse(content) as {
        title: string;
        description: string;
        relatedCommitmentTitle: string;
      };
    } catch (error) {
      logger.error('Error generating daily prompt:', error);
      return null;
    }
  }

  private async generateCoachNudge(
    context: Parameters<typeof buildCoachNudgeUserMessage>[0]
  ) {
    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: COACH_NUDGE_SYSTEM_MESSAGE },
          { role: 'user', content: buildCoachNudgeUserMessage(context) },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.8,
        max_tokens: 80,
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) return null;

      return JSON.parse(content) as { message: string };
    } catch (error) {
      logger.error('Error generating coach nudge:', error);
      return null;
    }
  }

  private formatResponse(
    engagement: {
      dailyPrompt?: {
        title: string;
        description: string;
        relatedCommitmentTitle: string;
      };
      coachNudge?: {
        coachName: string;
        message: string;
      };
      checkInStatus: CheckInStatus;
    },
    streak: number
  ): DailyEngagementResponse {
    return {
      dailyPrompt: engagement.dailyPrompt
        ? {
            title: engagement.dailyPrompt.title,
            description: engagement.dailyPrompt.description,
            relatedCommitmentTitle: engagement.dailyPrompt.relatedCommitmentTitle,
          }
        : null,
      coachNudge: engagement.coachNudge
        ? {
            coachName: engagement.coachNudge.coachName,
            message: engagement.coachNudge.message,
          }
        : null,
      checkInStatus: engagement.checkInStatus,
      checkInStreak: streak,
    };
  }
}

export const engagementService = new EngagementService();
