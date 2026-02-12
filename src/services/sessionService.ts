/**
 * Session Service
 * Handles voice coaching session business logic including OpenAI Realtime API integration
 */

import { Types } from 'mongoose';
import { VoiceSession, IVoiceSession, SessionStatus } from '../models/VoiceSession';
import { Transcript, ITranscriptSpeaker } from '../models/Transcript';
import { Coach, ICoach } from '../models/Coach';
import { User, IUser } from '../models/User';
import { Avatar } from '../models/Avatar';
import { logger } from '../config/logger';
import { subscriptionService } from './subscriptionService';
import { buildSessionInstructions } from '../prompts/sessionInstructions';
import {
  CONTEXT_EXTRACTION_SYSTEM_MESSAGE,
  buildContextExtractionPrompt,
} from '../prompts/contextExtraction';

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

// Gender-aware voice mapping: gender → tone → OpenAI voice
const GENDER_TONE_TO_VOICE: Record<string, Record<string, string>> = {
  female: {
    professional: 'shimmer',
    warm: 'shimmer',
    supportive: 'shimmer',
    direct: 'coral',
    casual: 'coral',
    challenging: 'coral',
  },
  male: {
    professional: 'alloy',
    warm: 'echo',
    supportive: 'echo',
    direct: 'echo',
    casual: 'coral',
    challenging: 'ash',
  },
};

// Fallback: tone-only mapping when gender is unknown
const TONE_TO_VOICE: Record<string, string> = {
  professional: 'alloy',
  warm: 'shimmer',
  supportive: 'shimmer',
  direct: 'echo',
  casual: 'coral',
  challenging: 'ash',
};

// Language name to ISO 639-1 code mapping
const LANGUAGE_TO_CODE: Record<string, string> = {
  English: 'en', Spanish: 'es', French: 'fr', German: 'de',
  Italian: 'it', Portuguese: 'pt', Japanese: 'ja', Korean: 'ko',
  'Chinese (Mandarin)': 'zh', Dutch: 'nl', Russian: 'ru', Hindi: 'hi',
  Arabic: 'ar', Turkish: 'tr', Polish: 'pl', Swedish: 'sv',
  Norwegian: 'no', Danish: 'da', Finnish: 'fi', Czech: 'cs',
  Romanian: 'ro', Ukrainian: 'uk', Vietnamese: 'vi', Thai: 'th',
  Indonesian: 'id', Malay: 'ms', Greek: 'el', Hebrew: 'he',
};

function languageToCode(language?: string): string {
  if (!language) return 'en';
  return LANGUAGE_TO_CODE[language] || 'en';
}

interface StartSessionData {
  coachId: string;
  type?: 'regular' | 'onboarding';
}

interface TranscriptUtteranceData {
  entryId: string;
  speakerId: string; // 'user' | 'coach'
  content: string;
  timestamp: number; // Unix timestamp ms
  startOffsetMs: number;
  endOffsetMs: number;
  confidence?: number;
}

interface SaveTranscriptData {
  speakers: ITranscriptSpeaker[];
  utterances: TranscriptUtteranceData[];
}

interface EndSessionData {
  durationMs: number;
  finalUtterances?: TranscriptUtteranceData[];
  speakers?: ITranscriptSpeaker[];
}

interface SessionFilters {
  coachId?: string;
  status?: SessionStatus;
  page?: number;
  limit?: number;
}

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface OpenAISessionResponse {
  id: string;
  object: string;
  model: string;
  client_secret: {
    value: string;
    expires_at: number;
  };
}

class SessionService {
  /**
   * Build system instructions from coach and user context
   */
  private buildInstructions(coach: ICoach, user: IUser, sessionHistory: string = ''): string {
    return buildSessionInstructions(coach, user, sessionHistory);
  }

  /**
   * Resolve OpenAI voice based on coach tone and avatar gender.
   * Female avatars get feminine voices, male avatars get masculine voices.
   */
  private async resolveVoice(coach: ICoach): Promise<string> {
    const tone = coach.tone || 'professional';

    if (coach.avatarId) {
      try {
        const avatar = await Avatar.findById(coach.avatarId);
        if (avatar?.characteristics?.gender) {
          const gender = avatar.characteristics.gender;
          const genderMap = GENDER_TONE_TO_VOICE[gender];
          if (genderMap) {
            const voice = validateVoice(genderMap[tone] || genderMap.professional);
            logger.info(`[Voice] Resolved gender-aware voice: gender=${gender} tone=${tone} → ${voice}`);
            return voice;
          }
        }
      } catch (err) {
        logger.warn('[Voice] Failed to resolve avatar gender, falling back to tone-only mapping');
      }
    }

    return validateVoice(TONE_TO_VOICE[tone] || DEFAULT_VOICE);
  }

  /**
   * Build session history context for multi-session awareness.
   * Queries last 5 ended sessions with the same coach and builds a markdown summary.
   */
  private async buildSessionHistoryContext(
    userId: string,
    coachId: string
  ): Promise<string> {
    logger.info(`[SessionHistory] Building history for user=${userId} coach=${coachId}`);

    const pastSessions = await VoiceSession.find({
      userId: new Types.ObjectId(userId),
      coachId: new Types.ObjectId(coachId),
      status: 'ended',
      type: { $ne: 'onboarding' },
    })
      .sort({ endedAt: -1 })
      .limit(5)
      .lean();

    if (pastSessions.length === 0) {
      logger.info('[SessionHistory] No past sessions found');
      return '';
    }

    logger.info(`[SessionHistory] Found ${pastSessions.length} past sessions`);

    let history = '# Past Session History\n';

    for (const session of pastSessions) {
      const dateStr = session.endedAt
        ? new Date(session.endedAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })
        : 'Unknown date';
      const durationMin = Math.round((session.durationMs || 0) / 60000);
      history += `\n## Session from ${dateStr} (${durationMin} min)\n`;

      if (session.summary) {
        history += `${session.summary}\n`;
      } else {
        // Fallback: grab first 3 user utterances from transcript
        const transcript = await Transcript.findOne({ sessionId: session._id });
        if (transcript) {
          const userUtterances = transcript.utterances
            .filter((u) => u.speakerId === 'user')
            .slice(0, 3)
            .map((u) => `- "${u.content}"`)
            .join('\n');
          if (userUtterances) {
            history += `User discussed:\n${userUtterances}\n`;
          }
        }
      }
    }

    // Cap at ~1500 chars to stay within token budget
    if (history.length > 1500) {
      history = history.substring(0, 1500) + '\n[...earlier sessions truncated]';
    }

    logger.info(`[SessionHistory] Built history context (${history.length} chars)`);

    return history;
  }

  /**
   * Get ephemeral token from OpenAI Realtime API
   */
  private async getOpenAIEphemeralToken(
    instructions: string,
    voice: string,
    languageCode: string = 'en'
  ): Promise<OpenAISessionResponse> {
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const buildBody = (v: string) => JSON.stringify({
      model: 'gpt-4o-realtime-preview',
      voice: v,
      instructions,
      input_audio_format: 'pcm16',
      output_audio_format: 'pcm16',
      input_audio_transcription: { model: 'whisper-1', language: languageCode },
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
   * Sanitize session for API response
   */
  private sanitizeSession(session: IVoiceSession, coach?: ICoach) {
    return {
      id: session._id.toString(),
      userId: session.userId.toString(),
      coachId: session.coachId.toString(),
      status: session.status,
      startedAt: session.startedAt.toISOString(),
      endedAt: session.endedAt?.toISOString(),
      durationMs: session.durationMs,
      title: session.title,
      summary: session.summary,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
      ...(coach && {
        coach: {
          id: coach._id.toString(),
          name: coach.name,
          avatar: coach.avatar,
          specialty: coach.specialty,
          category: coach.category,
        },
      }),
    };
  }

  /**
   * Start a new voice session
   */
  async startSession(userId: string, data: StartSessionData) {
    const { coachId } = data;
    logger.info(`[StartSession] user=${userId} coach=${coachId}`);

    if (!Types.ObjectId.isValid(coachId)) {
      logger.warn(`[StartSession] Invalid coach ID: ${coachId}`);
      throw new Error('INVALID_COACH_ID');
    }

    // Get coach with system prompt
    const coach = await Coach.findById(coachId);
    if (!coach) {
      logger.warn(`[StartSession] Coach not found: ${coachId}`);
      throw new Error('COACH_NOT_FOUND');
    }

    logger.info(`[StartSession] Coach: ${coach.name} (tone=${coach.tone}, lang=${coach.language})`);

    // Check if coach is accessible (system coaches are always accessible)
    if (coach.createdBy !== 'system' && !coach.isPublished) {
      // For user-created coaches, check if user has access
      const isOwner = coach.createdBy.toString() === userId;
      if (!isOwner) {
        throw new Error('COACH_NOT_FOUND');
      }
    }

    // Get user for context
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }

    // Check free tier session limit
    // Skip for system coaches (interviewer) and onboarding sessions (user must complete trial)
    const isOnboardingSession = data.type === 'onboarding';
    if (coach.createdBy !== 'system' && !isOnboardingSession) {
      const canStart = await subscriptionService.canStartSession(userId);
      if (!canStart) {
        throw new Error('SESSION_LIMIT_EXCEEDED');
      }
    }

    // Check for existing active session and mark as abandoned
    await VoiceSession.updateMany(
      { userId: new Types.ObjectId(userId), status: 'active' },
      { status: 'abandoned', endedAt: new Date() }
    );

    // Build session history for multi-session awareness
    const sessionHistory = await this.buildSessionHistoryContext(userId, coachId);

    // Build instructions with history context
    const instructions = this.buildInstructions(coach, user, sessionHistory);
    const voice = await this.resolveVoice(coach);
    const langCode = languageToCode(user.language);

    // Get ephemeral token from OpenAI
    const openaiSession = await this.getOpenAIEphemeralToken(instructions, voice, langCode);

    // Build speakers array with real names
    const speakers: ITranscriptSpeaker[] = [
      { id: 'user', name: user.firstName || 'User', role: 'user' },
      { id: 'coach', name: coach.name, role: 'coach' },
    ];

    // Create session record
    const session = await VoiceSession.create({
      userId: new Types.ObjectId(userId),
      coachId: new Types.ObjectId(coachId),
      type: data.type || 'regular',
      status: 'active',
      openaiSessionId: openaiSession.id,
      startedAt: new Date(),
    });

    // Create transcript document for this session
    const transcript = await Transcript.create({
      sessionId: session._id,
      userId: new Types.ObjectId(userId),
      coachId: new Types.ObjectId(coachId),
      speakers,
      utterances: [],
      metadata: { totalUtterances: 0, language: languageToCode(user.language) },
    });

    // Link transcript to session
    session.transcriptId = transcript._id;
    await session.save();

    // Increment coach session count
    await Coach.findByIdAndUpdate(coachId, {
      $inc: { sessionsCount: 1 },
      lastUsedAt: new Date(),
    });

    logger.info(`Voice session started: ${session._id} by user ${userId} with coach ${coachId}`);

    return {
      sessionId: session._id.toString(),
      token: openaiSession.client_secret.value,
      tokenExpiresAt: openaiSession.client_secret.expires_at,
      wsUrl: 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview',
      coach: {
        id: coach._id.toString(),
        name: coach.name,
        avatar: coach.avatar,
      },
      speakers,
    };
  }

  /**
   * Proxy SDP exchange with OpenAI
   * The mobile client can't reliably fetch api.openai.com directly on iOS,
   * so we proxy the SDP offer/answer exchange through the backend.
   */
  async sdpExchange(sdpOffer: string, ephemeralToken: string): Promise<string> {
    const response = await fetch(
      'https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ephemeralToken}`,
          'Content-Type': 'application/sdp',
        },
        body: sdpOffer,
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('OpenAI SDP exchange error:', errorText);
      throw new Error('SDP_EXCHANGE_FAILED');
    }

    return response.text();
  }

  /**
   * Resume an existing session (get new token)
   */
  async resumeSession(sessionId: string, userId: string) {
    if (!Types.ObjectId.isValid(sessionId)) {
      throw new Error('INVALID_SESSION_ID');
    }

    const session = await VoiceSession.findOne({
      _id: new Types.ObjectId(sessionId),
      userId: new Types.ObjectId(userId),
      status: { $in: ['active', 'paused'] },
    });

    if (!session) {
      throw new Error('SESSION_NOT_FOUND');
    }

    // Get coach for instructions
    const coach = await Coach.findById(session.coachId);
    if (!coach) {
      throw new Error('COACH_NOT_FOUND');
    }

    // Get user for context
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }

    // Build session history for multi-session awareness
    const sessionHistory = await this.buildSessionHistoryContext(
      userId,
      session.coachId.toString()
    );

    // Build instructions with history context and get new token
    const instructions = this.buildInstructions(coach, user, sessionHistory);
    const voice = await this.resolveVoice(coach);
    const langCode = languageToCode(user.language);
    const openaiSession = await this.getOpenAIEphemeralToken(instructions, voice, langCode);

    // Update session status
    session.status = 'active';
    session.openaiSessionId = openaiSession.id;
    await session.save();

    logger.info(`Voice session resumed: ${sessionId} by user ${userId}`);

    return {
      sessionId: session._id.toString(),
      token: openaiSession.client_secret.value,
      tokenExpiresAt: openaiSession.client_secret.expires_at,
      wsUrl: 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview',
    };
  }

  /**
   * Save/append transcript utterances (with deduplication)
   */
  async saveTranscript(sessionId: string, userId: string, data: SaveTranscriptData) {
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

    const { speakers, utterances } = data;
    if (!utterances || utterances.length === 0) {
      return { saved: 0, duplicates: 0 };
    }

    // Find or create transcript document
    let transcript = await Transcript.findOne({ sessionId: session._id });
    if (!transcript) {
      transcript = await Transcript.create({
        sessionId: session._id,
        userId: session.userId,
        coachId: session.coachId,
        speakers: speakers || [],
        utterances: [],
        metadata: { totalUtterances: 0, language: 'en' },
      });
      session.transcriptId = transcript._id;
      await session.save();
    }

    // Deduplicate: collect existing entryIds
    const existingEntryIds = new Set(transcript.utterances.map((u) => u.entryId));

    const newUtterances = utterances
      .filter((u) => !existingEntryIds.has(u.entryId))
      .map((u) => ({
        entryId: u.entryId,
        speakerId: u.speakerId,
        content: u.content,
        startOffsetMs: u.startOffsetMs,
        endOffsetMs: u.endOffsetMs,
        timestamp: new Date(u.timestamp),
        ...(u.confidence !== undefined && { confidence: u.confidence }),
      }));

    const duplicates = utterances.length - newUtterances.length;

    if (newUtterances.length === 0) {
      return { saved: 0, duplicates };
    }

    // Merge speakers (upsert by id)
    const existingSpeakerIds = new Set(transcript.speakers.map((s) => s.id));
    const newSpeakers = (speakers || []).filter((s) => !existingSpeakerIds.has(s.id));

    // Atomically push new utterances and update metadata
    const updateOps: Record<string, unknown> = {
      $push: {
        utterances: { $each: newUtterances },
        ...(newSpeakers.length > 0 && {
          speakers: { $each: newSpeakers },
        }),
      },
      $set: {
        'metadata.lastSyncedAt': new Date(),
        'metadata.totalUtterances': transcript.metadata.totalUtterances + newUtterances.length,
      },
    };

    await Transcript.updateOne({ _id: transcript._id }, updateOps);

    logger.info(
      `Transcript saved for session ${sessionId}: ${newUtterances.length} new, ${duplicates} duplicates`
    );

    return { saved: newUtterances.length, duplicates };
  }

  /**
   * End a voice session
   */
  async endSession(sessionId: string, userId: string, data: EndSessionData) {
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

    // Save any final utterances
    if (data.finalUtterances && data.finalUtterances.length > 0) {
      await this.saveTranscript(sessionId, userId, {
        speakers: data.speakers || [],
        utterances: data.finalUtterances,
      });
    }

    // Update session
    session.status = 'ended';
    session.endedAt = new Date();
    session.durationMs = data.durationMs;
    await session.save();

    // Generate title from coach name + first user utterance
    if (!session.title) {
      const coach = await Coach.findById(session.coachId);
      const coachName = coach?.name || 'Coach';
      const transcript = await Transcript.findOne({ sessionId: session._id });
      if (transcript) {
        const firstUserUtterance = transcript.utterances.find((u) => u.speakerId === 'user');
        if (firstUserUtterance) {
          const topic = firstUserUtterance.content.substring(0, 40) +
            (firstUserUtterance.content.length > 40 ? '...' : '');
          session.title = `${coachName}: ${topic}`;
        } else {
          session.title = `Session with ${coachName}`;
        }
      } else {
        session.title = `Session with ${coachName}`;
      }
      await session.save();
    }

    // Mark user as onboarded when trial session ends
    if (session.type === 'onboarding') {
      await User.findByIdAndUpdate(userId, { isOnboarded: true });
      logger.info(`User ${userId} marked as onboarded after trial session`);
    }

    logger.info(
      `Voice session ended: ${sessionId} by user ${userId}, duration: ${data.durationMs}ms`
    );

    const coach = await Coach.findById(session.coachId);
    return this.sanitizeSession(session, coach || undefined);
  }

  /**
   * Pause a voice session
   */
  async pauseSession(sessionId: string, userId: string) {
    if (!Types.ObjectId.isValid(sessionId)) {
      throw new Error('INVALID_SESSION_ID');
    }

    const session = await VoiceSession.findOne({
      _id: new Types.ObjectId(sessionId),
      userId: new Types.ObjectId(userId),
      status: 'active',
    });

    if (!session) {
      throw new Error('SESSION_NOT_FOUND');
    }

    session.status = 'paused';
    await session.save();

    logger.info(`Voice session paused: ${sessionId} by user ${userId}`);

    return { message: 'Session paused' };
  }

  /**
   * Get session by ID with transcript
   */
  async getSession(sessionId: string, userId: string) {
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

    const [coach, transcript] = await Promise.all([
      Coach.findById(session.coachId),
      Transcript.findOne({ sessionId: session._id }),
    ]);

    return {
      ...this.sanitizeSession(session, coach || undefined),
      transcript: transcript
        ? {
            speakers: transcript.speakers,
            utterances: transcript.utterances.map((u) => ({
              entryId: u.entryId,
              speakerId: u.speakerId,
              content: u.content,
              startOffsetMs: u.startOffsetMs,
              endOffsetMs: u.endOffsetMs,
              timestamp: u.timestamp.toISOString(),
              ...(u.confidence !== undefined && { confidence: u.confidence }),
            })),
            metadata: {
              totalUtterances: transcript.metadata.totalUtterances,
              language: transcript.metadata.language,
              lastSyncedAt: transcript.metadata.lastSyncedAt?.toISOString(),
            },
          }
        : null,
    };
  }

  /**
   * Get user's session history
   */
  async getSessionHistory(
    userId: string,
    filters: SessionFilters
  ): Promise<PaginatedResponse<ReturnType<typeof this.sanitizeSession>>> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new Error('INVALID_USER_ID');
    }

    const { coachId, status, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {
      userId: new Types.ObjectId(userId),
    };

    if (coachId && Types.ObjectId.isValid(coachId)) {
      query.coachId = new Types.ObjectId(coachId);
    }

    if (status) {
      query.status = status;
    } else {
      // Default to showing ended sessions in history
      query.status = { $in: ['ended', 'abandoned'] };
    }

    const [sessions, total] = await Promise.all([
      VoiceSession.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      VoiceSession.countDocuments(query),
    ]);

    // Get coaches for all sessions
    const coachIds = [...new Set(sessions.map((s) => s.coachId.toString()))];
    const coaches = await Coach.find({ _id: { $in: coachIds } });
    const coachMap = new Map(coaches.map((c) => [c._id.toString(), c]));

    return {
      data: sessions.map((session) => {
        const coach = coachMap.get(session.coachId.toString());
        return this.sanitizeSession(session, coach);
      }),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get active session for user (if any)
   */
  async getActiveSession(userId: string) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new Error('INVALID_USER_ID');
    }

    const session = await VoiceSession.findOne({
      userId: new Types.ObjectId(userId),
      status: { $in: ['active', 'paused'] },
    }).sort({ createdAt: -1 });

    if (!session) {
      return null;
    }

    const coach = await Coach.findById(session.coachId);
    return this.sanitizeSession(session, coach || undefined);
  }

  /**
   * Update user personal context
   */
  async updateUserContext(userId: string, personalContext: string) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new Error('INVALID_USER_ID');
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }

    user.personalContext = personalContext;
    await user.save();

    logger.info(`User personal context updated: ${userId}`);

    return { personalContext: user.personalContext };
  }

  /**
   * Update user language preference
   */
  async updateUserLanguage(userId: string, language: string) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new Error('INVALID_USER_ID');
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }

    user.language = language;
    await user.save();

    logger.info(`User language updated: ${userId} → ${language}`);

    return { language: user.language };
  }

  /**
   * Get user personal context
   */
  async getUserContext(userId: string) {
    if (!Types.ObjectId.isValid(userId)) {
      throw new Error('INVALID_USER_ID');
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }

    return { personalContext: user.personalContext || '' };
  }

  /**
   * Extract personal context and coach preferences from an interview session transcript.
   * Calls GPT-4o-mini to analyze the conversation and produce structured output.
   */
  async extractContextFromSession(sessionId: string, userId: string) {
    logger.info(`[ExtractContext] Starting for session=${sessionId} user=${userId}`);

    if (!Types.ObjectId.isValid(sessionId)) {
      logger.warn(`[ExtractContext] Invalid session ID: ${sessionId}`);
      throw new Error('INVALID_SESSION_ID');
    }

    const session = await VoiceSession.findOne({
      _id: new Types.ObjectId(sessionId),
      userId: new Types.ObjectId(userId),
    });

    if (!session) {
      logger.warn(`[ExtractContext] Session not found: ${sessionId}`);
      throw new Error('SESSION_NOT_FOUND');
    }

    // Fetch transcript
    const transcript = await Transcript.findOne({ sessionId: session._id });
    if (!transcript || transcript.utterances.length === 0) {
      logger.warn(`[ExtractContext] No transcript data for session=${sessionId}, utterances=${transcript?.utterances.length ?? 0}`);
      throw new Error('TRANSCRIPT_EMPTY');
    }

    logger.info(`[ExtractContext] Found ${transcript.utterances.length} utterances, extracting context...`);

    // Format transcript as dialogue
    const speakerNameMap = new Map(transcript.speakers.map((s) => [s.id, s.name]));
    const formattedTranscript = transcript.utterances
      .map((u) => {
        const name = speakerNameMap.get(u.speakerId) || u.speakerId;
        return `[${name}]: ${u.content}`;
      })
      .join('\n');

    // Call GPT-4o-mini for context extraction
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const model = process.env.OPENAI_EVALUATION_MODEL || 'gpt-4o-mini';
    const userPrompt = buildContextExtractionPrompt(formattedTranscript);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: CONTEXT_EXTRACTION_SYSTEM_MESSAGE },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.5,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('OpenAI context extraction error:', errorText);
      throw new Error('OPENAI_API_ERROR');
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string | null } }[];
    };
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      logger.error('OpenAI returned empty content for context extraction');
      throw new Error('OPENAI_API_ERROR');
    }

    let parsed: {
      personalContext: string;
      coachPreferences: {
        preferredTone: string;
        focusAreas: string[];
        coachingStyles: string[];
        experienceLevel: string;
        suggestedCategories: string[];
      };
    };

    try {
      parsed = JSON.parse(content);
    } catch {
      logger.error('Failed to parse context extraction response:', content.substring(0, 200));
      throw new Error('OPENAI_API_ERROR');
    }

    if (!parsed.personalContext || !parsed.coachPreferences) {
      logger.error('[ExtractContext] Invalid response structure — missing personalContext or coachPreferences');
      throw new Error('OPENAI_API_ERROR');
    }

    logger.info(`[ExtractContext] Extracted context (${parsed.personalContext.length} chars), preferences: tone=${parsed.coachPreferences.preferredTone}, areas=${parsed.coachPreferences.focusAreas.join(',')}`);

    // Save personal context to user
    const user = await User.findById(userId);
    if (user) {
      user.personalContext = parsed.personalContext;
      await user.save();
      logger.info(`[ExtractContext] Saved personalContext to user=${userId}`);
    }

    return {
      personalContext: parsed.personalContext,
      coachPreferences: parsed.coachPreferences,
    };
  }
}

export const sessionService = new SessionService();
