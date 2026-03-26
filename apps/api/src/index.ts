import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import * as Sentry from "@sentry/node";
import { healthRoutes } from "./routes/health.js";
import { authPlugin, optionalAuthenticate } from "./plugins/auth.js";
import { usersRoutes } from "./routes/users.js";
import { gmailAuthRoutes } from "./routes/gmail-auth.js";
import { linkedinAuthRoutes } from "./routes/linkedin-auth.js";
import { postsRoutes } from "./routes/posts.js";
import { voiceProfileRoutes } from "./routes/voice-profiles.js";
import { debugRoutes } from "./routes/debug.js";
import { db } from "./lib/db.js";
import { redis } from "./lib/redis.js";
import { sendEmail } from "@quilp/shared";
import { approvalRoutes } from "./routes/approval.js";
import { senderAllowlistRoutes } from "./routes/sender-allowlist.js";

const requiredEnvs = [
  "DATABASE_APP_URL",
  "REDIS_URL",
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "ENCRYPTION_KEY",
  "TOKEN_ENCRYPTION_KEY"
];
for (const env of requiredEnvs) {
  if (!process.env[env]) {
    console.error(`Missing required environment variable: ${env}`);
    process.exit(1);
  }
}

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 1.0
  });
  process.on("unhandledRejection", reason => {
    Sentry.captureException(reason);
    console.error(reason);
  });
  process.on("uncaughtException", error => {
    Sentry.captureException(error);
    console.error(error);
  });
}

const server = Fastify({ logger: true });

await server.register(cors);
await server.register(helmet);
await server.register(authPlugin);
server.addHook("onRequest", optionalAuthenticate);
await server.register(rateLimit, {
  global: true,
  max: request => (request.authUser ? 100 : 10),
  timeWindow: "1 minute",
  keyGenerator: request => request.authUser?.sub ?? request.ip,
  skipOnError: false,
  errorResponseBuilder: (_request, context) => ({
    error: "Rate limit exceeded",
    retryAfter: context.after
  })
});

server.setErrorHandler((error, request, reply) => {
  Sentry.captureException(error, {
    tags: { path: request.url, method: request.method }
  });
  if (process.env.NODE_ENV === "development") {
    console.error(error);
  }
  if (reply.sent) {
    return;
  }
  const statusCode =
    typeof error === "object" && error !== null && "statusCode" in error
      ? Number((error as { statusCode?: number }).statusCode) || 500
      : 500;
  reply.status(statusCode).send({ error: "Internal Server Error" });
});

await server.register(healthRoutes);
await server.register(usersRoutes);
await server.register(gmailAuthRoutes);
await server.register(linkedinAuthRoutes);
await server.register(postsRoutes);
await server.register(approvalRoutes);
await server.register(voiceProfileRoutes);
await server.register(senderAllowlistRoutes);

if (process.env.NODE_ENV === "development") {
  await server.register(debugRoutes, { prefix: "/api/v1" });
  server.get("/api/v1/debug/sentry-test", async () => {
    throw new Error("Quilp Sentry test - ignore");
  });
}

const start = async () => {
  try {
    await db.$queryRawUnsafe("SELECT 1");
    server.log.info("DB connection successful (SELECT 1)");

    const pingResult = await redis.ping();
    server.log.info(`Redis PING returned: ${pingResult}`);

    if (process.env.NODE_ENV === "development" && process.env.MAILTRAP_USER && process.env.MAILTRAP_PASS) {
      try {
        await sendEmail(
          "dev@quilp.local",
          "Quilp mailer connected",
          "<p>Nodemailer + Mailtrap working. Sprint S2 complete.</p>"
        );
        server.log.info("Dev Mailtrap test email sent");
      } catch (err) {
        // Mailtrap free-tier limits should not block local API startup.
        server.log.warn({ err }, "Skipping dev Mailtrap test email");
      }
    }

    const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
    await server.listen({ port, host: "0.0.0.0" });

    process.on("SIGTERM", async () => {
      server.log.info("SIGTERM signal received: closing HTTP server");
      await server.close();
      await db.$disconnect();
      redis.disconnect();
      process.exit(0);
    });
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

void start();
