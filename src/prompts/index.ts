/**
 * Prompts — Barrel exports
 * All AI/LLM prompts are centralized here for maintainability.
 */

export { buildSessionInstructions } from './sessionInstructions';

export { EVALUATION_SYSTEM_PROMPT, buildEvaluationUserPrompt } from './evaluation';

export {
  COACH_EXTRACTION_SYSTEM_MESSAGE,
  buildCoachExtractionPrompt,
  buildSystemPromptGenerationPrompt,
} from './coachExtraction';

export { AVATAR_MATCHING_SYSTEM_MESSAGE, buildAvatarMatchingPrompt } from './avatarMatching';

export { buildInterviewerPrompt } from './interviewer';

export {
  CONTEXT_EXTRACTION_SYSTEM_MESSAGE,
  buildContextExtractionPrompt,
} from './contextExtraction';

export {
  COACH_SUGGESTION_SYSTEM_MESSAGE,
  buildCoachSuggestionPrompt,
} from './coachSuggestion';

export {
  SINGLE_COACH_SYSTEM_MESSAGE,
  buildSingleCoachPrompt,
} from './coachCreation';

export {
  DAILY_PROMPT_SYSTEM_MESSAGE,
  buildDailyPromptUserMessage,
  COACH_NUDGE_SYSTEM_MESSAGE,
  buildCoachNudgeUserMessage,
} from './dailyEngagement';

export {
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
} from './moduleSteps';
