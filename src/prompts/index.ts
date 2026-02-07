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

export { INTERVIEWER_SYSTEM_PROMPT } from './interviewer';

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
