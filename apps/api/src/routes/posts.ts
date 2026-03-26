import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { db } from "../lib/db.js";
import { authenticate } from "../plugins/auth.js";
import { resolveUserIdBySub, setUserContext } from "../plugins/setUserContext.js";
import { redis } from "../lib/redis.js";
import type { Platform, PostStatus } from "@prisma/client";
import {
  enqueuePublishNow,
  FrequencyCapReachedError,
  enqueueApprovedPostPublishAt,
  schedulePostJob
} from "@quilp/publish/schedule";
import { deleteLinkedInPost } from "@quilp/publish/adapters/linkedin";

const PLAN_COST_CAPS: Record<string, number> = {
  starter: 0.2,
  solo: 0.8,
  pro: 3.0,
  team: 10.0,
  agency: 30.0,
  enterprise: 999.99,
};

type ListPostsQuery = {
  status?: string;
  platform?: string;
  cursor?: string;
  limit?: string;
};

function isPostStatus(value: string): value is PostStatus {
  return ["draft", "queued", "approved", "posted", "failed", "discarded"].includes(value);
}

function isPlatform(value: string): value is Platform {
  return ["linkedin_personal", "linkedin_company", "x", "instagram", "facebook", "substack", "beehiiv", "slack", "notion"].includes(value);
}

function parseLimit(limit?: string): number {
  const parsed = Number.parseInt(limit ?? "20", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 20;
  }
  return Math.min(parsed, 50);
}

export async function postsRoutes(fastify: FastifyInstance) {
  fastify.get<{ Querystring: ListPostsQuery }>(
    "/api/v1/posts",
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

      const limit = parseLimit(request.query.limit);
      const where: {
        user_id: string;
        status?: PostStatus;
        platform?: Platform;
      } = {
        user_id: userId,
      };
      if (request.query.status && isPostStatus(request.query.status)) {
        where.status = request.query.status;
      }
      if (request.query.platform && isPlatform(request.query.platform)) {
        where.platform = request.query.platform;
      }

      if (request.query.cursor && !/^[0-9a-f-]{36}$/i.test(request.query.cursor)) {
        return reply.code(400).send({ error: "Invalid cursor" });
      }

      const posts = await db.posts.findMany({
        where,
        orderBy: [{ created_at: "desc" }, { id: "desc" }],
        take: limit + 1,
        ...(request.query.cursor
          ? {
              cursor: { id: request.query.cursor },
              skip: 1,
            }
          : {}),
      });

      const hasMore = posts.length > limit;
      const data = hasMore ? posts.slice(0, limit) : posts;
      const nextCursor = hasMore ? data[data.length - 1]?.id ?? null : null;
      const total = await db.posts.count({ where });

      return {
        data,
        meta: {
          nextCursor,
          hasMore,
          total,
        },
      };
    }
  );

  fastify.get(
    "/api/v1/posts/:id",
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
        return reply.code(400).send({ error: "Post ID is required" });
      }

      const post = await db.posts.findFirst({
        where: { id, user_id: userId },
      });
      if (!post) {
        return reply.code(404).send({ error: "Post not found" });
      }

      const sourceEmail =
        post.source_email_id !== null
          ? await db.processed_emails.findFirst({
              where: { id: post.source_email_id, user_id: userId },
              select: {
                source_type: true,
                subject: true,
                confidence_score: true,
              },
            })
          : null;

      return {
        data: {
          ...post,
          sourceEmail: sourceEmail
            ? {
                sourceType: sourceEmail.source_type,
                subject: sourceEmail.subject,
                confidenceScore: sourceEmail.confidence_score,
              }
            : null,
        },
      };
    }
  );

  fastify.post(
    "/api/v1/posts/:id/approve",
    {
      preHandler: [authenticate, setUserContext],
      config: {
        rateLimit: {
          max: 60,
          timeWindow: "1 minute"
        }
      }
    },
    async (request, reply) => {
      const auth0Sub = request.authUser?.sub;
      if (!auth0Sub) return reply.code(401).send({ error: "Unauthorized" });

      const userId = await resolveUserIdBySub(auth0Sub);
      if (!userId) return reply.code(401).send({ error: "Unauthorized" });

      const id = (request.params as { id?: string }).id;
      if (!id) return reply.code(400).send({ error: "Post ID is required" });

      const post = await db.posts.findFirst({
        where: { id, user_id: userId },
        select: { id: true, status: true }
      });

      if (!post) return reply.code(404).send({ error: "Post not found" });
      if (post.status !== "queued") {
        return reply.code(400).send({ error: "Post must be in queued state" });
      }

      await db.posts.update({
        where: { id },
        data: { status: "approved" }
      });

      try {
        const scheduled = await schedulePostJob(id);
        return reply.send({
          data: {
            postId: scheduled.postId,
            scheduledAt: scheduled.scheduledAt,
            status: scheduled.status
          }
        });
      } catch (err: unknown) {
        if (err instanceof FrequencyCapReachedError) {
          await db.posts.update({
            where: { id },
            data: { status: "queued" }
          });
          return reply.code(409).send({
            error: "Frequency cap reached; cannot schedule this post"
          });
        }
        throw err;
      }
    }
  );

  fastify.post(
    "/api/v1/posts/:id/publish-now",
    {
      preHandler: [authenticate, setUserContext],
      config: {
        rateLimit: {
          max: 30,
          timeWindow: "1 minute"
        }
      }
    },
    async (request, reply) => {
      const auth0Sub = request.authUser?.sub;
      if (!auth0Sub) return reply.code(401).send({ error: "Unauthorized" });

      const userId = await resolveUserIdBySub(auth0Sub);
      if (!userId) return reply.code(401).send({ error: "Unauthorized" });

      const id = (request.params as { id?: string }).id;
      if (!id) return reply.code(400).send({ error: "Post ID is required" });

      const post = await db.posts.findFirst({
        where: { id, user_id: userId },
        select: { id: true, status: true, platform: true }
      });

      if (!post) return reply.code(404).send({ error: "Post not found" });
      if (!["queued", "approved", "draft"].includes(post.status)) {
        return reply.code(400).send({ error: "Post cannot be published now from its current state" });
      }

      const activeConnection = await db.social_connections.findFirst({
        where: {
          user_id: userId,
          platform: post.platform,
          is_active: true
        },
        select: { id: true }
      });

      if (!activeConnection) {
        return reply.code(409).send({ error: `No active ${post.platform} connection found` });
      }

      const previousStatus = post.status;
      if (post.status !== "approved") {
        await db.posts.update({
          where: { id },
          data: { status: "approved" }
        });
      }

      const traceId = randomUUID();
      try {
        const scheduled = await enqueuePublishNow(id, traceId);
        return reply.send({
          data: {
            postId: id,
            status: "approved",
            scheduledAt: scheduled.scheduledAt
          }
        });
      } catch (error) {
        if (previousStatus !== "approved") {
          await db.posts.update({
            where: { id },
            data: { status: previousStatus }
          });
        }
        throw error;
      }
    }
  );

  fastify.post(
    "/api/v1/posts/:id/discard",
    {
      preHandler: [authenticate, setUserContext],
      config: {
        rateLimit: {
          max: 60,
          timeWindow: "1 minute"
        }
      }
    },
    async (request, reply) => {
      const auth0Sub = request.authUser?.sub;
      if (!auth0Sub) return reply.code(401).send({ error: "Unauthorized" });

      const userId = await resolveUserIdBySub(auth0Sub);
      if (!userId) return reply.code(401).send({ error: "Unauthorized" });

      const id = (request.params as { id?: string }).id;
      if (!id) return reply.code(400).send({ error: "Post ID is required" });

      const post = await db.posts.findFirst({
        where: { id, user_id: userId },
        select: { id: true }
      });

      if (!post) return reply.code(404).send({ error: "Post not found" });

      await db.posts.update({
        where: { id },
        data: { status: "discarded" }
      });

      return reply.code(204).send();
    }
  );

  fastify.patch(
    "/api/v1/posts/:id",
    {
      preHandler: [authenticate, setUserContext],
      config: {
        rateLimit: {
          max: 30,
          timeWindow: "1 minute"
        }
      }
    },
    async (request, reply) => {
      const auth0Sub = request.authUser?.sub;
      if (!auth0Sub) return reply.code(401).send({ error: "Unauthorized" });

      const userId = await resolveUserIdBySub(auth0Sub);
      if (!userId) return reply.code(401).send({ error: "Unauthorized" });

      const id = (request.params as { id?: string }).id;
      if (!id) return reply.code(400).send({ error: "Post ID is required" });

      const body = request.body as {
        content?: string;
        scheduled_at?: string;
      };

      const post = await db.posts.findFirst({
        where: { id, user_id: userId },
        select: { id: true, content: true, status: true }
      });

      if (!post) return reply.code(404).send({ error: "Post not found" });

      const updates: { content?: string; is_user_edited?: boolean } = {};
      if (typeof body.content === "string") {
        const nextContent = body.content;
        if (nextContent !== post.content) {
          updates.content = nextContent;
          updates.is_user_edited = true;
        }
      }

      if (Object.keys(updates).length > 0) {
        await db.posts.update({
          where: { id },
          data: updates
        });
      }

      if (typeof body.scheduled_at === "string") {
        const requested = new Date(body.scheduled_at);
        if (!Number.isFinite(requested.getTime())) {
          return reply.code(400).send({ error: "Invalid scheduled_at" });
        }
        if (requested.getTime() <= Date.now()) {
          return reply.code(400).send({ error: "scheduled_at must be in the future" });
        }

        if (post.status !== "approved") {
          return reply
            .code(400)
            .send({ error: "Only approved posts can be scheduled" });
        }

        const traceId = randomUUID();
        try {
          await enqueueApprovedPostPublishAt(id, requested, traceId);
        } catch (err: unknown) {
          if (err instanceof FrequencyCapReachedError) {
            return reply.code(409).send({
              error: "Frequency cap reached; cannot reschedule this post"
            });
          }
          throw err;
        }
      }

      const updated = await db.posts.findUnique({
        where: { id },
        select: {
          id: true,
          content: true,
          status: true,
          scheduled_at: true,
          is_user_edited: true,
          platform_post_id: true
        }
      });

      return reply.send({ data: updated });
    }
  );

  fastify.post(
    "/api/v1/posts/:id/delete",
    {
      preHandler: [authenticate, setUserContext],
      config: {
        rateLimit: {
          max: 10,
          timeWindow: "1 minute"
        }
      }
    },
    async (request, reply) => {
      const auth0Sub = request.authUser?.sub;
      if (!auth0Sub) return reply.code(401).send({ error: "Unauthorized" });

      const userId = await resolveUserIdBySub(auth0Sub);
      if (!userId) return reply.code(401).send({ error: "Unauthorized" });

      const id = (request.params as { id?: string }).id;
      if (!id) return reply.code(400).send({ error: "Post ID is required" });

      const post = await db.posts.findFirst({
        where: { id, user_id: userId },
        select: { id: true, status: true }
      });

      if (!post) return reply.code(404).send({ error: "Post not found" });

      const undoRaw = await redis.get(`quilp:undo:${id}`);
      if (!undoRaw) {
        return reply.code(410).send({
          error: "Undo window expired (15 min)"
        });
      }

      let undo: {
        platformPostId: string | null;
        platform: string;
        connectionId: string;
      };
      try {
        undo = JSON.parse(undoRaw);
      } catch {
        return reply.code(410).send({ error: "Undo window expired (15 min)" });
      }

      if (!undo.platformPostId) {
        return reply.code(410).send({ error: "Undo window expired (15 min)" });
      }

      const connectionRow = await db.social_connections.findFirst({
        where: { id: undo.connectionId, user_id: userId },
        select: {
          id: true,
          access_token_enc: true,
          refresh_token_enc: true,
          token_expires_at: true,
          account_id: true
        }
      });

      if (!connectionRow) {
        return reply.code(404).send({ error: "Social connection not found" });
      }

      const deletion = await deleteLinkedInPost(undo.platformPostId, {
        id: connectionRow.id,
        access_token_enc: connectionRow.access_token_enc,
        refresh_token_enc: connectionRow.refresh_token_enc,
        token_expires_at: connectionRow.token_expires_at,
        account_id: connectionRow.account_id
      });

      if (!deletion.success) {
        return reply.code(502).send({ error: deletion.error ?? "Delete failed" });
      }

      await db.posts.update({
        where: { id },
        data: { status: "discarded" }
      });

      await redis.del(`quilp:undo:${id}`);
      return reply.code(204).send();
    }
  );

  fastify.get(
    "/api/v1/analytics/llm-usage",
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

      const user = await db.users.findUnique({
        where: { id: userId },
        select: { plan: true, llm_monthly_cap_usd: true },
      });
      if (!user) {
        return reply.code(404).send({ error: "User not found" });
      }

      const month = new Date().toISOString().slice(0, 7);
      const usage = await db.llm_usage.findUnique({
        where: {
          user_id_month: {
            user_id: userId,
            month,
          },
        },
      });

      const spendUsd = Number(usage?.cost_usd ?? 0);
      const capUsd = user.llm_monthly_cap_usd
        ? Number(user.llm_monthly_cap_usd)
        : PLAN_COST_CAPS[user.plan] ?? PLAN_COST_CAPS.starter ?? 0.2;
      const remainingUsd = Math.max(0, capUsd - spendUsd);
      const percentUsed = capUsd > 0 ? Math.min(100, (spendUsd / capUsd) * 100) : 100;

      return {
        data: {
          month,
          spendUsd,
          capUsd,
          remainingUsd,
          callCount: usage?.call_count ?? 0,
          percentUsed,
        },
      };
    }
  );
}
