/**
 * Evaluation Service
 * Handles AI-powered post-session evaluation generation using OpenAI Chat Completions API
 */

import { Types } from 'mongoose';
import { z } from 'zod';
import { VoiceSession } from '../models/VoiceSession';
import { Transcript, ITranscriptUtterance, ITranscriptSpeaker } from '../models/Transcript';
import { Coach } from '../models/Coach';
import { User } from '../models/User';
import {
  SessionEvaluation,
  ISessionEvaluation,
  IInsight,
  IActionCommitment,
  IPerformanceScore,
  ITip,
  IResource,
} from '../models/SessionEvaluation';
import { logger } from '../config/logger';

// --- Zod schema for validating AI response ---

const insightSchema = z.object({
  title: z.string(),
  description: z.string(),
  impactLevel: z.enum(['high', 'medium', 'low']),
  evidence: z.string(),
});

const commitmentSchema = z.object({
  title: z.string(),
  description: z.string(),
  specifics: z.array(z.string()),
  difficulty: z.enum(['easy', 'moderate', 'hard']),
  impactLevel: z.enum(['high', 'medium', 'low']),
});

const scoreSchema = z.object({
  category: z.string(),
  name: z.string(),
  score: z.number().min(0).max(10),
  description: z.string(),
  nextLevelAdvice: z.string(),
});

const tipSchema = z.object({
  title: z.string(),
  doAdvice: z.string(),
  dontAdvice: z.string(),
  evidence: z.string(),
});

const resourceSchema = z.object({
  type: z.enum(['book', 'article', 'podcast', 'video', 'course', 'exercise']),
  title: z.string(),
  author: z.string(),
  matchScore: z.number().min(0).max(100),
  reasoning: z.string(),
  url: z.string().optional(),
});

const evaluationResponseSchema = z.object({
  overallSummary: z.string(),
  insights: z.array(insightSchema).min(3),
  actionCommitments: z.array(commitmentSchema).min(3),
  performanceScores: z.array(scoreSchema).min(4),
  tips: z.array(tipSchema).min(3),
  resources: z.array(resourceSchema).min(3),
});

type EvaluationContent = z.infer<typeof evaluationResponseSchema>;

// --- System prompt ---

const SYSTEM_PROMPT = `You are an expert coaching session evaluator for MentorMind, an AI-powered coaching platform. Your task is to analyze voice coaching session transcripts and produce structured evaluations.

You must return a JSON object with this exact structure:
{
  "overallSummary": "2-3 sentence summary of the session",
  "insights": [
    {
      "title": "Short insight title (5-8 words)",
      "description": "2-3 sentence explanation of the insight",
      "impactLevel": "high" | "medium" | "low",
      "evidence": "Direct quote or close paraphrase from the transcript that supports this insight"
    }
  ],
  "actionCommitments": [
    {
      "title": "Action title (5-8 words)",
      "description": "What this commitment entails",
      "specifics": ["Specific step 1", "Specific step 2", "Specific step 3"],
      "difficulty": "easy" | "moderate" | "hard",
      "impactLevel": "high" | "medium" | "low"
    }
  ],
  "performanceScores": [
    {
      "category": "Category name",
      "name": "Display name for the score",
      "score": 7,
      "description": "Why this score was given",
      "nextLevelAdvice": "What to do to improve this score"
    }
  ],
  "tips": [
    {
      "title": "Tip title",
      "doAdvice": "What to do",
      "dontAdvice": "What to avoid",
      "evidence": "Why this tip is relevant based on the session"
    }
  ],
  "resources": [
    {
      "type": "book" | "article" | "podcast" | "video" | "course" | "exercise",
      "title": "Resource title",
      "author": "Author name",
      "matchScore": 85,
      "reasoning": "Why this resource matches the user's needs"
    }
  ]
}

Rules:
- At least 3 insights, 3 action commitments, 4 performance scores, 4 tips, and 3 resources
- Performance score categories must include: "Focus & Clarity", "Execution", "Soft Skills", "Growth"
- Evidence quotes should be actual words from the transcript, enclosed in quotation marks
- Resources should be real, well-known resources that relate to the session topics
- Match scores should be between 60-98 (never 100)
- Be encouraging but honest. Scores should reflect actual session quality
- All text should be concise and actionable
- Return ONLY the JSON object, no other text`;

// --- Service class ---

interface EvaluationContext {
  coachName: string;
  coachSpecialty: string;
  coachCategory: string;
  userGoals?: string;
  userChallenges?: string[];
}

class EvaluationService {
  /**
   * Format transcript utterances into readable dialogue
   */
  private formatTranscript(
    utterances: ITranscriptUtterance[],
    speakers: ITranscriptSpeaker[]
  ): string {
    const speakerNameMap = new Map(speakers.map((s) => [s.id, s.name]));

    return utterances
      .map((u) => {
        const name = speakerNameMap.get(u.speakerId) || u.speakerId;
        return `[${name}]: ${u.content}`;
      })
      .join('\n');
  }

  /**
   * Build the user prompt for OpenAI
   */
  private buildUserPrompt(transcript: string, context: EvaluationContext): string {
    let prompt = `Analyze this coaching session transcript and produce the evaluation.

Coach: ${context.coachName} (${context.coachSpecialty}, Category: ${context.coachCategory})`;

    if (context.userGoals) {
      prompt += `\nUser's Goals: ${context.userGoals}`;
    }
    if (context.userChallenges?.length) {
      prompt += `\nUser's Challenges: ${context.userChallenges.join(', ')}`;
    }

    prompt += `\n\nTranscript:\n${transcript}`;

    return prompt;
  }

  /**
   * Call OpenAI Chat Completions API
   */
  private async callOpenAI(
    transcript: string,
    context: EvaluationContext
  ): Promise<EvaluationContent> {
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const model = process.env.OPENAI_EVALUATION_MODEL || 'gpt-4o-mini';
    const userPrompt = this.buildUserPrompt(transcript, context);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('OpenAI Chat Completions API error:', errorText);
      throw new Error('OPENAI_API_ERROR');
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string | null } }[];
    };
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      logger.error('OpenAI returned empty content');
      throw new Error('OPENAI_API_ERROR');
    }

    return this.validateAIResponse(content);
  }

  /**
   * Parse and validate AI response JSON using Zod
   */
  private validateAIResponse(rawContent: string): EvaluationContent {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      logger.error('Failed to parse AI response as JSON:', rawContent.substring(0, 200));
      throw new Error('OPENAI_API_ERROR');
    }

    const result = evaluationResponseSchema.safeParse(parsed);
    if (!result.success) {
      logger.error('AI response validation failed:', result.error.issues);
      throw new Error('OPENAI_API_ERROR');
    }

    return result.data;
  }

  /**
   * Sanitize evaluation document for API response
   */
  private sanitizeEvaluation(evaluation: ISessionEvaluation) {
    return {
      id: evaluation._id.toString(),
      sessionId: evaluation.sessionId.toString(),
      userId: evaluation.userId.toString(),
      coachId: evaluation.coachId.toString(),
      status: evaluation.status,
      overallSummary: evaluation.overallSummary,
      insights: evaluation.insights,
      actionCommitments: evaluation.actionCommitments,
      performanceScores: evaluation.performanceScores,
      tips: evaluation.tips,
      resources: evaluation.resources,
      modelUsed: evaluation.modelUsed,
      generationTimeMs: evaluation.generationTimeMs,
      errorMessage: evaluation.errorMessage,
      createdAt: evaluation.createdAt.toISOString(),
      updatedAt: evaluation.updatedAt.toISOString(),
    };
  }

  /**
   * Generate evaluation for a completed session
   */
  async generateEvaluation(sessionId: string, userId: string) {
    if (!Types.ObjectId.isValid(sessionId)) {
      throw new Error('INVALID_SESSION_ID');
    }

    // Verify session exists, belongs to user, and is ended
    const session = await VoiceSession.findOne({
      _id: new Types.ObjectId(sessionId),
      userId: new Types.ObjectId(userId),
    });

    if (!session) {
      throw new Error('SESSION_NOT_FOUND');
    }

    if (session.status !== 'ended') {
      throw new Error('SESSION_NOT_ENDED');
    }

    // Check for existing evaluation
    const existing = await SessionEvaluation.findOne({ sessionId: session._id });
    if (existing && existing.status === 'completed') {
      throw new Error('EVALUATION_EXISTS');
    }

    // Fetch transcript, coach, and user in parallel
    const [transcript, coach, user] = await Promise.all([
      Transcript.findOne({ sessionId: session._id }),
      Coach.findById(session.coachId),
      User.findById(userId),
    ]);

    if (!transcript || transcript.utterances.length === 0) {
      throw new Error('TRANSCRIPT_EMPTY');
    }

    // Create or update evaluation document
    let evaluation = existing;
    if (!evaluation) {
      evaluation = await SessionEvaluation.create({
        sessionId: session._id,
        userId: new Types.ObjectId(userId),
        coachId: session.coachId,
        status: 'generating',
        modelUsed: process.env.OPENAI_EVALUATION_MODEL || 'gpt-4o-mini',
      });
    } else {
      evaluation.status = 'generating';
      evaluation.errorMessage = undefined;
      await evaluation.save();
    }

    const startTime = Date.now();

    try {
      // Format transcript and build context
      const formattedTranscript = this.formatTranscript(transcript.utterances, transcript.speakers);

      const context: EvaluationContext = {
        coachName: coach?.name || 'Coach',
        coachSpecialty: coach?.specialty || 'General',
        coachCategory: coach?.category || 'custom',
        userGoals: user?.context?.primaryGoals,
        userChallenges: user?.context?.keyChallenges,
      };

      // Call OpenAI
      const content = await this.callOpenAI(formattedTranscript, context);

      // Update evaluation with results
      evaluation.status = 'completed';
      evaluation.overallSummary = content.overallSummary;
      evaluation.insights = content.insights as IInsight[];
      evaluation.actionCommitments = content.actionCommitments as IActionCommitment[];
      evaluation.performanceScores = content.performanceScores as IPerformanceScore[];
      evaluation.tips = content.tips as ITip[];
      evaluation.resources = content.resources as IResource[];
      evaluation.generationTimeMs = Date.now() - startTime;
      await evaluation.save();

      logger.info(
        `Evaluation generated for session ${sessionId} in ${evaluation.generationTimeMs}ms`
      );

      return this.sanitizeEvaluation(evaluation);
    } catch (error) {
      // Mark as failed
      evaluation.status = 'failed';
      evaluation.errorMessage = error instanceof Error ? error.message : 'Unknown error';
      evaluation.generationTimeMs = Date.now() - startTime;
      await evaluation.save();

      logger.error(`Evaluation generation failed for session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Get evaluation for a session
   */
  async getEvaluation(sessionId: string, userId: string) {
    if (!Types.ObjectId.isValid(sessionId)) {
      throw new Error('INVALID_SESSION_ID');
    }

    // Verify session belongs to user
    const session = await VoiceSession.findOne({
      _id: new Types.ObjectId(sessionId),
      userId: new Types.ObjectId(userId),
    });

    if (!session) {
      throw new Error('SESSION_NOT_FOUND');
    }

    const evaluation = await SessionEvaluation.findOne({ sessionId: session._id });
    if (!evaluation) {
      throw new Error('EVALUATION_NOT_FOUND');
    }

    return this.sanitizeEvaluation(evaluation);
  }

  /**
   * Retry a failed evaluation
   */
  async retryEvaluation(sessionId: string, userId: string) {
    if (!Types.ObjectId.isValid(sessionId)) {
      throw new Error('INVALID_SESSION_ID');
    }

    const session = await VoiceSession.findOne({
      _id: new Types.ObjectId(sessionId),
      userId: new Types.ObjectId(userId),
    });

    if (!session) {
      throw new Error('SESSION_NOT_FOUND');
    }

    const evaluation = await SessionEvaluation.findOne({ sessionId: session._id });
    if (!evaluation) {
      throw new Error('EVALUATION_NOT_FOUND');
    }

    if (evaluation.status !== 'failed') {
      throw new Error('EVALUATION_NOT_FAILED');
    }

    // Re-generate by calling the main generation method
    // Delete the failed evaluation first so generateEvaluation creates a fresh one
    await SessionEvaluation.deleteOne({ _id: evaluation._id });

    return this.generateEvaluation(sessionId, userId);
  }
}

export const evaluationService = new EvaluationService();
