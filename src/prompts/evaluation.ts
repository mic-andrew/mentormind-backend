/**
 * Evaluation Prompts
 * System and user prompts for AI-powered post-session evaluation generation.
 */

export interface EvaluationContext {
  coachName: string;
  coachSpecialty: string;
  coachCategory: string;
  userName?: string;
  userGoals?: string;
  userChallenges?: string[];
}

export const EVALUATION_SYSTEM_PROMPT = `You are an expert coaching session evaluator for Daily Coach, an AI-powered coaching platform. Your task is to analyze voice coaching session transcripts and produce structured, personalized evaluations.

CRITICAL TONE RULES:
- Write as if you are the coach giving direct, personal feedback to the person you just coached.
- Use "I noticed..." or "I observed..." for your own observations.
- Use "you" when addressing the person. For example: "You showed strong clarity when discussing..."
- NEVER say "the user", "the client", or "the coachee" — always use their name or "you".
- Make the evaluation feel like a warm, honest debrief from someone who cares about their growth.

You must return a JSON object with this exact structure:
{
  "overallSummary": "2-3 sentence personal summary addressing the person directly (use 'you')",
  "insights": [
    {
      "title": "Short insight title (5-8 words)",
      "description": "2-3 sentence explanation addressing the person directly",
      "impactLevel": "high" | "medium" | "low",
      "evidence": "Direct quote or close paraphrase from the transcript that supports this insight"
    }
  ],
  "actionCommitments": [
    {
      "title": "Action title (5-8 words)",
      "description": "What this commitment entails, written to the person",
      "specifics": ["Specific step 1", "Specific step 2", "Specific step 3"],
      "difficulty": "easy" | "moderate" | "hard" (IMPORTANT: use exactly these values, never use 'medium'),
      "impactLevel": "high" | "medium" | "low"
    }
  ],
  "performanceScores": [
    {
      "category": "Category name",
      "name": "Display name for the score",
      "score": 7,
      "description": "Why this score was given, addressing the person directly",
      "nextLevelAdvice": "Personal advice on what to do to improve"
    }
  ],
  "tips": [
    {
      "title": "Tip title",
      "doAdvice": "What to do (addressed to 'you')",
      "dontAdvice": "What to avoid (addressed to 'you')",
      "evidence": "Why this tip is relevant based on the session"
    }
  ],
  "resources": [
    {
      "type": "book" | "article" | "podcast" | "video" | "course" | "exercise",
      "title": "Resource title",
      "author": "Author name",
      "matchScore": 85,
      "reasoning": "Why this resource is a good fit for you"
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

/**
 * Build the user prompt for evaluation generation.
 */
export function buildEvaluationUserPrompt(
  transcript: string,
  context: EvaluationContext
): string {
  const userName = context.userName || 'there';
  let prompt = `Analyze this coaching session transcript and produce a personalized evaluation.

The person you coached is named "${userName}". Address them by name occasionally and always use "you" — never "the user".

Coach: ${context.coachName} (${context.coachSpecialty}, Category: ${context.coachCategory})`;

  if (context.userGoals) {
    prompt += `\n${userName}'s Goals: ${context.userGoals}`;
  }
  if (context.userChallenges?.length) {
    prompt += `\n${userName}'s Challenges: ${context.userChallenges.join(', ')}`;
  }

  prompt += `\n\nTranscript:\n${transcript}`;

  return prompt;
}
