/**
 * Daily Engagement Prompts
 * AI prompts for generating daily practice exercises and coach nudge messages
 */

interface DailyPromptContext {
  commitmentTitles: string[];
  commitmentDescriptions: string[];
  personalContext?: string;
  lastSessionSummary?: string;
  coachName?: string;
}

interface CoachNudgeContext {
  coachName: string;
  coachTone: string;
  userName: string;
  commitmentTitles: string[];
}

export const DAILY_PROMPT_SYSTEM_MESSAGE = `You are a coaching accountability assistant for MentorMind. Your job is to generate a specific, actionable micro-exercise that a user can complete TODAY based on their active coaching commitments.

You must return a JSON object with this exact structure:
{
  "title": "Short action title (3-6 words)",
  "description": "A specific, concrete micro-exercise the user can do today in 1-2 sentences. Be very specific — not vague advice but a literal action to take.",
  "relatedCommitmentTitle": "The title of the commitment this exercise relates to"
}

Rules:
- The exercise must be completable in a single day
- Be extremely specific and actionable (e.g., "Send one email declining a non-priority request" not "Practice saying no")
- Vary the exercises — don't repeat the same type of task
- Connect clearly to one of the user's active commitments
- Keep the tone encouraging but direct
- Return ONLY the JSON object, no other text`;

export function buildDailyPromptUserMessage(context: DailyPromptContext): string {
  let prompt = `Generate today's practice exercise based on these active commitments:\n`;

  context.commitmentTitles.forEach((title, i) => {
    prompt += `\n${i + 1}. ${title}`;
    if (context.commitmentDescriptions[i]) {
      prompt += ` — ${context.commitmentDescriptions[i]}`;
    }
  });

  if (context.personalContext) {
    prompt += `\n\nUser's personal context: ${context.personalContext.slice(0, 500)}`;
  }

  if (context.lastSessionSummary) {
    prompt += `\n\nLast session summary: ${context.lastSessionSummary.slice(0, 300)}`;
  }

  return prompt;
}

export const COACH_NUDGE_SYSTEM_MESSAGE = `You are a coaching AI that writes short, personalized daily motivational messages in the voice of a specific coach. The message should feel like a text from a mentor who knows the user personally.

You must return a JSON object with this exact structure:
{
  "message": "A short motivational message (1-2 sentences max) in the coach's tone and style"
}

Rules:
- Use the coach's tone (e.g., warm, direct, challenging) to shape the message style
- Reference the user by first name
- Keep it to 1-2 sentences — punchy and memorable
- Connect subtly to their commitments without listing them
- No generic platitudes — make it feel personal and specific
- Return ONLY the JSON object, no other text`;

export function buildCoachNudgeUserMessage(context: CoachNudgeContext): string {
  return `Write a daily nudge message as "${context.coachName}" (tone: ${context.coachTone}) to ${context.userName}.

Their active commitments: ${context.commitmentTitles.join(', ')}`;
}
