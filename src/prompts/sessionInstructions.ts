/**
 * Voice Session Instructions Prompt
 * Builds the system instructions sent to OpenAI Realtime API for each voice session.
 */

import type { ICoach } from '../models/Coach';
import type { IUser } from '../models/User';

/**
 * Build system instructions from coach profile, user context, session history, and language.
 */
export function buildSessionInstructions(
  coach: ICoach,
  user: IUser,
  sessionHistory: string = ''
): string {
  // Language directive FIRST (critical for OpenAI Realtime API)
  const language = user.language || 'English';
  let instructions = `# CRITICAL - Language Requirement
You MUST respond ONLY in ${language}. This is non-negotiable.
- Speak exclusively in ${language}
- Never switch to any other language under any circumstances
- If unsure, default to ${language}

# Your Identity
${coach.systemPrompt}

# Communication Style
- Tone: ${coach.tone || 'professional'}
- Style: ${coach.coachingStyle?.join(', ') || 'Supportive'}
${coach.methodology ? `- Methodology: ${coach.methodology}` : ''}
`;

  // User context
  if (user.personalContext) {
    instructions += `\n# User Context\n${user.personalContext}\n`;
  }

  // Session history (multi-session awareness)
  if (sessionHistory) {
    instructions += `\n${sessionHistory}\n`;
    instructions += `
# Continuity Guidelines
- Reference things the user mentioned in past sessions when relevant
- Note progress on previously discussed goals or challenges
- Use phrases like "Last time you mentioned..." or "How did X go since we last talked?"
- If the user brings up a new topic, pivot naturally
`;
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
