import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { google } from "googleapis";
import type { gmail_v1 } from "googleapis";
import { Prisma, PrismaClient, type SourceType } from "@prisma/client";
import { Queue, type JobsOptions, Worker } from "bullmq";
import { Redis } from "ioredis";
import { decryptToken } from "@quilp/shared";
import { checkConfidentiality } from "./classifiers/confidentiality.js";
import { extractEmail, matchSender } from "./fingerprint.js";
import { getParser } from "./parsers/index.js";
import { setupTokenRefresh } from "./token-refresh.js";
import type { RawEmail } from "./types.js";

interface PollJobData {
  connectionId: string;
  userId: string;
  userTimezone: string;
  traceId: string;
}

interface PollResult {
  processed: number;
  held: number;
  skipped: number;
}

const requiredEnvs = ["REDIS_URL", "GMAIL_CLIENT_ID", "GMAIL_CLIENT_SECRET", "TOKEN_ENCRYPTION_KEY"];
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
const bullmqPrefix = "quilp";
const pollQueueName = "email-poll";

const db = new PrismaClient({
  datasourceUrl: process.env.DATABASE_APP_URL ?? process.env.DATABASE_URL,
});

const pollJobOptions: JobsOptions = {
  attempts: 5,
  backoff: {
    type: "exponential",
    delay: 30_000,
  },
  removeOnComplete: 100,
  removeOnFail: 500,
};

export const pollQueue = new Queue<PollJobData>(pollQueueName, {
  connection,
  prefix: bullmqPrefix,
  defaultJobOptions: pollJobOptions,
});

const dlq = new Queue("email-poll-dlq", {
  connection,
  prefix: bullmqPrefix,
});

export const processingQueue = new Queue("post-generation", {
  connection,
  prefix: bullmqPrefix,
});

async function handlePollJob(jobData: PollJobData): Promise<PollResult | { skipped: true; reason: string }> {
  const traceId = jobData.traceId || randomUUID();
  const { connectionId, userId } = jobData;
  console.log(`[${traceId}] Starting poll for connection ${connectionId}`);

  const emailConnection = await db.email_connections.findFirst({
    where: {
      id: connectionId,
      user_id: userId,
      is_active: true,
      provider: "gmail",
    },
  });

  if (!emailConnection) {
    console.log(`[${traceId}] Connection not found or inactive - skipping`);
    return { skipped: true, reason: "connection_inactive" };
  }

  const accessToken = decryptToken(emailConnection.access_token_enc, process.env.TOKEN_ENCRYPTION_KEY as string);
  const auth = new google.auth.OAuth2(process.env.GMAIL_CLIENT_ID, process.env.GMAIL_CLIENT_SECRET);
  auth.setCredentials({ access_token: accessToken });
  const gmail = google.gmail({ version: "v1", auth });

  let messages: Array<{ id?: string | null }> = [];
  if (emailConnection.last_history_id) {
    try {
      const historyRes = await gmailCall(
        () =>
          gmail.users.history.list({
            userId: "me",
            startHistoryId: emailConnection.last_history_id as string,
            historyTypes: ["messageAdded"],
          }),
        emailConnection.id
      );
      const history = historyRes.data.history ?? [];
      messages = history
        .flatMap(item => item.messagesAdded ?? [])
        .map(item => item.message)
        .filter((message): message is { id?: string | null } => Boolean(message));
    } catch (error) {
      if (isGmailNotFoundError(error)) {
        console.log(`[${traceId}] History expired, falling back to recent fetch`);
        messages = await fetchRecentMessages(gmail, emailConnection.id);
      } else if (error instanceof GmailAuthRevokedError) {
        await db.email_connections.update({
          where: { id: emailConnection.id },
          data: { is_active: false },
        });
        console.warn(`[${traceId}] Gmail auth revoked, connection marked inactive`);
        return { skipped: true, reason: "auth_revoked" };
      } else {
        throw error;
      }
    }
  } else {
    messages = await fetchRecentMessages(gmail, emailConnection.id);
  }

  console.log(`[${traceId}] Found ${messages.length} new messages`);
  if (messages.length === 0) {
    console.log(`[${traceId}] No new email for connection ${connectionId}`);
  } else {
    console.log(
      `[${traceId}] New email detected for connection ${connectionId} (count: ${messages.length})`
    );
  }
  let processed = 0;
  let held = 0;
  let skipped = 0;

  for (const msg of messages) {
    if (!msg.id) {
      skipped += 1;
      continue;
    }

    try {
      console.log(`[${traceId}] Processing new email messageId=${msg.id}`);
      const fullMsg = await gmailCall(
        () =>
          gmail.users.messages.get({
            userId: "me",
            id: msg.id as string,
            format: "FULL",
          }),
        emailConnection.id
      );

      if (!fullMsg.data) {
        skipped += 1;
        continue;
      }
      const rawEmail = parseGmailMessage(fullMsg.data);
      const confidentialityResult = checkConfidentiality(rawEmail);

      if (confidentialityResult.isConfidential) {
        await db.processed_emails.upsert({
          where: {
            connection_id_message_id: {
              connection_id: connectionId,
              message_id: rawEmail.messageId,
            },
          },
          create: {
            user_id: userId,
            connection_id: connectionId,
            message_id: rawEmail.messageId,
            sender_email: extractEmail(rawEmail.from),
            sender_name: extractName(rawEmail.from) || null,
            source_type: "generic",
            subject: rawEmail.subject,
            extracted_data: {},
            confidence_score: 0,
            processing_status: "held",
            held_reason: confidentialityResult.reason,
          },
          update: {
            processing_status: "held",
            held_reason: confidentialityResult.reason,
          },
        });
        console.warn(`[${traceId}] Email held - confidentiality signal: ${confidentialityResult.signal}`);
        held += 1;
        continue;
      }

      const userDebugFlagRows = await db.$queryRaw<
        Array<{ debug_parse_all_emails: boolean; debug_generate_posts: boolean }>
      >`SELECT debug_parse_all_emails, debug_generate_posts FROM users WHERE id = ${userId}::uuid LIMIT 1`;
      const userDebugFlags = userDebugFlagRows[0] ?? null;
      const debugModeActive =
        process.env.NODE_ENV === "development" && userDebugFlags?.debug_parse_all_emails === true;

      const senderEmail = extractEmail(rawEmail.from).toLowerCase();

      const allowlistRow = await db.sender_allowlist.findUnique({
        where: { user_id_email: { user_id: userId, email: senderEmail } },
        select: { id: true },
      });
      const isAllowlisted = allowlistRow !== null;

      let fingerprint = matchSender(rawEmail);
      if (!fingerprint && (debugModeActive || isAllowlisted)) {
        fingerprint = {
          source: "generic",
          senderPatterns: ["*"],
          subjectPatterns: [/.*/],
          parserModule: "generic",
        };
        const bypassReason = isAllowlisted ? "ALLOWLISTED SENDER" : "DEBUG MODE";
        console.warn(
          `[${traceId}] [${bypassReason}] Bypassing fingerprint for: "${rawEmail.subject}" from ${rawEmail.from}`
        );
      }

      if (!fingerprint) {
        skipped += 1;
        continue;
      }

      const existing = await db.processed_emails.findUnique({
        where: {
          connection_id_message_id: {
            connection_id: connectionId,
            message_id: rawEmail.messageId,
          },
        },
      });
      if (existing?.processing_status === "completed") {
        skipped += 1;
        continue;
      }

      const parser = getParser(fingerprint.source as SourceType);
      if (!parser || !parser.canParse(rawEmail)) {
        skipped += 1;
        continue;
      }

      // IN-14 verified clean before this point
      const extracted = await parser.parse(rawEmail);
      const confidence = parser.validate(extracted);
      const status = confidence.score < 50 ? "dlq" : "completed";

      const stored = await db.processed_emails.upsert({
        where: {
          connection_id_message_id: {
            connection_id: connectionId,
            message_id: rawEmail.messageId,
          },
        },
        create: {
          user_id: userId,
          connection_id: connectionId,
          message_id: rawEmail.messageId,
          sender_email: senderEmail,
          sender_name: extractName(rawEmail.from) || null,
          source_type: fingerprint.source,
          subject: rawEmail.subject,
          extracted_data: extracted as unknown as Prisma.InputJsonValue,
          confidence_score: confidence.score,
          processing_status: status,
        },
        update: {
          extracted_data: extracted as unknown as Prisma.InputJsonValue,
          confidence_score: confidence.score,
          processing_status: status,
        },
      });

      if (debugModeActive && !userDebugFlags?.debug_generate_posts && confidence.score >= 50) {
        console.log(
          `[${traceId}] [DEBUG MODE - PARSE ONLY] Subject: "${rawEmail.subject}" | Source: ${fingerprint.source} | Confidence: ${confidence.score} | KeyPoints: ${extracted.keyPoints.length} | ActionItems: ${extracted.actionItems.length}\nExtractedContent: ${JSON.stringify(extracted, null, 2)}`
        );
        processed += 1;
        continue;
      }

      if (confidence.score < 50 && !isAllowlisted) {
        await dlq.add(
          "low-confidence",
          {
            processedEmailId: stored.id,
            connectionId,
            userId,
            confidence: confidence.score,
            reason: confidence.reason,
            traceId,
          },
          { removeOnComplete: 100, removeOnFail: 500 }
        );
      } else {
        await processingQueue.add(
          "generate-post",
          {
            processedEmailId: stored.id,
            connectionId,
            userId,
            sourceType: fingerprint.source,
            extractedData: extracted,
            confidenceScore: confidence.score,
            requiresReview: isAllowlisted || confidence.score < 75,
            isAllowlisted,
            traceId,
          },
          { removeOnComplete: 100, removeOnFail: 500 }
        );
        processed += 1;
      }

      await sleep(100);
    } catch (error) {
      if (error instanceof GmailAuthRevokedError) {
        await db.email_connections.update({
          where: { id: emailConnection.id },
          data: { is_active: false },
        });
        console.warn(`[${traceId}] Gmail auth revoked during message processing; connection marked inactive`);
        return { skipped: true, reason: "auth_revoked" };
      }
      console.error(`[${traceId}] Error processing message ${msg.id}: ${String(error)}`);
    }
  }

  const newHistoryId = await getLatestHistoryId(gmail, emailConnection.id);
  await db.email_connections.update({
    where: { id: connectionId },
    data: {
      last_history_id: newHistoryId,
      last_poll_at: new Date(),
    },
  });

  console.log(`[${traceId}] Poll complete - processed: ${processed}, held: ${held}, skipped: ${skipped}`);
  return { processed, held, skipped };
}

function createPollWorker(): Worker<PollJobData> {
  return new Worker<PollJobData>(
    pollQueueName,
    async job => {
      const jobData: PollJobData = {
        connectionId: job.data.connectionId,
        userId: job.data.userId,
        userTimezone: job.data.userTimezone,
        traceId: job.data.traceId || randomUUID(),
      };
      return handlePollJob(jobData);
    },
    {
      connection,
      prefix: bullmqPrefix,
      concurrency: 3,
    }
  );
}

function wireFailureHandler(worker: Worker<PollJobData>): void {
  worker.on("failed", async (job, err) => {
    if (!job) {
      return;
    }
    if (job.attemptsMade >= 5) {
      await dlq.add(
        "poll-failure",
        {
          ...job.data,
          traceId: job.data.traceId || randomUUID(),
          error: err.message,
          failedAt: new Date().toISOString(),
        },
        { removeOnComplete: 100, removeOnFail: 500 }
      );
      console.error(`[DLQ] Job ${job.id} moved to DLQ after 5 attempts: ${err.message}`);
    }
  });
}

export async function schedulePollingForAllConnections(): Promise<void> {
  const connections = await db.email_connections.findMany({
    where: {
      is_active: true,
      provider: "gmail",
    },
    select: {
      id: true,
      user_id: true,
    },
  });

  for (const conn of connections) {
    const user = await db.users.findUnique({
      where: { id: conn.user_id },
      select: { timezone: true },
    });

    const timezone = user?.timezone ?? "UTC";
    const isActive = isActiveHours(timezone);
    const repeatEvery = isActive ? 60_000 : 300_000;

    await pollQueue.upsertJobScheduler(
      `poll-${conn.id}`,
      { every: repeatEvery },
      {
        name: "poll-gmail",
        data: {
          connectionId: conn.id,
          userId: conn.user_id,
          userTimezone: timezone,
          traceId: randomUUID(),
        },
      }
    );
  }
}

function isActiveHours(timezone: string): boolean {
  const now = new Date();
  const hour = Number.parseInt(
    new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      hour12: false,
    }).format(now),
    10
  );
  return hour >= 6 && hour < 23;
}

function parseGmailMessage(msg: gmail_v1.Schema$Message): RawEmail {
  const rawHeaders = msg.payload?.headers ?? [];
  const headers: Array<{ name: string; value: string }> = rawHeaders
    .filter(
      (h): h is { name: string; value: string } =>
        typeof h?.name === "string" && typeof h?.value === "string"
    )
    .map(h => ({ name: h.name, value: h.value }));
  const getHeader = (name: string): string => {
    const header = headers.find(item => item.name.toLowerCase() === name.toLowerCase());
    return header?.value ?? "";
  };

  return {
    messageId: msg.id ?? "",
    threadId: msg.threadId ?? "",
    from: getHeader("from"),
    subject: getHeader("subject"),
    bodyText: extractBody(msg.payload, "text/plain"),
    bodyHtml: extractBody(msg.payload, "text/html"),
    receivedAt: new Date(Number.parseInt(msg.internalDate ?? "0", 10)),
    headers: Object.fromEntries(headers.map(header => [header.name, header.value])),
  };
}

function extractBody(payload: gmail_v1.Schema$MessagePart | undefined, mimeType: string): string {
  if (!payload) {
    return "";
  }

  if (payload.mimeType === mimeType && payload.body?.data) {
    return Buffer.from(payload.body.data, "base64").toString("utf-8");
  }

  const parts = payload.parts ?? [];
  for (const part of parts) {
    const result = extractBody(part, mimeType);
    if (result) {
      return result;
    }
  }

  return "";
}

async function fetchRecentMessages(gmail: gmail_v1.Gmail, connectionId: string): Promise<Array<{ id?: string | null }>> {
  const res = await gmailCall(
    () =>
      gmail.users.messages.list({
        userId: "me",
        maxResults: 50,
        q: "newer_than:7d",
      }),
    connectionId
  );
  return res.data.messages ?? [];
}

async function getLatestHistoryId(gmail: gmail_v1.Gmail, connectionId: string): Promise<string> {
  const profile = await gmailCall(() => gmail.users.getProfile({ userId: "me" }), connectionId);
  return profile.data.historyId ?? "";
}

function extractName(from: string): string {
  const match = from.match(/^(.+?)\s*</);
  return match?.[1]?.trim().replace(/"/g, "") ?? "";
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

class GmailAuthRevokedError extends Error {
  constructor() {
    super("Gmail authentication revoked");
    this.name = "GmailAuthRevokedError";
  }
}

function isGmailNotFoundError(error: unknown): boolean {
  const code = (error as { code?: number }).code;
  const status = (error as { status?: number }).status;
  const responseStatus = (error as { response?: { status?: number } }).response?.status;
  return code === 404 || status === 404 || responseStatus === 404;
}

async function gmailCall<T>(fn: () => Promise<T>, connectionId: string): Promise<T> {
  let attempt = 0;
  const maxAttempts = 5;

  while (attempt < maxAttempts) {
    try {
      return await fn();
    } catch (error) {
      const responseStatus = (error as { response?: { status?: number } }).response?.status;
      const status = responseStatus ?? (error as { code?: number }).code;

      if (status === 401) {
        throw new GmailAuthRevokedError();
      }

      const isRetryable = status === 429 || (typeof status === "number" && status >= 500);
      attempt += 1;
      if (!isRetryable || attempt >= maxAttempts) {
        throw error;
      }

      const backoffMs = Math.min(30_000, 2 ** attempt * 500);
      console.warn(`[gmail-retry] connection=${connectionId} status=${status} attempt=${attempt} waitMs=${backoffMs}`);
      await sleep(backoffMs);
    }
  }

  throw new Error("Unreachable Gmail retry state");
}

function createDlqWorker(): Worker {
  const dlqWorker = new Worker(
    "email-poll-dlq",
    async job => {
      const traceId = (job.data as { traceId?: string }).traceId ?? `dlq-job-${job.id}`;
      const processedEmailId = (job.data as { processedEmailId?: string }).processedEmailId;

      if (processedEmailId) {
        await db.processed_emails.updateMany({
          where: { id: processedEmailId },
          data: { processing_status: "dlq" },
        });
        console.log(`[${traceId}] DLQ: marked processed_email ${processedEmailId} as dlq`);
      } else {
        console.warn(`[${traceId}] DLQ: poll-failure job — no processedEmailId to update`);
      }
    },
    { connection, prefix: bullmqPrefix, concurrency: 2 }
  );

  dlqWorker.on("failed", (job, err) => {
    const traceId = job ? ((job.data as { traceId?: string }).traceId ?? `dlq-job-${job.id}`) : "unknown";
    console.error(`[${traceId}] DLQ worker failed: ${err.message}`);
  });

  return dlqWorker;
}

export async function bootstrapWorker(): Promise<void> {
  const redis = new Redis(redisUrl);
  const pong = await redis.ping();
  console.log(`[startup] Redis PING: ${pong}`);
  await redis.quit();

  const tokenRefresh = setupTokenRefresh(redisUrl);
  await tokenRefresh.schedule();

  const debugUsers = await db.$queryRaw<Array<{ id: string }>>`SELECT id FROM users WHERE debug_parse_all_emails = true`;
  if (debugUsers.length > 0) {
    console.warn(
      `[WARNING] ${debugUsers.length} user(s) have debug parse mode active. Disable via PATCH /api/v1/debug/parse-mode or Settings -> Developer panel.`
    );
  }

  const worker = createPollWorker();
  wireFailureHandler(worker);
  const dlqWorker = createDlqWorker();
  await schedulePollingForAllConnections();
  console.log("Quilp polling scheduled for all connections");

  const shutdown = async () => {
    await worker.close();
    await dlqWorker.close();
    await pollQueue.close();
    await processingQueue.close();
    await dlq.close();
    await tokenRefresh.close();
    await db.$disconnect();
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
  void bootstrapWorker().catch(error => {
    console.error("Failed to bootstrap ingress worker", error);
    process.exit(1);
  });
}
