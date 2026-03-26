import { Queue } from "bullmq";
import { randomUUID } from "node:crypto";
import type { Platform } from "@prisma/client";
import { calculateScheduledTime, checkFrequencyCap, isInBlackout } from "./scheduler.js";
import { prisma } from "./db.js";

const bullmqPrefix = "quilp";
const publishQueueName = "post-publish";
const scheduleQueueName = "schedule-post";

function getBullConnection() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error("REDIS_URL is required");
  }

  // BullMQ connection object accepts host/port.
  const url = new URL(redisUrl);
  return {
    host: url.hostname,
    port: Number(url.port || "6379"),
    maxRetriesPerRequest: null as null
  };
}

const publishQueue = new Queue(publishQueueName, {
  connection: getBullConnection(),
  prefix: bullmqPrefix
});

export const scheduleQueue = new Queue(scheduleQueueName, {
  connection: getBullConnection(),
  prefix: bullmqPrefix
});

export class FrequencyCapReachedError extends Error {
  constructor() {
    super("Frequency cap reached");
    this.name = "FrequencyCapReachedError";
  }
}

async function fetchPostAndUser(postId: string) {
  const post = await prisma.posts.findUnique({
    where: { id: postId },
    select: { id: true, user_id: true, platform: true, status: true }
  });

  if (!post) return null;

  const user = await prisma.users.findUnique({
    where: { id: post.user_id },
    select: {
      timezone: true,
      blackout_start: true,
      blackout_end: true
    }
  });

  if (!user) return null;

  return { post, user };
}

export async function enqueueApprovedPostPublish(
  postId: string,
  traceId: string
): Promise<{ scheduledAt: Date }> {
  const fetched = await fetchPostAndUser(postId);
  if (!fetched) return { scheduledAt: new Date() };

  const { post, user } = fetched;

  if (post.status !== "approved") {
    // Prevent enqueueing publishes for non-approved posts.
    throw new Error(`Post ${postId} must be approved before scheduling`);
  }

  const computedAt = calculateScheduledTime(
    post.platform as Platform,
    user.timezone,
    "normal"
  );

  return enqueueApprovedPostPublishAt(postId, computedAt, traceId);
}

export async function enqueueApprovedPostPublishAt(
  postId: string,
  requestedAt: Date,
  traceId: string
): Promise<{ scheduledAt: Date }> {
  const fetched = await fetchPostAndUser(postId);
  if (!fetched) return { scheduledAt: new Date() };

  const { post, user } = fetched;

  if (post.status !== "approved") {
    throw new Error(`Post ${postId} must be approved before scheduling`);
  }

  let scheduledAt = new Date(requestedAt);

  // Adjust if in blackout period.
  while (
    isInBlackout(
      scheduledAt,
      user.blackout_start,
      user.blackout_end,
      user.timezone
    )
  ) {
    scheduledAt = new Date(scheduledAt.getTime() + 60 * 60 * 1000);
  }

  // Frequency cap check for the computed day.
  const capReached = await checkFrequencyCap(
    post.user_id,
    post.platform,
    scheduledAt
  );
  if (capReached) {
    throw new FrequencyCapReachedError();
  }

  // Persist scheduled_at before enqueueing.
  await prisma.posts.update({
    where: { id: postId },
    data: { scheduled_at: scheduledAt }
  });

  // Use deterministic jobId so rescheduling can replace older delayed jobs.
  const jobId = `publish-post-${postId}`;

  // Best-effort removal of previous delayed job (if it exists).
  try {
    const existing = await publishQueue.getJob(jobId);
    await existing?.remove();
  } catch {
    // Ignore; job might not exist yet.
  }

  await publishQueue.add(
    "publish-post",
    {
      postId,
      userId: post.user_id,
      traceId
    },
    {
      jobId,
      delay: Math.max(0, scheduledAt.getTime() - Date.now()),
      attempts: 5,
      backoff: {
        type: "exponential",
        delay: 30_000
      }
    }
  );

  return { scheduledAt };
}

export async function schedulePostJob(
  postId: string
): Promise<{ postId: string; scheduledAt: Date; status: "approved" }> {
  const traceId = randomUUID();
  const res = await enqueueApprovedPostPublish(postId, traceId);

  return {
    postId,
    scheduledAt: res.scheduledAt,
    status: "approved"
  };
}

export async function enqueuePublishNow(
  postId: string,
  traceId: string
): Promise<{ scheduledAt: Date }> {
  const fetched = await fetchPostAndUser(postId);
  if (!fetched) return { scheduledAt: new Date() };

  const { post } = fetched;

  if (post.status !== "approved") {
    throw new Error(`Post ${postId} must be approved before publishing now`);
  }

  const scheduledAt = new Date();
  await prisma.posts.update({
    where: { id: postId },
    data: { scheduled_at: scheduledAt }
  });

  const jobId = `publish-post-${postId}`;
  try {
    const existing = await publishQueue.getJob(jobId);
    await existing?.remove();
  } catch {
    // Ignore; job may not exist.
  }

  await publishQueue.add(
    "publish-post",
    {
      postId,
      userId: post.user_id,
      traceId
    },
    {
      jobId,
      delay: 0,
      attempts: 5,
      backoff: {
        type: "exponential",
        delay: 30_000
      }
    }
  );

  return { scheduledAt };
}

