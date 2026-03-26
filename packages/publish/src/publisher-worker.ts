import { Worker } from "bullmq";
import type { SocialConnection } from "./adapters/linkedin.js";
import {
  LinkedInApiError,
  publishToLinkedIn,
  refreshLinkedInAccessToken
} from "./adapters/linkedin.js";
import { prisma } from "./db.js";
import { redis } from "./redis.js";
import { RETRY_CONFIGS, withRetry } from "./retry.js";
import { pathToFileURL } from "node:url";

const requiredEnvs = ["REDIS_URL"];
for (const envName of requiredEnvs) {
  if (!process.env[envName]) {
    throw new Error(`Missing required environment variable: ${envName}`);
  }
}

const redisUrl = process.env.REDIS_URL as string;
const redisConnection = new URL(redisUrl);
const connection = {
  host: redisConnection.hostname,
  port: Number(redisConnection.port || "6379"),
  maxRetriesPerRequest: null as null
};

const bullmqPrefix = "quilp";

interface PublishJobData {
  postId: string;
  userId: string;
  traceId: string;
}

function mapSocialConnection(row: {
  id: string;
  access_token_enc: string;
  refresh_token_enc: string | null;
  token_expires_at: Date | null;
  account_id: string;
}): SocialConnection {
  return {
    id: row.id,
    access_token_enc: row.access_token_enc,
    refresh_token_enc: row.refresh_token_enc,
    token_expires_at: row.token_expires_at,
    account_id: row.account_id
  };
}

async function publishWithRetryAndRefresh(params: {
  content: string;
  connectionRow: {
    id: string;
    access_token_enc: string;
    refresh_token_enc: string | null;
    token_expires_at: Date | null;
    account_id: string;
  };
  postId: string;
  traceId: string;
}): Promise<{
  platformPostId: string | null;
  publishedAt: Date | null;
}> {
  const { content, connectionRow, postId, traceId } = params;

  // 401 refresh: retry once.
  const tryRefreshOnce = async (): Promise<{
    ok: boolean;
    refreshAttempted: boolean;
    resultPost: { platformPostId: string | null; publishedAt: Date | null } | null;
  }> => {
    if (!connectionRow.refresh_token_enc) {
      return { ok: false, refreshAttempted: false, resultPost: null };
    }

    try {
      console.warn(`[${traceId}] LinkedIn token expired (401) — attempting refresh`);
      const refreshed = await refreshLinkedInAccessToken(mapSocialConnection(connectionRow));
      const refreshedRow = await prisma.social_connections.update({
        where: { id: connectionRow.id },
        data: {
          access_token_enc: refreshed.accessTokenEnc,
          refresh_token_enc: refreshed.refreshTokenEnc ?? null,
          token_expires_at: refreshed.tokenExpiresAt
        },
        select: {
          id: true,
          access_token_enc: true,
          refresh_token_enc: true,
          token_expires_at: true,
          account_id: true
        }
      });

      const refreshedConn = mapSocialConnection(refreshedRow);
      const result = await publishToLinkedIn(content, refreshedConn);
      return {
        ok: true,
        refreshAttempted: true,
        resultPost: { platformPostId: result.platformPostId, publishedAt: result.publishedAt }
      };
    } catch (err) {
      console.error(`[${traceId}] LinkedIn refresh failed`, err);
      await prisma.social_connections.update({
        where: { id: connectionRow.id },
        data: {
          is_active: false,
          access_token_enc: "",
          refresh_token_enc: ""
        }
      });
      return { ok: false, refreshAttempted: true, resultPost: null };
    }
  };

  try {
    const result = await publishToLinkedIn(
      content,
      mapSocialConnection(connectionRow)
    );
    return { platformPostId: result.platformPostId, publishedAt: result.publishedAt };
  } catch (err) {
    if (!(err instanceof LinkedInApiError)) {
      throw err;
    }

    if (err.status === 401) {
      const refreshed = await tryRefreshOnce();
      if (refreshed.ok && refreshed.resultPost) {
        return refreshed.resultPost;
      }
      throw err;
    }

    if (err.status === 429) {
      const result = await withRetry(
        () => publishToLinkedIn(content, mapSocialConnection(connectionRow)),
        RETRY_CONFIGS.rate_limited
      );
      return { platformPostId: result.platformPostId, publishedAt: result.publishedAt };
    }

    if (err.status === 400 || err.status === 422) {
      // No retry; move to review.
      await prisma.posts.update({
        where: { id: postId },
        data: { status: "queued" }
      });
      throw err;
    }

    if (err.status === 500 || err.status === 503) {
      const result = await withRetry(
        () => publishToLinkedIn(content, mapSocialConnection(connectionRow)),
        RETRY_CONFIGS.server_error
      );
      return { platformPostId: result.platformPostId, publishedAt: result.publishedAt };
    }

    throw err;
  }
}

async function bootstrap() {
  const publishWorker = new Worker<PublishJobData>(
    "post-publish",
    async job => {
      const { postId, userId, traceId } = job.data;
      console.log(`[${traceId}] Publishing post ${postId}`);

      const post = await prisma.posts.findUnique({
        where: { id: postId },
        select: { id: true, user_id: true, platform: true, status: true, content: true }
      });

      if (!post || post.status !== "approved") {
        console.warn(`[${traceId}] Post ${postId} not approved; skipping`);
        return { skipped: true };
      }

      const connectionRow = await prisma.social_connections.findFirst({
        where: { user_id: userId, platform: post.platform, is_active: true },
        select: {
          id: true,
          access_token_enc: true,
          refresh_token_enc: true,
          token_expires_at: true,
          account_id: true
        },
        orderBy: { created_at: "desc" }
      });

      if (!connectionRow) {
        await prisma.posts.update({
          where: { id: postId },
          data: { status: "queued" }
        });
        console.warn(`[${traceId}] No active social connection; moved post to queued`);
        return { skipped: true, reason: "no_connection" };
      }

      try {
        const result = await publishWithRetryAndRefresh({
          content: post.content,
          connectionRow,
          postId,
          traceId
        });

        await prisma.posts.update({
          where: { id: postId },
          data: {
            status: "posted",
            posted_at: result.publishedAt,
            platform_post_id: result.platformPostId
          }
        });

        // Set 15-minute undo TTL in Redis.
        await redis.set(
          `quilp:undo:${postId}`,
          JSON.stringify({
            platformPostId: result.platformPostId,
            platform: post.platform,
            connectionId: connectionRow.id
          }),
          "EX",
          15 * 60
        );

        console.log(
          `[${traceId}] Published — platformPostId: ${result.platformPostId}`
        );

        return {
          success: true,
          platformPostId: result.platformPostId
        };
      } catch (err: unknown) {
        if (
          err instanceof LinkedInApiError &&
          (err.status === 400 || err.status === 422)
        ) {
          // TRD: 400/422 -> no retry, move to review queue.
          // publishWithRetryAndRefresh already updated post status.
        } else {
          await prisma.posts.update({
            where: { id: postId },
            data: { status: "failed" }
          });
        }

        const message = err instanceof Error ? err.message : String(err);
        console.error(`[${traceId}] Publish failed: ${message}`);

        return { success: false, error: message };
      }
    },
    {
      connection,
      prefix: bullmqPrefix,
      concurrency: 3
    }
  );

  const shutdown = async () => {
    await publishWorker.close();
    await prisma.$disconnect();
    redis.disconnect();
  };

  process.on("SIGTERM", () => {
    void shutdown().then(() => process.exit(0));
  });
  process.on("SIGINT", () => {
    void shutdown().then(() => process.exit(0));
  });
}

const isMainModule = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

if (isMainModule) {
  void bootstrap().catch(err => {
    console.error("Failed to bootstrap publisher-worker", err);
    process.exit(1);
  });
}

