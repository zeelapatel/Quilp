import { Queue, Worker } from "bullmq";
import { randomUUID } from "node:crypto";
import { prisma } from "./db.js";
import { enqueueApprovedPostPublish } from "./schedule.js";
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
const timeoutQueueName = "approval-timeout";

interface TimeoutJobData {
  traceId?: string;
}

async function bootstrap() {
  const timeoutQueue = new Queue(timeoutQueueName, {
    connection,
    prefix: bullmqPrefix
  });

  const worker = new Worker<TimeoutJobData>(
    timeoutQueueName,
    async job => {
      const traceId = job.data.traceId ?? randomUUID();
      console.log(`[${traceId}] Approval timeout sweep`);

      const expiredRequests = await prisma.approval_requests.findMany({
        where: {
          response: null,
          timeout_at: { lt: new Date() }
        },
        select: {
          id: true,
          post_id: true,
          timeout_action: true
        }
      });

      // Batch-load posts to avoid N+1 queries.
      const postIds = expiredRequests.map(r => r.post_id);
      const posts = await prisma.posts.findMany({
        where: { id: { in: postIds } },
        select: { id: true, status: true }
      });
      const postMap = new Map(posts.map(p => [p.id, p]));

      let processed = 0;

      for (const request of expiredRequests) {
        const post = postMap.get(request.post_id);

        if (!post || post.status !== "queued") {
          // Mark orphaned/stale request as timed_out so it isn't re-processed.
          await prisma.approval_requests.update({
            where: { id: request.id },
            data: { responded_at: new Date(), response: "timed_out" }
          });
          continue;
        }

        if (request.timeout_action === "auto_post") {
          await prisma.posts.update({
            where: { id: request.post_id },
            data: { status: "approved" }
          });

          // TRD: timeout worker auto-action schedules the post.
          await enqueueApprovedPostPublish(request.post_id, traceId);
          console.log(`[${traceId}] Timeout auto-post: ${request.post_id}`);
        } else {
          await prisma.posts.update({
            where: { id: request.post_id },
            data: { status: "discarded" }
          });
          console.log(`[${traceId}] Timeout discard: ${request.post_id}`);
        }

        await prisma.approval_requests.update({
          where: { id: request.id },
          data: {
            responded_at: new Date(),
            response: "timed_out"
          }
        });

        processed += 1;
      }

      return { processed };
    },
    {
      connection,
      prefix: bullmqPrefix,
      concurrency: 2
    }
  );

  // Schedule to run every 5 minutes.
  await timeoutQueue.upsertJobScheduler(
    "approval-timeout-check",
    { every: 5 * 60 * 1000 },
    { name: "check-timeouts", data: { traceId: randomUUID() } }
  );

  const shutdown = async () => {
    await worker.close();
    await timeoutQueue.close();
    await prisma.$disconnect();
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
    console.error("Failed to bootstrap timeout-worker", err);
    process.exit(1);
  });
}

