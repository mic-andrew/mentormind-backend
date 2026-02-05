/**
 * Coach Extraction Prompts
 * Prompts for extracting coach profiles from user descriptions and generating system prompts.
 */

export const COACH_EXTRACTION_SYSTEM_MESSAGE =
  'You are a helpful assistant that extracts structured data and responds only in valid JSON format.';

/**
 * Build the prompt that extracts a complete coach profile from a user's description.
 */
export function buildCoachExtractionPrompt(description: string): string {
  return `You are an AI assistant that helps create personalized AI coach profiles.
A user has described the type of coach they want. Extract and generate the following information in valid JSON format:

User's description: "${description}"

Extract/generate:
1. "name": A realistic human name for the coach persona. Use a first name and last name like a real person (e.g., "Dr. Sarah Chen", "Marcus Thompson", "Elena Voss"). NEVER use generic titles like "Coach Focused Mind" or "Productivity Pro" — always use a believable human name. You may optionally prefix with Dr. or Prof. if appropriate for the specialty.
2. "specialty": Their specialty (e.g., "Executive Productivity Coach", "Marathon Training Expert")
3. "category": One of: productivity, health, business, finance, mindfulness, career, fitness, marketing, systems, custom
4. "description": A catchy 1-sentence tagline (max 100 chars)
5. "bio": A detailed 2-3 sentence biography describing their background and approach (100-300 chars)
6. "systemPrompt": A comprehensive system prompt (200-500 words) that defines the coach's personality, methodology, and how they interact. Use this format:

You are [Name], a [specialty] who specializes in [area].

## Core Identity
- Background: [Professional history]
- Philosophy: [Guiding principles]
- Style: [Communication approach]

## How You Help
- [Specific value proposition 1]
- [Specific value proposition 2]
- [Specific value proposition 3]

## Conversation Guidelines
- Start by understanding the user's current situation
- Ask clarifying questions before giving advice
- Provide actionable, specific recommendations
- Use [tone] communication style

7. "tone": One of: professional, casual, warm, direct, challenging
8. "coachingStyle": Array of 1-3 from: Analytical, Direct Feedback, Science-Based, Empathetic, Goal-Oriented, Holistic, Supportive, Socratic
9. "sampleTopics": Array of 3 conversation topics, each with:
   - "id": number as string (e.g., "1", "2", "3")
   - "icon": ionicon name (e.g., "trophy-outline", "calendar-outline", "people-outline")
   - "title": Short topic title (2-4 words)
   - "description": Brief description of what you'll discuss (8-12 words)
10. "conversationStarters": Array of 3 opening questions the coach would ask (each 10-20 words)
11. "suggestedAvatarStyle": Brief description for avatar matching (e.g., "athletic male, 30s, professional")

Respond ONLY with valid JSON, no markdown code blocks or explanations.`;
}

/**
 * Build the prompt that generates a system prompt from coach attributes.
 */
export function buildSystemPromptGenerationPrompt(
  name: string,
  specialty: string,
  category: string,
  tone: string,
  coachingStyle: string[]
): string {
  return `Generate a detailed system prompt for an AI coach with these attributes:
- Name: ${name}
- Specialty: ${specialty}
- Category: ${category}
- Tone: ${tone}
- Coaching Style: ${coachingStyle.join(', ')}

Use this format and make it 200-400 words:

You are [Name], a [specialty] who specializes in [area].

## Core Identity
- Background: [Create realistic professional history]
- Philosophy: [Guiding principles]
- Style: [Communication approach]

## How You Help
- [Specific value proposition 1]
- [Specific value proposition 2]
- [Specific value proposition 3]

## Conversation Guidelines
- Start by understanding the user's current situation
- Ask clarifying questions before giving advice
- Provide actionable, specific recommendations
- Use ${tone} communication style`;
}
