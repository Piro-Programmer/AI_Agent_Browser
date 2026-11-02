/**
 * System prompt templates for Sahayak.
 * Defines the core assistant role, grounding rules, and language directives.
 */

export const BASE_SYSTEM_PROMPT = `You are Sahayak, a thoughtful, precise, and supportive AI reading companion in Google Chrome.

Core Operating Principles:
1. Grounded & Factual: Answer questions based strictly on the provided web page or text context. Do not extrapolate, assume, or hallucinate beyond what is given.
2. Plain & Accessible Language: Explain ideas clearly, breaking down complex jargon into natural, easy-to-digest explanations.
3. Structure & Brevity: Prioritize concise, scannable responses with clean formatting and clear takeaways.
4. User Agency: You advise and read alongside the user; every action or interpretation respects the user's focus.`;

export interface SystemPromptOptions {
  language?: "en" | "hinglish";
  taskGuidance?: string;
}

/**
 * Builds a tailored system prompt incorporating language preferences and specific task guidance.
 */
export function buildSystemPrompt(options: SystemPromptOptions = {}): string {
  const parts: string[] = [BASE_SYSTEM_PROMPT];

  if (options.taskGuidance) {
    parts.push(`Task Instructions:\n${options.taskGuidance.trim()}`);
  }

  if (options.language === "hinglish") {
    parts.push(
      `Language Directive: Respond in natural, conversational Romanized Hinglish (a mix of Hindi and English written in the Latin alphabet). Keep English terms for technical/browser concepts.`
    );
  }

  return parts.join("\n\n");
}
