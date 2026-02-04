/**
 * Session Service
 * Handles voice coaching session business logic including OpenAI Realtime API integration
 */

import { Types } from 'mongoose';
import { VoiceSession, IVoiceSession, SessionStatus } from '../models/VoiceSession';
import { Transcript, ITranscriptSpeaker } from '../models/Transcript';
import { Coach, ICoach } from '../models/Coach';
import { User, IUser } from '../models/User';
import { logger } from '../config/logger';
import { subscriptionService } from './subscriptionService';

// Voice mapping based on coach tone
const TONE_TO_VOICE: Record<string, string> = {
  professional: 'alloy',
  warm: 'shimmer',
  direct: 'echo',
  casual: 'fable',
  challenging: 'onyx',
};

interface StartSessionData {
  coachId: string;
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
  private buildInstructions(coach: ICoach, user: IUser): string {
    let instructions = `# Your Identity
${coach.systemPrompt}

# Communication Style
- Tone: ${coach.tone || 'professional'}
- Style: ${coach.coachingStyle?.join(', ') || 'Supportive'}
${coach.methodology ? `- Methodology: ${coach.methodology}` : ''}
`;

    if (user.personalContext) {
      instructions += `\n# User Context\n${user.personalContext}\n`;
    }

    instructions += `
# Voice Guidelines
- Keep responses to 2-3 sentences for natural conversation flow
- Ask clarifying questions to understand the user's situation
- End responses with a question to maintain dialogue when appropriate
- Reference user's goals when relevant
- Be encouraging but honest
`;

    return instructions.trim();
  }

  /**
   * Get ephemeral token from OpenAI Realtime API
   */
  private async getOpenAIEphemeralToken(
    instructions: string,
    voice: string
  ): Promise<OpenAISessionResponse> {
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-realtime-preview',
        voice: voice,
        instructions: instructions,
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        input_audio_transcription: {
          model: 'whisper-1',
        },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 500,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('OpenAI Realtime API error:', errorText);
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

    if (!Types.ObjectId.isValid(coachId)) {
      throw new Error('INVALID_COACH_ID');
    }

    // Get coach with system prompt
    const coach = await Coach.findById(coachId);
    if (!coach) {
      throw new Error('COACH_NOT_FOUND');
    }

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
    const canStart = await subscriptionService.canStartSession(userId);
    if (!canStart) {
      throw new Error('SESSION_LIMIT_EXCEEDED');
    }

    // Check for existing active session and mark as abandoned
    await VoiceSession.updateMany(
      { userId: new Types.ObjectId(userId), status: 'active' },
      { status: 'abandoned', endedAt: new Date() }
    );

    // Build instructions
    const instructions = this.buildInstructions(coach, user);
    const voice = TONE_TO_VOICE[coach.tone || 'professional'] || 'alloy';

    // Get ephemeral token from OpenAI
    const openaiSession = await this.getOpenAIEphemeralToken(instructions, voice);

    // Build speakers array with real names
    const speakers: ITranscriptSpeaker[] = [
      { id: 'user', name: user.firstName || 'User', role: 'user' },
      { id: 'coach', name: coach.name, role: 'coach' },
    ];

    // Create session record
    const session = await VoiceSession.create({
      userId: new Types.ObjectId(userId),
      coachId: new Types.ObjectId(coachId),
      status: 'active',
      openaiSessionId: openaiSession.id,
      startedAt: new Date(),
    });

    // Create transcript document for this session
    const transcript = await Transcript.create({
      sessionId: session._id,
      speakers,
      utterances: [],
      metadata: { totalUtterances: 0, language: 'en' },
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

    // Build instructions and get new token
    const instructions = this.buildInstructions(coach, user);
    const voice = TONE_TO_VOICE[coach.tone || 'professional'] || 'alloy';
    const openaiSession = await this.getOpenAIEphemeralToken(instructions, voice);

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
}

export const sessionService = new SessionService();
