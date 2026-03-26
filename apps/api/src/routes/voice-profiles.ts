import type { FastifyInstance } from "fastify";
import type { VoiceProfileType } from "@prisma/client";
import { calibrateVoice } from "@quilp/cognition";
import { db } from "../lib/db.js";
import { authenticate } from "../plugins/auth.js";
import { resolveUserIdBySub, setUserContext } from "../plugins/setUserContext.js";

type CalibrateBody = {
  posts?: string[];
  profileType?: VoiceProfileType;
};

function sanitizePatternSummary(extractedPatterns: unknown) {
  const patterns = (extractedPatterns ?? {}) as Record<string, unknown>;
  return {
    writingPersona:
      typeof patterns.writingPersona === "string" ? patterns.writingPersona : "",
    emojiUsage: typeof patterns.emojiUsage === "string" ? patterns.emojiUsage : "minimal",
    avgSentenceLength:
      typeof patterns.avgSentenceLength === "number" ? patterns.avgSentenceLength : 0,
    sampleCount: typeof patterns.sampleCount === "number" ? patterns.sampleCount : 0,
    topicSignatures: Array.isArray(patterns.topicSignatures)
      ? patterns.topicSignatures.filter((item): item is string => typeof item === "string")
      : [],
  };
}

export async function voiceProfileRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/api/v1/voice-profiles",
    { preHandler: [authenticate, setUserContext] },
    async (request, reply) => {
      const auth0Sub = request.authUser?.sub;
      if (!auth0Sub) {
        return reply.code(401).send({ error: "Unauthorized" });
      }

      const userId = await resolveUserIdBySub(auth0Sub);
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized" });
      }

      const profiles = await db.voice_profiles.findMany({
        where: { user_id: userId },
        orderBy: { updated_at: "desc" },
      });

      return {
        data: profiles.map(profile => ({
          id: profile.id,
          profileType: profile.profile_type,
          version: profile.version,
          lastCalibratedAt: profile.last_calibrated_at?.toISOString() ?? null,
          patterns: sanitizePatternSummary(profile.extracted_patterns),
        })),
      };
    }
  );

  fastify.post<{ Body: CalibrateBody }>(
    "/api/v1/voice-profiles/calibrate",
    {
      preHandler: [authenticate, setUserContext],
      config: {
        rateLimit: {
          max: 5,
          timeWindow: "1 minute",
        },
      },
    },
    async (request, reply) => {
      const auth0Sub = request.authUser?.sub;
      if (!auth0Sub) {
        return reply.code(401).send({ error: "Unauthorized" });
      }

      const userId = await resolveUserIdBySub(auth0Sub);
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized" });
      }

      const user = await db.users.findUnique({
        where: { id: userId },
        select: { plan: true },
      });
      if (!user) {
        return reply.code(404).send({ error: "User not found" });
      }

      const posts = Array.isArray(request.body?.posts) ? request.body.posts : [];
      if (posts.length < 3 || posts.length > 10) {
        return reply.code(400).send({ error: "posts must contain between 3 and 10 items" });
      }

      const invalidPost = posts.find(post => typeof post !== "string" || post.trim().length < 50 || post.trim().length > 5000);
      if (invalidPost) {
        return reply.code(400).send({ error: "each post must be a string between 50 and 5000 characters" });
      }

      const profileType = request.body?.profileType ?? "personal";
      if (profileType !== "personal" && profileType !== "company") {
        return reply.code(400).send({ error: "profileType must be personal or company" });
      }

      try {
        const profile = await calibrateVoice(userId, user.plan, posts, profileType);
        return reply.code(201).send({
          data: {
            id: profile.id,
            profileType: profile.profileType,
            version: profile.version,
            lastCalibratedAt: profile.lastCalibratedAt.toISOString(),
            patterns: {
              writingPersona: profile.patterns.writingPersona,
              emojiUsage: profile.patterns.emojiUsage,
              avgSentenceLength: profile.patterns.avgSentenceLength,
              topicSignatures: profile.patterns.topicSignatures,
              sampleCount: profile.patterns.sampleCount,
            },
            message: "Voice profile calibrated successfully",
          },
        });
      } catch (error) {
        const message = String(error instanceof Error ? error.message : error);
        if (message.includes("Monthly LLM cap")) {
          return reply.code(402).send({ error: message });
        }
        return reply.code(400).send({ error: message });
      }
    }
  );

  fastify.delete(
    "/api/v1/voice-profiles/:id",
    { preHandler: [authenticate, setUserContext] },
    async (request, reply) => {
      const auth0Sub = request.authUser?.sub;
      if (!auth0Sub) {
        return reply.code(401).send({ error: "Unauthorized" });
      }

      const userId = await resolveUserIdBySub(auth0Sub);
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized" });
      }

      const id = (request.params as { id?: string }).id;
      if (!id) {
        return reply.code(400).send({ error: "Profile ID is required" });
      }

      const profile = await db.voice_profiles.findFirst({
        where: { id, user_id: userId },
        select: { id: true },
      });
      if (!profile) {
        return reply.code(404).send({ error: "Voice profile not found" });
      }

      const user = await db.users.findUnique({
        where: { id: userId },
        select: { voice_profile_id: true },
      });
      if (user?.voice_profile_id === id) {
        await db.users.update({
          where: { id: userId },
          data: { voice_profile_id: null },
        });
      }

      await db.voice_profiles.delete({
        where: { id },
      });
      return reply.code(204).send();
    }
  );
}
