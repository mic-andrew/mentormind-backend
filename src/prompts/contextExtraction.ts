/**
 * Context Extraction Prompts
 * Prompts for extracting personal context and coach preferences from an onboarding interview transcript.
 */

export const CONTEXT_EXTRACTION_SYSTEM_MESSAGE =
  'You are a helpful assistant that analyzes conversations and extracts structured data. Respond only in valid JSON format.';

/**
 * Build the prompt that extracts personal context and coach preferences from an interview transcript.
 */
export function buildContextExtractionPrompt(transcript: string): string {
  return `Analyze this onboarding interview transcript and extract two things:

1. A natural-language personal context paragraph (200-500 chars) summarizing the user's professional background, goals, challenges, and coaching preferences. Write it as a brief profile, not a conversation summary.

2. Coach matching preferences based on what the user expressed.

Transcript:
${transcript}

Return a JSON object with this exact structure:
{
  "personalContext": "string (200-500 chars, natural language profile of the user)",
  "coachPreferences": {
    "preferredTone": "warm" | "direct" | "professional" | "challenging" | "casual",
    "focusAreas": ["productivity", "leadership", "communication", "mindset", "career", "health", "business", "creativity"],
    "coachingStyles": ["Analytical", "Direct Feedback", "Science-Based", "Empathetic", "Goal-Oriented", "Holistic", "Supportive", "Socratic"],
    "experienceLevel": "beginner" | "intermediate" | "advanced",
    "suggestedCategories": ["productivity", "health", "business", "finance", "mindfulness", "career", "fitness", "marketing", "systems", "custom"]
  }
}

Guidelines:
- personalContext should read like a user profile, e.g., "Senior product manager at a tech startup, passionate about building great teams. Currently struggling with delegation and time management. Wants practical accountability and strategic guidance."
- focusAreas: pick 2-4 most relevant areas from the conversation
- coachingStyles: pick 1-3 styles that match what the user expressed
- suggestedCategories: pick 1-3 coach categories that would best serve this user
- If the user didn't explicitly state a preference, infer it from their tone and needs`;
}
