import type { Platform, PostFormat } from "@prisma/client";
import { buildCacheKey, getCachedGeneration, setCachedGeneration } from "../cache.js";
import { callLLM } from "../client.js";
import { MODELS, TOKEN_BUDGETS } from "../constants.js";
import { checkCostCap, recordLlmUsage } from "../cost-cap.js";
import { CostCapExceededError } from "../errors.js";
import type { ClassificationResult, ExtractedContent, GeneratedPost } from "../types.js";

const GENERATION_SYSTEM_PROMPT = `
You are a ghostwriter creating authentic LinkedIn content for professionals.

Rules:
- Return ONLY valid JSON (no markdown, no backticks).
- Use first person voice.
- Keep it concrete, concise, and structured with line breaks.
- Avoid generic buzzwords and overhyped language.
- Keep hooks distinct from each other.
`;

function buildGenerationPrompt(
  extracted: ExtractedContent,
  classification: ClassificationResult,
  format: PostFormat,
  platform: Platform
): string {
  const formatSpec =
    format === "long_form"
      ? "Length 1300-2000 chars, hook + context + 3-5 insights + CTA, include 3-5 hashtags."
      : "Length 300-600 chars, hook + 2-3 key points + CTA, include 2-3 hashtags.";

  return `
Create a ${format} post for ${platform}.

Source type: ${extracted.sourceType}
Title: ${extracted.title}
Category: ${classification.category}
Tone: ${classification.toneProfile}

Key points:
${extracted.keyPoints.map(point => `- ${point}`).join("\n")}

Action items:
${extracted.actionItems.map(item => `- ${item}`).join("\n")}

Excerpt:
${extracted.rawExcerpt}

Requirements:
${formatSpec}

Return exact JSON:
{
  "content": "full post text",
  "hooks": ["hook1", "hook2", "hook3"],
  "hashtags": ["hashtag1", "hashtag2", "hashtag3"]
}
`;
}

export async function generatePost(
  extracted: ExtractedContent,
  classification: ClassificationResult,
  format: PostFormat,
  platform: Platform,
  userId: string,
  userPlan: string,
  messageId: string
): Promise<GeneratedPost> {
  const capResult = await checkCostCap(userId, userPlan);
  if (!capResult.allowed) {
    throw new CostCapExceededError(capResult.reason ?? "Cost cap exceeded");
  }

  const cacheKey = buildCacheKey(messageId, format, platform);
  const cached = await getCachedGeneration(cacheKey);
  if (cached) {
    console.log(`Cache hit for ${messageId}:${format}:${platform}`);
    const parsedCached = JSON.parse(cached) as Omit<GeneratedPost, "metadata"> & { metadata: GeneratedPost["metadata"] & { generatedAt: string } };
    return {
      ...parsedCached,
      metadata: {
        ...parsedCached.metadata,
        generatedAt: new Date(parsedCached.metadata.generatedAt),
      },
    };
  }

  const userPrompt = buildGenerationPrompt(extracted, classification, format, platform);
  const result = await callLLM({
    model: MODELS.generator,
    system: GENERATION_SYSTEM_PROMPT,
    user: userPrompt,
    maxTokens: TOKEN_BUDGETS.generation.maxOutput,
  });

  await recordLlmUsage(userId, MODELS.generator, result.inputTokens, result.outputTokens);
  const parsed = parseGenerationJson(result.content);

  const generatedPost: GeneratedPost = {
    content: parsed.content,
    format,
    platform,
    hooks: parsed.hooks,
    hashtags: parsed.hashtags,
    charCount: parsed.content.length,
    model: MODELS.generator,
    promptTokens: result.inputTokens,
    completionTokens: result.outputTokens,
    metadata: {
      category: classification.category,
      toneProfile: classification.toneProfile,
      sourceType: extracted.sourceType,
      generatedAt: new Date(),
    },
  };

  await setCachedGeneration(cacheKey, JSON.stringify(generatedPost));
  return generatedPost;
}

function parseGenerationJson(raw: string): { content: string; hooks: string[]; hashtags: string[] } {
  const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("Generation returned invalid JSON");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Generation payload is not an object");
  }

  const obj = parsed as Record<string, unknown>;
  const content = typeof obj.content === "string" ? obj.content.trim() : "";
  if (!content) {
    throw new Error("Generation content is empty");
  }

  const hooks = Array.isArray(obj.hooks) ? obj.hooks.filter((item): item is string => typeof item === "string") : [];
  const hashtags = Array.isArray(obj.hashtags) ? obj.hashtags.filter((item): item is string => typeof item === "string") : [];

  return {
    content,
    hooks: hooks.slice(0, 3),
    hashtags: hashtags.slice(0, 8),
  };
}
