import { pathToFileURL } from "node:url";
import { Worker } from "bullmq";
import { prisma } from "./db.js";
import { runGenerationPipeline } from "./pipeline.js";
import type { ExtractedContent, PipelineInput } from "./types.js";

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
  maxRetriesPerRequest: null as null,
};

interface GenerationJobData {
  processedEmailId: string;
  connectionId: string;
  userId: string;
  sourceType: string;
  extractedData: ExtractedContent;
  confidenceScore: number;
  requiresReview: boolean;
  isAllowlisted?: boolean;
  traceId: string;
}

function extractSenderEmail(metadata: Record<string, unknown> | undefined): string {
  const fromValue = typeof metadata?.from === "string" ? metadata.from : "";
  const match = fromValue.match(/<(.+?)>/);
  return (match?.[1] ?? fromValue).trim().toLowerCase();
}

async function buildPipelineInput(job: GenerationJobData): Promise<PipelineInput | null> {
  const user = await prisma.users.findUnique({
    where: { id: job.userId },
    select: {
      id: true,
      plan: true,
    },
  });
  if (!user) {
    console.warn(`[${job.traceId}] User not found, skipping job`);
    return null;
  }

  const userEmail = await decryptUserEmail(job.userId);
  return {
    processedEmailId: job.processedEmailId,
    connectionId: job.connectionId,
    userId: job.userId,
    userPlan: user.plan,
    userEmail,
    sourceType: job.sourceType as PipelineInput["sourceType"],
    extractedData: job.extractedData,
    confidenceScore: job.confidenceScore,
    requiresReview: job.requiresReview || Boolean(job.isAllowlisted),
    traceId: job.traceId,
  };
}

async function decryptUserEmail(userId: string): Promise<string> {
  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) {
    throw new Error("ENCRYPTION_KEY env var is missing — cannot redact PII from generated posts");
  }

  try {
    const rows = await prisma.$queryRaw<Array<{ email: string }>>`
      SELECT pgp_sym_decrypt(email, ${encryptionKey})::text AS email
      FROM users
      WHERE id = ${userId}
      LIMIT 1
    `;
    return rows[0]?.email ?? "";
  } catch {
    return "";
  }
}

function createGenerationWorker() {
  return new Worker<GenerationJobData>(
    "post-generation",
    async job => {
      const traceId = job.data.traceId ?? `job-${job.id}`;
      console.log(`[${traceId}] Cognition job received`);

      if (job.data.confidenceScore < 50 && !job.data.isAllowlisted) {
        console.warn(`[${traceId}] Confidence < 50 should not reach cognition worker, skipping`);
        return { skipped: true, reason: "low_confidence" };
      }

      const pipelineInput = await buildPipelineInput({
        ...job.data,
        traceId,
      });
      if (!pipelineInput) {
        return { skipped: true, reason: "missing_user" };
      }

      const result = await runGenerationPipeline(pipelineInput);
      console.log(`[${traceId}] Cognition pipeline status=${result.status} postId=${result.postId}`);
      return result;
    },
    {
      connection,
      prefix: "quilp",
      concurrency: 5,
    }
  );
}

export async function bootstrapCognitionWorker(): Promise<void> {
  const worker = createGenerationWorker();

  worker.on("failed", (job, err) => {
    if (!job) {
      return;
    }
    const traceId = job.data.traceId ?? `job-${job.id}`;
    console.error(`[${traceId}] Cognition worker failed: ${err.message}`);
  });

  const shutdown = async () => {
    await worker.close();
    await prisma.$disconnect();
  };

  process.on("SIGTERM", () => {
    void shutdown().then(() => process.exit(0));
  });
  process.on("SIGINT", () => {
    void shutdown().then(() => process.exit(0));
  });
}

const isMainModule = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (isMainModule) {
  void bootstrapCognitionWorker().catch(error => {
    console.error("Failed to bootstrap cognition worker", error);
    process.exit(1);
  });
}
