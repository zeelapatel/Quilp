import { callLLM } from "../client.js";
import { MODELS, TOKEN_BUDGETS, VOICE_SCORE_THRESHOLD } from "../constants.js";
import { recordLlmUsage } from "../cost-cap.js";
import type { VoicePatterns, VoiceScore } from "./types.js";

const SCORING_SYSTEM_PROMPT = `
You are a writing style analyst.
Score how closely a generated post matches the reference writing voice.

Return ONLY valid JSON:
{
  "score": number,
  "deviations": ["..."],
  "suggestions": ["..."]
}
`;

function buildScoringPrompt(generatedPost: string, patterns: VoicePatterns, samplePosts: string[]): string {
  const samples = samplePosts
    .slice(-3)
    .map((post, index) => `--- REAL POST ${index + 1} ---\n${post}`)
    .join("\n\n");

  return `
VOICE PROFILE:
Writing persona: ${patterns.writingPersona}
Avg sentence length: ${patterns.avgSentenceLength}
Emoji usage: ${patterns.emojiUsage}
Opening patterns: ${patterns.openingPatterns.join(", ")}
Closing patterns: ${patterns.closingPatterns.join(", ")}
Vocabulary patterns: ${patterns.vocabularyPatterns.join(", ")}
Avoided phrases: ${patterns.avoidedPhrases.join(", ")}
Uses bullet points: ${patterns.usesBulletPoints}
Uses numbered lists: ${patterns.usesNumberedLists}

REAL WRITING SAMPLES:
${samples}

GENERATED POST:
${generatedPost}
`;
}

export async function scoreVoice(
  generatedPost: string,
  patterns: VoicePatterns,
  samplePosts: string[],
  userId: string
): Promise<VoiceScore> {
  if (samplePosts.length === 0) {
    return {
      score: 75,
      deviations: [],
      suggestions: ["Add sample posts to improve voice scoring accuracy"],
      passesThreshold: true,
    };
  }

  const result = await callLLM({
    model: MODELS.scorer,
    system: SCORING_SYSTEM_PROMPT,
    user: buildScoringPrompt(generatedPost, patterns, samplePosts),
    maxTokens: TOKEN_BUDGETS.voiceScoring.maxOutput,
  });

  await recordLlmUsage(userId, MODELS.scorer, result.inputTokens, result.outputTokens);

  try {
    const cleaned = result.content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned) as {
      score?: number;
      deviations?: string[];
      suggestions?: string[];
    };
    const score = Math.max(0, Math.min(100, typeof parsed.score === "number" ? parsed.score : 75));
    return {
      score,
      deviations: Array.isArray(parsed.deviations) ? parsed.deviations.filter(item => typeof item === "string") : [],
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.filter(item => typeof item === "string") : [],
      passesThreshold: score >= VOICE_SCORE_THRESHOLD,
    };
  } catch {
    return {
      score: 75,
      deviations: [],
      suggestions: [],
      passesThreshold: true,
    };
  }
}
