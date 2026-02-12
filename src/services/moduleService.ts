/**
 * Module Service
 * Handles AI-powered module generation, enrollment, and daily step content.
 * Uses OpenAI Chat Completions for text generation and Realtime API for voice reflections.
 */

import { Types } from 'mongoose';
import { z } from 'zod';
import { GeneratedModule, IGeneratedModule, ModuleColor } from '../models/GeneratedModule';
import { ModuleEnrollment, IModuleEnrollment } from '../models/ModuleEnrollment';
import { VoiceSession } from '../models/VoiceSession';
import { Transcript, ITranscriptSpeaker } from '../models/Transcript';
import { Coach } from '../models/Coach';
import { Avatar } from '../models/Avatar';
import { User } from '../models/User';
import { logger } from '../config/logger';
import {
  MODULE_GENERATION_SYSTEM_PROMPT,
  buildModuleGenerationPrompt,
  FRAME_SYSTEM_PROMPT,
  buildFramePrompt,
  buildReflectVoiceInstructions,
  SHIFT_SYSTEM_PROMPT,
  buildShiftPrompt,
  TRANSCRIPT_SUMMARY_SYSTEM_PROMPT,
  buildTranscriptSummaryPrompt,
  COMPLETION_QUOTE_SYSTEM_PROMPT,
  buildCompletionQuotePrompt,
} from '../prompts/moduleSteps';

// Module colors assigned in order
const MODULE_COLORS: ModuleColor[] = ['amber', 'violet', 'emerald'];

// Valid OpenAI Realtime API voices (keep in sync with API docs)
const VALID_VOICES = new Set([
  'alloy', 'ash', 'ballad', 'coral', 'echo',
  'sage', 'shimmer', 'verse', 'marin', 'cedar',
]);
const DEFAULT_VOICE = 'alloy';

function validateVoice(voice: string): string {
  if (VALID_VOICES.has(voice)) return voice;
  logger.warn(`[Voice] Invalid voice "${voice}", falling back to "${DEFAULT_VOICE}"`);
  return DEFAULT_VOICE;
}

// Gender-aware voice mapping (same as sessionService)
const GENDER_TONE_TO_VOICE: Record<string, Record<string, string>> = {
  female: {
    professional: 'shimmer', warm: 'shimmer', direct: 'coral', casual: 'coral', challenging: 'coral',
  },
  male: {
    professional: 'alloy', warm: 'echo', direct: 'echo', casual: 'coral', challenging: 'ash',
  },
};
const TONE_TO_VOICE: Record<string, string> = {
  professional: 'alloy', warm: 'shimmer', direct: 'echo', casual: 'coral', challenging: 'ash',
};

const LANGUAGE_TO_CODE: Record<string, string> = {
  English: 'en', Spanish: 'es', French: 'fr', German: 'de',
  Italian: 'it', Portuguese: 'pt', Japanese: 'ja', Korean: 'ko',
};

function languageToCode(language?: string): string {
  if (!language) return 'en';
  return LANGUAGE_TO_CODE[language] || 'en';
}

// Zod schema for validating module generation response
const generatedModuleDaySchema = z.object({
  dayNumber: z.number(),
  title: z.string(),
  subtitle: z.string(),
  goal: z.string(),
  framework: z.string(),
  frameworkDescription: z.string(),
  reflectionPrompt: z.string(),
  shiftFocus: z.string(),
});

const generatedModuleSchema = z.object({
  title: z.string(),
  subtitle: z.string(),
  description: z.string(),
  outcome: z.string(),
  icon: z.string().optional(),
  totalDays: z.number().min(5).max(7),
  minutesPerDay: z.number().optional(),
  type: z.enum(['sprint', 'pattern_breaker', 'foundation']).optional(),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  days: z.array(generatedModuleDaySchema),
});

const moduleGenerationResponseSchema = z.object({
  modules: z.array(generatedModuleSchema).min(2).max(3),
});

// Zod schemas for structured step responses
const structuredFrameSchema = z.object({
  hook: z.string(),
  frameworkName: z.string(),
  frameworkExplanation: z.string(),
  personalConnection: z.string(),
  keyInsight: z.string(),
  reflectionTeaser: z.string(),
});

const structuredShiftSchema = z.object({
  bridge: z.string(),
  action: z.string(),
  timeEstimate: z.string(),
  whyItMatters: z.string(),
  checkInQuestion: z.string().optional(),
});

const structuredReflectionSummarySchema = z.object({
  summary: z.string(),
  keyInsight: z.string().optional(),
  frameworkConnection: z.string().optional(),
  growthNote: z.string().optional(),
});

interface OpenAISessionResponse {
  id: string;
  client_secret: {
    value: string;
    expires_at: number;
  };
}

class ModuleService {
  // ============================================================
  // Private: OpenAI helpers
  // ============================================================

  /**
   * Call OpenAI Chat Completions API (text generation)
   */
  private async callOpenAI(
    systemPrompt: string,
    userPrompt: string,
    jsonMode: boolean = false
  ): Promise<string> {
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) throw new Error('OPENAI_API_KEY not configured');

    const model = process.env.OPENAI_MODULE_MODEL || 'gpt-4o-mini';

    const body: Record<string, unknown> = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.8,
      max_tokens: jsonMode ? 4096 : 1024,
    };

    if (jsonMode) {
      body.response_format = { type: 'json_object' };
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('OpenAI API error:', errorText);
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

    return content.trim();
  }

  /**
   * Get ephemeral token from OpenAI Realtime API for voice sessions
   */
  private async getOpenAIEphemeralToken(
    instructions: string,
    voice: string
  ): Promise<OpenAISessionResponse> {
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) throw new Error('OPENAI_API_KEY not configured');

    const buildBody = (v: string) => JSON.stringify({
      model: 'gpt-4o-realtime-preview',
      voice: v,
      instructions,
      input_audio_format: 'pcm16',
      output_audio_format: 'pcm16',
      input_audio_transcription: { model: 'whisper-1' },
      turn_detection: {
        type: 'server_vad',
        threshold: 0.5,
        prefix_padding_ms: 300,
        silence_duration_ms: 2500,
      },
    });

    const headers = {
      Authorization: `Bearer ${openaiKey}`,
      'Content-Type': 'application/json',
    };

    const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST', headers, body: buildBody(voice),
    });

    if (!response.ok) {
      const errorText = await response.text();

      // Failsafe: if the voice was rejected, retry with default voice
      if (errorText.includes('Invalid value') && voice !== DEFAULT_VOICE) {
        logger.warn(`[Voice] Voice "${voice}" rejected by OpenAI, retrying with "${DEFAULT_VOICE}"`);
        const retryResponse = await fetch('https://api.openai.com/v1/realtime/sessions', {
          method: 'POST', headers, body: buildBody(DEFAULT_VOICE),
        });
        if (retryResponse.ok) {
          return retryResponse.json() as Promise<OpenAISessionResponse>;
        }
        const retryError = await retryResponse.text();
        logger.error('OpenAI Realtime API retry error:', retryError);
      } else {
        logger.error('OpenAI Realtime API error:', errorText);
      }

      throw new Error('OPENAI_API_ERROR');
    }

    return response.json() as Promise<OpenAISessionResponse>;
  }

  /**
   * Resolve voice for a coach (gender-aware mapping)
   */
  private async resolveVoice(coach: { tone?: string; avatarId?: Types.ObjectId }): Promise<string> {
    const tone = coach.tone || 'professional';

    if (coach.avatarId) {
      try {
        const avatar = await Avatar.findById(coach.avatarId);
        if (avatar?.characteristics?.gender) {
          const genderMap = GENDER_TONE_TO_VOICE[avatar.characteristics.gender];
          if (genderMap) return validateVoice(genderMap[tone] || genderMap.professional);
        }
      } catch {
        // Fall through to tone-only mapping
      }
    }

    return validateVoice(TONE_TO_VOICE[tone] || DEFAULT_VOICE);
  }

  // ============================================================
  // Private: Summary chain helper
  // ============================================================

  /**
   * Build summary chain from completed days for context injection
   */
  private buildPreviousDaySummaries(enrollment: IModuleEnrollment): string {
    if (!enrollment.completedDays.length) return '';

    const summaries = enrollment.completedDays
      .sort((a, b) => a.dayNumber - b.dayNumber)
      .map((d) => {
        let summary = `Day ${d.dayNumber}:`;
        if (d.reflectionSummary) summary += ` ${d.reflectionSummary}`;
        if (d.shiftAction) summary += ` Action taken: ${d.shiftAction}`;
        return summary;
      })
      .join('\n');

    // Cap at 1500 chars
    return summaries.length > 1500
      ? summaries.substring(0, 1500) + '\n[...earlier days truncated]'
      : summaries;
  }

  /**
   * Sanitize module for API response
   */
  private sanitizeModule(module: IGeneratedModule) {
    return {
      id: module._id.toString(),
      userId: module.userId.toString(),
      title: module.title,
      subtitle: module.subtitle,
      description: module.description,
      outcome: module.outcome,
      moduleColor: module.moduleColor,
      icon: module.icon,
      totalDays: module.totalDays,
      minutesPerDay: module.minutesPerDay,
      type: module.type,
      difficulty: module.difficulty,
      days: module.days,
      status: module.status,
      createdAt: module.createdAt.toISOString(),
    };
  }

  /**
   * Sanitize enrollment for API response
   */
  private sanitizeEnrollment(enrollment: IModuleEnrollment) {
    return {
      id: enrollment._id.toString(),
      moduleId: enrollment.moduleId.toString(),
      currentDay: enrollment.currentDay,
      completedDays: enrollment.completedDays.map((d) => ({
        dayNumber: d.dayNumber,
        completedAt: d.completedAt.toISOString(),
        reflectionSummary: d.reflectionSummary,
        shiftAction: d.shiftAction,
        voiceSessionId: d.voiceSessionId?.toString(),
      })),
      status: enrollment.status,
      startedAt: enrollment.startedAt.toISOString(),
      completedAt: enrollment.completedAt?.toISOString(),
    };
  }

  // ============================================================
  // Public: Module Generation
  // ============================================================

  /**
   * Generate personalized modules from user context
   */
  async generateModules(userId: string) {
    logger.info(`[Modules] Generating modules for user=${userId}`);

    const user = await User.findById(userId);
    if (!user) throw new Error('USER_NOT_FOUND');
    if (!user.personalContext) throw new Error('NO_PERSONAL_CONTEXT');

    // Check if modules already exist
    const existing = await GeneratedModule.find({
      userId: new Types.ObjectId(userId),
      status: 'ready',
    });
    if (existing.length > 0) {
      logger.info(`[Modules] Modules already exist for user=${userId}, returning existing`);
      return existing.map((m) => this.sanitizeModule(m));
    }

    // Generate via OpenAI
    const userPrompt = buildModuleGenerationPrompt(
      user.personalContext,
      user.firstName,
      user.language || 'English'
    );

    const rawResponse = await this.callOpenAI(
      MODULE_GENERATION_SYSTEM_PROMPT,
      userPrompt,
      true // JSON mode
    );

    // Parse and validate
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawResponse);
    } catch {
      logger.error('[Modules] Failed to parse generation response:', rawResponse.substring(0, 300));
      throw new Error('OPENAI_API_ERROR');
    }

    const result = moduleGenerationResponseSchema.safeParse(parsed);
    if (!result.success) {
      logger.error('[Modules] Validation failed:', result.error.issues);
      throw new Error('OPENAI_API_ERROR');
    }

    // Save to DB with color assignments
    const modules: IGeneratedModule[] = [];
    for (let i = 0; i < result.data.modules.length; i++) {
      const mod = result.data.modules[i];
      const created = await GeneratedModule.create({
        userId: new Types.ObjectId(userId),
        title: mod.title,
        subtitle: mod.subtitle,
        description: mod.description,
        outcome: mod.outcome,
        moduleColor: MODULE_COLORS[i % MODULE_COLORS.length],
        icon: mod.icon || 'bulb-outline',
        totalDays: mod.totalDays,
        minutesPerDay: mod.minutesPerDay || 10,
        type: mod.type || 'sprint',
        difficulty: mod.difficulty || 'intermediate',
        days: mod.days.map((d, dayIndex) => ({
          ...d,
          dayNumber: dayIndex + 1,
        })),
        status: 'ready',
      });
      modules.push(created);
    }

    logger.info(`[Modules] Generated ${modules.length} modules for user=${userId}`);
    return modules.map((m) => this.sanitizeModule(m));
  }

  /**
   * Get user's generated modules
   */
  async getModules(userId: string) {
    const modules = await GeneratedModule.find({
      userId: new Types.ObjectId(userId),
      status: 'ready',
    }).sort({ createdAt: 1 });

    return modules.map((m) => this.sanitizeModule(m));
  }

  // ============================================================
  // Public: Enrollment
  // ============================================================

  /**
   * Enroll user in a module
   */
  async enrollInModule(userId: string, moduleId: string) {
    if (!Types.ObjectId.isValid(moduleId)) throw new Error('INVALID_MODULE_ID');

    const module = await GeneratedModule.findOne({
      _id: new Types.ObjectId(moduleId),
      userId: new Types.ObjectId(userId),
    });
    if (!module) throw new Error('MODULE_NOT_FOUND');

    // Check for existing active enrollment in this module
    const existing = await ModuleEnrollment.findOne({
      userId: new Types.ObjectId(userId),
      moduleId: new Types.ObjectId(moduleId),
      status: 'active',
    });
    if (existing) {
      return this.sanitizeEnrollment(existing);
    }

    const enrollment = await ModuleEnrollment.create({
      userId: new Types.ObjectId(userId),
      moduleId: new Types.ObjectId(moduleId),
      currentDay: 1,
      status: 'active',
    });

    logger.info(`[Modules] Enrolled user=${userId} in module=${moduleId}`);
    return this.sanitizeEnrollment(enrollment);
  }

  /**
   * Get enrollment for a specific module
   */
  async getEnrollment(userId: string, moduleId: string) {
    const enrollment = await ModuleEnrollment.findOne({
      userId: new Types.ObjectId(userId),
      moduleId: new Types.ObjectId(moduleId),
      status: { $in: ['active', 'completed'] },
    });

    return enrollment ? this.sanitizeEnrollment(enrollment) : null;
  }

  /**
   * Get all active enrollments for a user
   */
  async getActiveEnrollments(userId: string) {
    const enrollments = await ModuleEnrollment.find({
      userId: new Types.ObjectId(userId),
      status: 'active',
    });

    return enrollments.map((e) => this.sanitizeEnrollment(e));
  }

  // ============================================================
  // Public: Daily Steps
  // ============================================================

  /**
   * Generate personalized Frame content for a day
   */
  async generateFrame(userId: string, moduleId: string, dayNumber: number) {
    logger.info(`[Modules] Generating frame: user=${userId} module=${moduleId} day=${dayNumber}`);

    const module = await GeneratedModule.findOne({
      _id: new Types.ObjectId(moduleId),
      userId: new Types.ObjectId(userId),
    });
    if (!module) throw new Error('MODULE_NOT_FOUND');

    const day = module.days.find((d) => d.dayNumber === dayNumber);
    if (!day) throw new Error('DAY_NOT_FOUND');

    const user = await User.findById(userId);
    if (!user) throw new Error('USER_NOT_FOUND');

    const enrollment = await ModuleEnrollment.findOne({
      userId: new Types.ObjectId(userId),
      moduleId: new Types.ObjectId(moduleId),
      status: 'active',
    });

    const previousDaySummaries = enrollment
      ? this.buildPreviousDaySummaries(enrollment)
      : '';

    const rawContent = await this.callOpenAI(
      FRAME_SYSTEM_PROMPT,
      buildFramePrompt({
        moduleTitle: module.title,
        moduleTheme: module.description,
        dayNumber: day.dayNumber,
        totalDays: module.totalDays,
        dayTitle: day.title,
        framework: day.framework,
        frameworkDescription: day.frameworkDescription,
        personalContext: user.personalContext,
        userName: user.firstName,
        previousDaySummaries,
        language: user.language || 'English',
      }),
      true // JSON mode
    );

    // Try to parse structured response, fallback to plain text
    try {
      const parsed = JSON.parse(rawContent);
      const result = structuredFrameSchema.safeParse(parsed);
      if (result.success) {
        return { content: result.data.hook, structured: result.data };
      }
    } catch {
      logger.warn('[Modules] Frame response not valid JSON, using as plain text');
    }

    return { content: rawContent };
  }

  /**
   * Start a voice reflection session for a module day
   * Returns session data + ephemeral token for WebRTC
   */
  async startReflectSession(userId: string, moduleId: string, dayNumber: number) {
    logger.info(`[Modules] Starting reflect session: user=${userId} module=${moduleId} day=${dayNumber}`);

    const module = await GeneratedModule.findOne({
      _id: new Types.ObjectId(moduleId),
      userId: new Types.ObjectId(userId),
    });
    if (!module) throw new Error('MODULE_NOT_FOUND');

    const day = module.days.find((d) => d.dayNumber === dayNumber);
    if (!day) throw new Error('DAY_NOT_FOUND');

    const user = await User.findById(userId);
    if (!user) throw new Error('USER_NOT_FOUND');

    const enrollment = await ModuleEnrollment.findOne({
      userId: new Types.ObjectId(userId),
      moduleId: new Types.ObjectId(moduleId),
      status: 'active',
    });

    const previousDaySummaries = enrollment
      ? this.buildPreviousDaySummaries(enrollment)
      : '';

    // Build module-specific voice instructions
    const instructions = buildReflectVoiceInstructions(
      module.title,
      day.title,
      day.framework,
      day.frameworkDescription,
      day.reflectionPrompt,
      user.personalContext,
      previousDaySummaries,
      user.language || 'English'
    );

    // Find user's primary coach for voice mapping
    const coach = await Coach.findOne({
      $or: [
        { createdBy: new Types.ObjectId(userId) },
        { createdBy: 'system', isFeatured: true },
      ],
    }).sort({ lastUsedAt: -1 });

    const voice = coach
      ? await this.resolveVoice(coach)
      : 'alloy';

    // Get ephemeral token
    const openaiSession = await this.getOpenAIEphemeralToken(instructions, voice);

    // Mark any existing active sessions as abandoned
    await VoiceSession.updateMany(
      { userId: new Types.ObjectId(userId), status: 'active' },
      { status: 'abandoned', endedAt: new Date() }
    );

    // Build speakers
    const speakers: ITranscriptSpeaker[] = [
      { id: 'user', name: user.firstName || 'User', role: 'user' },
      { id: 'coach', name: 'Reflection Guide', role: 'coach' },
    ];

    // Create VoiceSession with type 'module'
    const session = await VoiceSession.create({
      userId: new Types.ObjectId(userId),
      coachId: coach?._id || new Types.ObjectId(),
      type: 'regular',
      status: 'active',
      openaiSessionId: openaiSession.id,
      startedAt: new Date(),
    });

    // Create transcript document
    const transcript = await Transcript.create({
      sessionId: session._id,
      userId: new Types.ObjectId(userId),
      coachId: coach?._id || new Types.ObjectId(),
      speakers,
      utterances: [],
      metadata: { totalUtterances: 0, language: languageToCode(user.language) },
    });

    session.transcriptId = transcript._id;
    await session.save();

    logger.info(`[Modules] Reflect session started: ${session._id}`);

    return {
      sessionId: session._id.toString(),
      token: openaiSession.client_secret.value,
      tokenExpiresAt: openaiSession.client_secret.expires_at,
      wsUrl: 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview',
      speakers,
      coachName: coach?.name || 'Reflection Guide',
      coachAvatar: coach?.avatar || '',
    };
  }

  /**
   * Complete a reflection — extract summary from voice transcript
   */
  async completeReflection(userId: string, moduleId: string, dayNumber: number, sessionId: string) {
    logger.info(`[Modules] Completing reflection: session=${sessionId}`);

    if (!Types.ObjectId.isValid(sessionId)) throw new Error('INVALID_SESSION_ID');

    const module = await GeneratedModule.findOne({
      _id: new Types.ObjectId(moduleId),
      userId: new Types.ObjectId(userId),
    });
    if (!module) throw new Error('MODULE_NOT_FOUND');

    const day = module.days.find((d) => d.dayNumber === dayNumber);
    if (!day) throw new Error('DAY_NOT_FOUND');

    // Get transcript from the voice session
    const transcript = await Transcript.findOne({
      sessionId: new Types.ObjectId(sessionId),
    });

    let reflectionSummary = 'User completed voice reflection.';
    let structuredResult: {
      reflectionSummary: string;
      keyInsight?: string;
      frameworkConnection?: string;
      growthNote?: string;
    } = { reflectionSummary };

    if (transcript && transcript.utterances.length > 0) {
      // Format transcript text
      const speakerMap = new Map(transcript.speakers.map((s) => [s.id, s.name]));
      const transcriptText = transcript.utterances
        .map((u) => `[${speakerMap.get(u.speakerId) || u.speakerId}]: ${u.content}`)
        .join('\n');

      // Extract structured summary via AI (JSON mode)
      try {
        const rawSummary = await this.callOpenAI(
          TRANSCRIPT_SUMMARY_SYSTEM_PROMPT,
          buildTranscriptSummaryPrompt(transcriptText, day.framework, day.reflectionPrompt),
          true // JSON mode
        );

        try {
          const parsed = JSON.parse(rawSummary);
          const result = structuredReflectionSummarySchema.safeParse(parsed);
          if (result.success) {
            reflectionSummary = result.data.summary;
            structuredResult = {
              reflectionSummary: result.data.summary,
              keyInsight: result.data.keyInsight,
              frameworkConnection: result.data.frameworkConnection,
              growthNote: result.data.growthNote,
            };
          } else {
            reflectionSummary = rawSummary;
          }
        } catch {
          reflectionSummary = rawSummary;
        }
      } catch (err) {
        logger.warn('[Modules] Failed to extract summary, using default:', err);
      }
    }

    // Save reflection summary to enrollment
    const enrollment = await ModuleEnrollment.findOne({
      userId: new Types.ObjectId(userId),
      moduleId: new Types.ObjectId(moduleId),
      status: 'active',
    });

    if (enrollment) {
      // Check if this day already has a completion record, update if so
      const existingDay = enrollment.completedDays.find((d) => d.dayNumber === dayNumber);
      if (existingDay) {
        existingDay.reflectionSummary = reflectionSummary;
        existingDay.voiceSessionId = new Types.ObjectId(sessionId);
      } else {
        // Create a partial completion (day not fully complete yet — will be finalized in completeDay)
        enrollment.completedDays.push({
          dayNumber,
          completedAt: new Date(),
          reflectionSummary,
          voiceSessionId: new Types.ObjectId(sessionId),
        });
      }
      await enrollment.save();
    }

    logger.info(`[Modules] Reflection completed for day ${dayNumber}: ${reflectionSummary.substring(0, 100)}`);
    return structuredResult;
  }

  /**
   * Generate personalized Shift (micro-action) content for a day
   */
  async generateShift(userId: string, moduleId: string, dayNumber: number) {
    logger.info(`[Modules] Generating shift: user=${userId} module=${moduleId} day=${dayNumber}`);

    const module = await GeneratedModule.findOne({
      _id: new Types.ObjectId(moduleId),
      userId: new Types.ObjectId(userId),
    });
    if (!module) throw new Error('MODULE_NOT_FOUND');

    const day = module.days.find((d) => d.dayNumber === dayNumber);
    if (!day) throw new Error('DAY_NOT_FOUND');

    const user = await User.findById(userId);
    if (!user) throw new Error('USER_NOT_FOUND');

    // Get reflection summary for this day
    const enrollment = await ModuleEnrollment.findOne({
      userId: new Types.ObjectId(userId),
      moduleId: new Types.ObjectId(moduleId),
      status: 'active',
    });

    const completedDay = enrollment?.completedDays.find((d) => d.dayNumber === dayNumber);
    const reflectionSummary = completedDay?.reflectionSummary || 'No reflection available.';

    const rawContent = await this.callOpenAI(
      SHIFT_SYSTEM_PROMPT,
      buildShiftPrompt({
        moduleTitle: module.title,
        dayTitle: day.title,
        framework: day.framework,
        shiftFocus: day.shiftFocus,
        reflectionSummary,
        personalContext: user.personalContext,
        language: user.language || 'English',
      }),
      true // JSON mode
    );

    // Try to parse structured response, fallback to plain text
    try {
      const parsed = JSON.parse(rawContent);
      const result = structuredShiftSchema.safeParse(parsed);
      if (result.success) {
        return { content: result.data.action, structured: result.data };
      }
    } catch {
      logger.warn('[Modules] Shift response not valid JSON, using as plain text');
    }

    return { content: rawContent };
  }

  /**
   * Mark a day as complete
   */
  async completeDay(
    userId: string,
    moduleId: string,
    dayNumber: number,
    shiftAction?: string
  ) {
    logger.info(`[Modules] Completing day: user=${userId} module=${moduleId} day=${dayNumber}`);

    const enrollment = await ModuleEnrollment.findOne({
      userId: new Types.ObjectId(userId),
      moduleId: new Types.ObjectId(moduleId),
      status: 'active',
    });
    if (!enrollment) throw new Error('ENROLLMENT_NOT_FOUND');

    const module = await GeneratedModule.findById(moduleId);
    if (!module) throw new Error('MODULE_NOT_FOUND');

    // Update or create completed day record
    const existingDay = enrollment.completedDays.find((d) => d.dayNumber === dayNumber);
    if (existingDay) {
      existingDay.completedAt = new Date();
      if (shiftAction) existingDay.shiftAction = shiftAction;
    } else {
      enrollment.completedDays.push({
        dayNumber,
        completedAt: new Date(),
        shiftAction,
      });
    }

    // Advance to next day
    if (dayNumber >= enrollment.currentDay) {
      enrollment.currentDay = dayNumber + 1;
    }

    // Check if module is complete
    const isModuleComplete = dayNumber >= module.totalDays;
    if (isModuleComplete) {
      enrollment.status = 'completed';
      enrollment.completedAt = new Date();
      logger.info(`[Modules] Module completed: user=${userId} module=${moduleId}`);
    }

    await enrollment.save();

    // Get the completed day record for summary data
    const completedDay = enrollment.completedDays.find((d) => d.dayNumber === dayNumber);

    // Build next day preview (dayNumber is 1-indexed, days array is 0-indexed)
    const nextDayData = !isModuleComplete && dayNumber < module.totalDays
      ? module.days.find((d) => d.dayNumber === dayNumber + 1)
      : null;

    // Generate shareable completion quote if module is complete
    let completionQuote: { quote: string; attribution: string } | null = null;
    if (isModuleComplete) {
      try {
        const user = await User.findById(userId);
        const reflectionSummaries = enrollment.completedDays.map((d) => d.reflectionSummary || '');
        const shiftActions = enrollment.completedDays.map((d) => d.shiftAction || '');

        const rawQuote = await this.callOpenAI(
          COMPLETION_QUOTE_SYSTEM_PROMPT,
          buildCompletionQuotePrompt(
            module.title,
            module.totalDays,
            reflectionSummaries,
            shiftActions,
            user?.firstName
          ),
          true
        );

        const parsed = JSON.parse(rawQuote);
        if (parsed.quote && parsed.attribution) {
          completionQuote = { quote: parsed.quote, attribution: parsed.attribution };
        }
      } catch (err) {
        logger.warn('[Modules] Failed to generate completion quote:', err);
      }
    }

    return {
      ...this.sanitizeEnrollment(enrollment),
      dayStats: {
        dayNumber,
        totalDays: module.totalDays,
        reflectionSummary: completedDay?.reflectionSummary || null,
        shiftAction: shiftAction || completedDay?.shiftAction || null,
        streak: this.calculateModuleStreak(enrollment),
        nextDay: nextDayData
          ? { title: nextDayData.title, subtitle: nextDayData.subtitle }
          : null,
        isModuleComplete,
        completionQuote,
      },
    };
  }

  /**
   * Calculate consecutive day streak from most recent completed day
   */
  private calculateModuleStreak(enrollment: IModuleEnrollment): number {
    if (!enrollment.completedDays.length) return 0;

    const completedNums = enrollment.completedDays
      .map((d) => d.dayNumber)
      .sort((a, b) => b - a); // descending

    let streak = 1;
    for (let i = 0; i < completedNums.length - 1; i++) {
      if (completedNums[i] - completedNums[i + 1] === 1) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  }
}

export const moduleService = new ModuleService();
