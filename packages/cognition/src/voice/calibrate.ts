import { Prisma } from "@prisma/client";
import { callLLM } from "../client.js";
import { MODELS } from "../constants.js";
import { checkCostCap, recordLlmUsage } from "../cost-cap.js";
import { CostCapExceededError } from "../errors.js";
import { prisma } from "../db.js";
import type { VoicePatterns, VoiceProfile } from "./types.js";

const CALIBRATION_SYSTEM_PROMPT = `
You are a writing analyst specializing in personal brand voice.
Extract distinctive writing patterns from the sample posts.

Rules:
- Return ONLY valid JSON matching the requested schema.
- No markdown or code fences.
- Keep vocabulary/opening/closing/topic arrays concise and concrete.
`;

function buildCalibrationPrompt(posts: string[]): string {
  const numbered = posts.map((post, index) => `--- POST ${index + 1} ---\n${post}`).join("\n\n");
  return `
Analyze these ${posts.length} posts and extract the author's writing patterns:

${numbered}

Return exact JSON:
{
  "avgSentenceLength": number,
  "avgParagraphLength": number,
  "vocabularyPatterns": ["phrase1", "phrase2"],
  "avoidedPhrases": ["phrase1", "phrase2"],
  "emojiUsage": "none|minimal|moderate",
  "punctuationStyle": {
    "usesEllipsis": boolean,
    "usesExclamation": boolean,
    "usesDash": boolean
  },
  "openingPatterns": ["pattern1", "pattern2"],
  "closingPatterns": ["pattern1", "pattern2"],
  "usesNumberedLists": boolean,
  "usesBulletPoints": boolean,
  "topicSignatures": ["topic1", "topic2"],
  "writingPersona": "one sentence description"
}
`;
}

export async function calibrateVoice(
  userId: string,
  userPlan: string,
  samplePosts: string[],
  profileType: "personal" | "company" = "personal"
): Promise<VoiceProfile> {
  if (samplePosts.length < 3) {
    throw new Error("Minimum 3 sample posts required for calibration");
  }

  const cappedPosts = samplePosts.slice(0, 10);
  const validPosts = cappedPosts.map(post => post.trim()).filter(post => post.length >= 50 && post.length <= 5000);
  if (validPosts.length < 3) {
    throw new Error("Posts too short - each sample must be at least 50 characters");
  }

  const capResult = await checkCostCap(userId, userPlan);
  if (!capResult.allowed) {
    throw new CostCapExceededError(capResult.reason ?? "Monthly cap exceeded");
  }

  const llmResult = await callLLM({
    model: MODELS.generator,
    system: CALIBRATION_SYSTEM_PROMPT,
    user: buildCalibrationPrompt(validPosts),
    maxTokens: 800,
  });

  await recordLlmUsage(userId, MODELS.generator, llmResult.inputTokens, llmResult.outputTokens);
  const parsedPatterns = parsePatternsJson(llmResult.content);

  const fullPatterns: VoicePatterns = {
    ...parsedPatterns,
    sampleCount: validPosts.length,
    calibratedAt: new Date(),
  };

  const profile = await prisma.voice_profiles.upsert({
    where: {
      user_id_profile_type: {
        user_id: userId,
        profile_type: profileType,
      },
    },
    create: {
      user_id: userId,
      profile_type: profileType,
      calibration_posts: validPosts as unknown as Prisma.InputJsonValue,
      extracted_patterns: fullPatterns as unknown as Prisma.InputJsonValue,
      version: 1,
      last_calibrated_at: new Date(),
    },
    update: {
      calibration_posts: validPosts as unknown as Prisma.InputJsonValue,
      extracted_patterns: fullPatterns as unknown as Prisma.InputJsonValue,
      version: { increment: 1 },
      last_calibrated_at: new Date(),
    },
  });

  if (profileType === "personal") {
    await prisma.users.update({
      where: { id: userId },
      data: { voice_profile_id: profile.id },
    });
  }

  return {
    id: profile.id,
    userId: profile.user_id,
    profileType: profile.profile_type,
    patterns: fullPatterns,
    version: profile.version,
    lastCalibratedAt: profile.last_calibrated_at,
  };
}

function parsePatternsJson(raw: string): Omit<VoicePatterns, "sampleCount" | "calibratedAt"> {
  const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("Failed to parse calibration JSON");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Calibration payload is not an object");
  }

  const obj = parsed as Record<string, unknown>;
  const emojiUsage = typeof obj.emojiUsage === "string" ? obj.emojiUsage : "minimal";
  if (!["none", "minimal", "moderate"].includes(emojiUsage)) {
    throw new Error("Invalid emojiUsage in calibration payload");
  }

  return {
    avgSentenceLength: normalizeNumber(obj.avgSentenceLength, 12),
    avgParagraphLength: normalizeNumber(obj.avgParagraphLength, 3),
    vocabularyPatterns: normalizeStringArray(obj.vocabularyPatterns),
    avoidedPhrases: normalizeStringArray(obj.avoidedPhrases),
    emojiUsage: emojiUsage as VoicePatterns["emojiUsage"],
    punctuationStyle: {
      usesEllipsis: normalizeBoolean((obj.punctuationStyle as Record<string, unknown> | undefined)?.usesEllipsis, false),
      usesExclamation: normalizeBoolean((obj.punctuationStyle as Record<string, unknown> | undefined)?.usesExclamation, false),
      usesDash: normalizeBoolean((obj.punctuationStyle as Record<string, unknown> | undefined)?.usesDash, false),
    },
    openingPatterns: normalizeStringArray(obj.openingPatterns),
    closingPatterns: normalizeStringArray(obj.closingPatterns),
    usesNumberedLists: normalizeBoolean(obj.usesNumberedLists, false),
    usesBulletPoints: normalizeBoolean(obj.usesBulletPoints, false),
    topicSignatures: normalizeStringArray(obj.topicSignatures),
    writingPersona: typeof obj.writingPersona === "string" ? obj.writingPersona.trim().slice(0, 220) : "Direct and practical communicator.",
  };
}

function normalizeNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string").map(item => item.trim()).filter(Boolean).slice(0, 20);
}
