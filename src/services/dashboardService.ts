/**
 * Dashboard Service
 * Aggregates home screen data: stats, active commitments, streak, recent session
 */

import { Types } from 'mongoose';
import { VoiceSession } from '../models/VoiceSession';
import {
  SessionEvaluation,
  ISessionEvaluation,
  CommitmentStatus,
} from '../models/SessionEvaluation';
import { User } from '../models/User';
import { DailyEngagement } from '../models/DailyEngagement';
import { logger } from '../config/logger';

// --- Types ---

type TimeOfDay = 'morning' | 'afternoon' | 'evening';

interface DashboardGreeting {
  firstName: string;
  timeOfDay: TimeOfDay;
}

interface DashboardStats {
  totalSessions: number;
  currentStreak: number;
  commitmentsCompleted: number;
  commitmentsTotal: number;
  checkInStreak: number;
  todayCheckedIn: boolean;
}

interface ActiveCommitment {
  evaluationId: string;
  commitmentIndex: number;
  title: string;
  description: string;
  specifics: string[];
  difficulty: string;
  impactLevel: string;
  status: CommitmentStatus;
  coach: { id: string; name: string; avatar: string };
  sessionDate: string;
}

interface RecentSession {
  id: string;
  coach: { id: string; name: string; avatar: string; specialty: string };
  title?: string;
  summary?: string;
  durationMs: number;
  createdAt: string;
}

interface RecentInsight {
  title: string;
  description: string;
  impactLevel: string;
}

interface PerformanceScore {
  name: string;
  score: number;
  category: string;
  description: string;
  nextLevelAdvice: string;
}

interface DashboardTip {
  title: string;
  doAdvice: string;
  dontAdvice: string;
  evidence: string;
}

interface DashboardResource {
  type: string;
  title: string;
  author: string;
  reasoning: string;
}

export interface DashboardData {
  greeting: DashboardGreeting;
  stats: DashboardStats;
  activeCommitments: ActiveCommitment[];
  recentSession: RecentSession | null;
  recentInsights: RecentInsight[];
  weeklyActivity: number[];
  performanceScores: PerformanceScore[];
  tips: DashboardTip[];
  resources: DashboardResource[];
}

// --- Service ---

class DashboardService {
  /**
   * Get aggregated dashboard data for a user
   */
  async getDashboard(userId: string): Promise<DashboardData> {
    const userObjectId = new Types.ObjectId(userId);

    const today = new Date().toISOString().split('T')[0];

    const [user, totalSessions, currentStreak, evaluationsWithCommitments, recentSessionDoc, todayEngagement] =
      await Promise.all([
        User.findById(userId).select('firstName').lean(),
        VoiceSession.countDocuments({ userId: userObjectId, status: 'ended' }),
        this.calculateStreak(userObjectId),
        SessionEvaluation.find({
          userId: userObjectId,
          status: 'completed',
        })
          .populate('coachId', 'name avatar specialty')
          .sort({ createdAt: -1 })
          .lean(),
        VoiceSession.findOne({ userId: userObjectId, status: 'ended' })
          .populate('coachId', 'name avatar specialty')
          .sort({ endedAt: -1 })
          .lean(),
        DailyEngagement.findOne({ userId: userObjectId, date: today })
          .select('checkInStatus')
          .lean(),
      ]);

    // Calculate check-in streak
    const checkInStreak = await this.calculateCheckInStreak(userObjectId);
    const todayCheckedIn = todayEngagement?.checkInStatus !== undefined && todayEngagement.checkInStatus !== 'none';

    // Build active commitments from all evaluations
    const activeCommitments: ActiveCommitment[] = [];
    let commitmentsCompleted = 0;
    let commitmentsTotal = 0;

    for (const evaluation of evaluationsWithCommitments) {
      const coach = evaluation.coachId as unknown as {
        _id: Types.ObjectId;
        name: string;
        avatar: string;
      };

      for (let i = 0; i < evaluation.actionCommitments.length; i++) {
        const commitment = evaluation.actionCommitments[i];
        commitmentsTotal++;

        const status = commitment.status || 'pending';
        if (status === 'completed') {
          commitmentsCompleted++;
          continue;
        }

        activeCommitments.push({
          evaluationId: (evaluation as unknown as { _id: Types.ObjectId })._id.toString(),
          commitmentIndex: i,
          title: commitment.title,
          description: commitment.description,
          specifics: commitment.specifics,
          difficulty: commitment.difficulty,
          impactLevel: commitment.impactLevel,
          status,
          coach: {
            id: coach?._id?.toString() || '',
            name: coach?.name || 'Coach',
            avatar: coach?.avatar || '',
          },
          sessionDate: (evaluation as unknown as { createdAt: Date }).createdAt.toISOString(),
        });
      }
    }

    // Cap active commitments to 10 most recent
    activeCommitments.splice(10);

    // Build recent session
    let recentSession: RecentSession | null = null;
    if (recentSessionDoc) {
      const coach = recentSessionDoc.coachId as unknown as {
        _id: Types.ObjectId;
        name: string;
        avatar: string;
        specialty: string;
      };
      recentSession = {
        id: recentSessionDoc._id.toString(),
        coach: {
          id: coach?._id?.toString() || '',
          name: coach?.name || 'Coach',
          avatar: coach?.avatar || '',
          specialty: coach?.specialty || '',
        },
        title: recentSessionDoc.title,
        summary: recentSessionDoc.summary,
        durationMs: recentSessionDoc.durationMs,
        createdAt: recentSessionDoc.createdAt.toISOString(),
      };
    }

    // Build recent insights from the latest evaluation
    const recentInsights: RecentInsight[] = [];
    if (evaluationsWithCommitments.length > 0) {
      const latestEval = evaluationsWithCommitments[0];
      for (const insight of latestEval.insights.slice(0, 3)) {
        recentInsights.push({
          title: insight.title,
          description: insight.description,
          impactLevel: insight.impactLevel,
        });
      }
    }

    // Weekly activity: sessions per day for last 7 days (Mon→Sun)
    const weeklyActivity = await this.getWeeklyActivity(userObjectId);

    // Performance scores, tips, and resources from latest evaluation
    const performanceScores: PerformanceScore[] = [];
    const tips: DashboardTip[] = [];
    const resources: DashboardResource[] = [];
    if (evaluationsWithCommitments.length > 0) {
      const latestEval = evaluationsWithCommitments[0];
      for (const score of latestEval.performanceScores || []) {
        performanceScores.push({
          name: score.name,
          score: score.score,
          category: score.category,
          description: score.description,
          nextLevelAdvice: score.nextLevelAdvice,
        });
      }
      for (const tip of (latestEval.tips || []).slice(0, 5)) {
        tips.push({
          title: tip.title,
          doAdvice: tip.doAdvice,
          dontAdvice: tip.dontAdvice,
          evidence: tip.evidence,
        });
      }
      for (const resource of (latestEval.resources || []).slice(0, 5)) {
        resources.push({
          type: resource.type,
          title: resource.title,
          author: resource.author,
          reasoning: resource.reasoning,
        });
      }
    }

    // Determine time of day
    const hour = new Date().getHours();
    let timeOfDay: TimeOfDay = 'morning';
    if (hour >= 17) timeOfDay = 'evening';
    else if (hour >= 12) timeOfDay = 'afternoon';

    return {
      greeting: {
        firstName: user?.firstName || 'there',
        timeOfDay,
      },
      stats: {
        totalSessions,
        currentStreak,
        commitmentsCompleted,
        commitmentsTotal,
        checkInStreak,
        todayCheckedIn,
      },
      activeCommitments,
      recentSession,
      recentInsights,
      weeklyActivity,
      performanceScores,
      tips,
      resources,
    };
  }

  /**
   * Update a specific commitment's status by array index
   */
  async updateCommitmentStatus(
    evaluationId: string,
    commitmentIndex: number,
    userId: string,
    status: CommitmentStatus
  ) {
    if (!Types.ObjectId.isValid(evaluationId)) {
      throw new Error('INVALID_EVALUATION_ID');
    }

    const evaluation = await SessionEvaluation.findOne({
      _id: new Types.ObjectId(evaluationId),
      userId: new Types.ObjectId(userId),
    });

    if (!evaluation) {
      throw new Error('EVALUATION_NOT_FOUND');
    }

    if (commitmentIndex < 0 || commitmentIndex >= evaluation.actionCommitments.length) {
      throw new Error('INVALID_COMMITMENT_INDEX');
    }

    const updatePath = `actionCommitments.${commitmentIndex}`;
    const updateFields: Record<string, unknown> = {
      [`${updatePath}.status`]: status,
    };

    if (status === 'completed') {
      updateFields[`${updatePath}.completedAt`] = new Date();
    } else {
      updateFields[`${updatePath}.completedAt`] = null;
    }

    await SessionEvaluation.updateOne(
      { _id: evaluation._id },
      { $set: updateFields }
    );

    return { success: true };
  }

  /**
   * Calculate consecutive-day session streak
   */
  private async calculateStreak(userId: Types.ObjectId): Promise<number> {
    try {
      const sessions = await VoiceSession.aggregate([
        { $match: { userId, status: 'ended' } },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
            },
          },
        },
        { $sort: { _id: -1 } },
        { $limit: 365 },
      ]);

      if (sessions.length === 0) return 0;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0];

      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      const dates = sessions.map((s: { _id: string }) => s._id);

      // Streak must start from today or yesterday
      if (dates[0] !== todayStr && dates[0] !== yesterdayStr) return 0;

      let streak = 1;
      for (let i = 1; i < dates.length; i++) {
        const prevDate = new Date(dates[i - 1]);
        const currDate = new Date(dates[i]);
        const diffDays =
          (prevDate.getTime() - currDate.getTime()) / (1000 * 60 * 60 * 24);

        if (diffDays === 1) {
          streak++;
        } else {
          break;
        }
      }

      return streak;
    } catch (error) {
      logger.error('Error calculating streak:', error);
      return 0;
    }
  }

  /**
   * Calculate consecutive days of check-ins from DailyEngagement
   */
  private async calculateCheckInStreak(userId: Types.ObjectId): Promise<number> {
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

  /**
   * Get weekly activity: session counts per day for the last 7 days
   */
  private async getWeeklyActivity(userId: Types.ObjectId): Promise<number[]> {
    try {
      const now = new Date();
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
      sevenDaysAgo.setHours(0, 0, 0, 0);

      const sessions = await VoiceSession.aggregate([
        {
          $match: {
            userId,
            status: 'ended',
            createdAt: { $gte: sevenDaysAgo },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
      ]);

      const countsByDate: Record<string, number> = {};
      for (const s of sessions) {
        countsByDate[s._id] = s.count;
      }

      // Build 7-day array from 6 days ago → today
      const result: number[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const key = d.toISOString().split('T')[0];
        result.push(countsByDate[key] || 0);
      }

      return result;
    } catch (error) {
      logger.error('Error getting weekly activity:', error);
      return [0, 0, 0, 0, 0, 0, 0];
    }
  }

  /**
   * Get insights data (commitments + performance + stats)
   */
  async getInsightsData(userId: string) {
    const userObjectId = new Types.ObjectId(userId);

    const evaluations = await SessionEvaluation.find({
      userId: userObjectId,
      status: 'completed',
    })
      .populate('coachId', 'name avatar')
      .sort({ createdAt: -1 })
      .lean();

    const activeCommitments: ActiveCommitment[] = [];
    const completedCommitments: (ActiveCommitment & { completedAt: string })[] = [];

    for (const evaluation of evaluations) {
      const coach = evaluation.coachId as unknown as {
        _id: Types.ObjectId;
        name: string;
        avatar: string;
      };

      for (let i = 0; i < evaluation.actionCommitments.length; i++) {
        const commitment = evaluation.actionCommitments[i];
        const status = commitment.status || 'pending';
        const item = {
          evaluationId: (evaluation as unknown as { _id: Types.ObjectId })._id.toString(),
          commitmentIndex: i,
          title: commitment.title,
          description: commitment.description,
          specifics: commitment.specifics,
          difficulty: commitment.difficulty,
          impactLevel: commitment.impactLevel,
          status,
          coach: {
            id: coach?._id?.toString() || '',
            name: coach?.name || 'Coach',
            avatar: coach?.avatar || '',
          },
          sessionDate: (evaluation as unknown as { createdAt: Date }).createdAt.toISOString(),
        };

        if (status === 'completed') {
          completedCommitments.push({
            ...item,
            completedAt: commitment.completedAt?.toISOString() || item.sessionDate,
          });
        } else {
          activeCommitments.push(item);
        }
      }
    }

    const totalCommitments = activeCommitments.length + completedCommitments.length;

    // Performance scores from latest evaluation
    const performanceScores: (PerformanceScore & { description: string })[] = [];
    if (evaluations.length > 0) {
      for (const score of evaluations[0].performanceScores || []) {
        performanceScores.push({
          name: score.name,
          score: score.score,
          description: score.description,
        });
      }
    }

    const overallScore = performanceScores.length > 0
      ? Math.round(performanceScores.reduce((sum, s) => sum + s.score, 0) / performanceScores.length * 10) / 10
      : 0;

    return {
      activeCommitments,
      completedCommitments,
      performanceScores,
      overallScore,
      stats: {
        totalCommitments,
        completedCount: completedCommitments.length,
        activeCount: activeCommitments.length,
        completionRate: totalCommitments > 0
          ? Math.round((completedCommitments.length / totalCommitments) * 100)
          : 0,
      },
    };
  }
}

export const dashboardService = new DashboardService();
