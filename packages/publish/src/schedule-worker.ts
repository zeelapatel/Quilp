import { Worker } from "bullmq";
import { pathToFileURL } from "node:url";
import { schedulePostJob } from "./schedule.js";

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
  throw new Error("REDIS_URL is required");
}

const redisConnection = new URL(redisUrl);
const connection = {
  host: redisConnection.hostname,
  port: Number(redisConnection.port || "6379"),
  maxRetriesPerRequest: null as null
};

const bullmqPrefix = "quilp";
const scheduleQueueName = "schedule-post";

interface ScheduleJobData {
  postId: string;
  userId: string;
  traceId: string;
}

async function bootstrap() {
  const scheduleWorker = new Worker<ScheduleJobData>(
    scheduleQueueName,
    async job => {
      const { postId, traceId } = job.data;
      console.log(`[${traceId}] Auto-scheduling ${postId}`);
      await schedulePostJob(postId);
    },
    {
      connection,
      prefix: bullmqPrefix,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 }
      }
    }
  );

  scheduleWorker.on("failed", (job, err) => {
    if (!job) return;
    const traceId = job.data.traceId ?? `job-${job.id}`;
    console.error(`[${traceId}] Schedule worker failed: ${err.message}`);
  });

  const shutdown = async () => {
    await scheduleWorker.close();
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
    console.error("Failed to bootstrap schedule-worker", err);
    process.exit(1);
  });
}
