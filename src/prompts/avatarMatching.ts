/**
 * Avatar Matching Prompts
 * Prompts for matching avatars to coach profiles using LLM analysis.
 */

export const AVATAR_MATCHING_SYSTEM_MESSAGE =
  'You select the best matching avatar for AI coaches. Respond only with valid JSON.';

interface AvatarListItem {
  index: number;
  name: string;
  description: string;
  category: string;
  gender: string;
  ageRange: string;
  style: string;
  vibe: string;
  tags: string;
}

interface CoachProfile {
  name: string;
  specialty: string;
  category: string;
  description: string;
  bio: string;
  tone: string;
  coachingStyle: string[];
  suggestedAvatarStyle?: string;
}

/**
 * Build the prompt for matching avatars to a coach profile.
 */
export function buildAvatarMatchingPrompt(
  coach: CoachProfile,
  avatarList: AvatarListItem[]
): string {
  return `You are an avatar matching assistant. Given a coach profile, select the 5 best matching avatars from the list below.

Coach Profile:
- Name: ${coach.name}
- Specialty: ${coach.specialty}
- Category: ${coach.category}
- Description: ${coach.description}
- Bio: ${coach.bio}
- Tone: ${coach.tone}
- Coaching Style: ${coach.coachingStyle.join(', ')}
${coach.suggestedAvatarStyle ? `- Suggested Avatar Style: ${coach.suggestedAvatarStyle}` : ''}

Available Avatars:
${avatarList.map((a) => `[${a.index}] ${a.name} - ${a.description} (Category: ${a.category}, Gender: ${a.gender}, Age: ${a.ageRange}, Style: ${a.style}, Vibe: ${a.vibe}, Tags: ${a.tags})`).join('\n')}

Return a JSON object with a "matches" array containing exactly 5 avatar indices (numbers) ranked from best to worst match. Consider the coach's category, tone, style, and overall personality when matching.

Example: {"matches": [3, 7, 12, 0, 45]}`;
}
