import type { PostStatus } from "@prisma/client";
import { MODELS, VOICE_SCORE_THRESHOLD } from "./constants.js";
import { checkCostCap } from "./cost-cap.js";
import { CostCapExceededError } from "./errors.js";
import { classifyContent } from "./steps/classify.js";
import { generatePost } from "./steps/generate.js";
import { redactPII } from "./steps/redact.js";
import { prisma } from "./db.js";
import type { PipelineInput, PipelineOutput } from "./types.js";
import { scoreVoice } from "./voice/score.js";
import type { VoicePatterns } from "./voice/types.js";

import { sendApprovalEmail } from "@quilp/publish/approval";
import { scheduleQueue } from "@quilp/publish/schedule";

export async function runGenerationPipeline(input: PipelineInput): Promise<PipelineOutput> {
  const startedAt = Date.now();
  const { traceId } = input;
  console.log(`[${traceId}] Pipeline start - ${input.sourceType}`);

  const capResult = await checkCostCap(input.userId, input.userPlan);
  if (!capResult.allowed) {
    console.warn(`[${traceId}] Cost cap exceeded - queuing review fallback`);
    const post = await createPostRecord(input, {
      content: "",
      category: "thought_leadership",
      status: "queued",
      llmModel: null,
      generationMs: Date.now() - startedAt,
      promptTokens: 0,
      completionTokens: 0,
      voiceScore: null,
    });
    return {
      postId: post.id,
      status: "cost_cap",
      generationMs: Date.now() - startedAt,
      confidenceScore: input.confidenceScore,
      voiceScore: null,
      wasRedacted: false,
    };
  }

  try {
    console.log(`[${traceId}] Step 1 - classify`);
    const classification = await classifyContent(input.extractedData, input.userId, input.userPlan);

    console.log(`[${traceId}] Step 2 - generate`);
    const generated = await generatePost(
      input.extractedData,
      classification,
      "long_form",
      "linkedin_personal",
      input.userId,
      input.userPlan,
      input.processedEmailId
    );

    console.log(`[${traceId}] Step 3 - redact`);
    const redaction = redactPII(generated.content, input.userEmail);
    const redactedContent = redaction.content;
    const generationMs = Date.now() - startedAt;
    let requiresReview = input.requiresReview || input.confidenceScore < 75;
    let voiceScoreValue: number | null = null;

    const voiceProfile = await prisma.voice_profiles.findUnique({
      where: {
        user_id_profile_type: {
          user_id: input.userId,
          profile_type: "personal",
        },
      },
    });

    if (voiceProfile) {
      console.log(`[${traceId}] Step 4 - scoring voice`);
      try {
        const patterns = voiceProfile.extracted_patterns as unknown as VoicePatterns;
        const samples = voiceProfile.calibration_posts as unknown as string[];
        const voiceScore = await scoreVoice(redactedContent, patterns, samples, input.userId);
        voiceScoreValue = voiceScore.score;
        if (!voiceScore.passesThreshold) {
          requiresReview = true;
          console.warn(
            `[${traceId}] Voice score below ${VOICE_SCORE_THRESHOLD} - flagging for review`
          );
        }
        console.log(
          `[${traceId}] Voice score: ${voiceScore.score}/100 - passes: ${voiceScore.passesThreshold}`
        );
      } catch (error) {
        // Non-negotiable: scoring failures must never block post creation.
        console.warn(`[${traceId}] Voice scoring failed; continuing without score: ${String(error)}`);
      }
    } else {
      console.log(`[${traceId}] No personal voice profile found - skipping voice score`);
    }

    const post = await createPostRecord(input, {
      content: redactedContent,
      category: classification.category,
      status: "queued",
      llmModel: MODELS.generator,
      generationMs,
      promptTokens: generated.promptTokens,
      completionTokens: generated.completionTokens,
      voiceScore: voiceScoreValue,
    });

    console.log(`[${traceId}] Pipeline complete - postId=${post.id} generationMs=${generationMs}`);

    // Pipeline-generated posts are always queued.
    // `requiresReview` controls approval behavior, not initial status.
    let outputStatus: PipelineOutput["status"] = "queued";
    if (post.status === "queued") {
      const userApproval = await prisma.users.findUnique({
        where: { id: input.userId },
        select: { approval_mode: true }
      });

      if (userApproval?.approval_mode === "require_approval" || requiresReview) {
        void sendApprovalEmail(post.id, input.userId).catch(err => {
          console.error(`[${traceId}] Approval email failed:`, err);
        });
      } else if (userApproval?.approval_mode === "auto_post" && !requiresReview) {
        await prisma.posts.update({
          where: { id: post.id },
          data: { status: "approved" }
        });
        outputStatus = "approved";
        try {
          await scheduleQueue.add("schedule-post", {
            postId: post.id,
            userId: input.userId,
            traceId: input.traceId
          });
        } catch (enqueueErr) {
          console.error(`[${traceId}] Schedule enqueue failed, rolling back post to queued:`, enqueueErr);
          await prisma.posts.update({
            where: { id: post.id },
            data: { status: "queued" }
          });
          outputStatus = "queued";
        }
      }
    }

    return {
      postId: post.id,
      status: outputStatus,
      generationMs,
      confidenceScore: input.confidenceScore,
      voiceScore: voiceScoreValue,
      wasRedacted: redaction.wasRedacted,
    };
  } catch (error) {
    if (error instanceof CostCapExceededError) {
      return handleCostCapError(input, startedAt, error.message);
    }
    console.error(`[${traceId}] Pipeline failed: ${String(error)}`);
    return handlePipelineError(input, startedAt);
  }
}

async function createPostRecord(
  input: PipelineInput,
  data: {
    content: string;
    category: string;
    status: PostStatus;
    llmModel: string | null;
    generationMs: number;
    promptTokens: number;
    completionTokens: number;
    voiceScore: number | null;
  }
) {
  return prisma.posts.create({
    data: {
      user_id: input.userId,
      source_email_id: input.processedEmailId,
      platform: "linkedin_personal",
      format: "long_form",
      content: data.content,
      content_original: data.content,
      category: data.category,
      confidence_score: input.confidenceScore,
      voice_score: data.voiceScore,
      status: data.status,
      is_user_edited: false,
      llm_model: data.llmModel,
      generation_ms: data.generationMs,
      prompt_tokens: data.promptTokens,
      completion_tokens: data.completionTokens,
    },
  });
}

async function handlePipelineError(input: PipelineInput, startedAt: number): Promise<PipelineOutput> {
  const post = await prisma.posts.create({
    data: {
      user_id: input.userId,
      source_email_id: input.processedEmailId,
      platform: "linkedin_personal",
      format: "long_form",
      content: "",
      content_original: "",
      category: "thought_leadership",
      confidence_score: input.confidenceScore,
      voice_score: null,
      status: "failed",
      is_user_edited: false,
    },
  });

  return {
    postId: post.id,
    status: "failed",
    generationMs: Date.now() - startedAt,
    confidenceScore: input.confidenceScore,
    voiceScore: null,
    wasRedacted: false,
  };
}

async function handleCostCapError(input: PipelineInput, startedAt: number, reason: string): Promise<PipelineOutput> {
  console.warn(`[${input.traceId}] Cost cap error in step: ${reason}`);
  const post = await prisma.posts.create({
    data: {
      user_id: input.userId,
      source_email_id: input.processedEmailId,
      platform: "linkedin_personal",
      format: "long_form",
      content: "",
      content_original: "",
      category: "thought_leadership",
      confidence_score: input.confidenceScore,
      voice_score: null,
      status: "queued",
      is_user_edited: false,
    },
  });

  return {
    postId: post.id,
    status: "cost_cap",
    generationMs: Date.now() - startedAt,
    confidenceScore: input.confidenceScore,
    voiceScore: null,
    wasRedacted: false,
  };
}
