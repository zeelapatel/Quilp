import type { FastifyInstance } from "fastify";
import { db } from "../lib/db.js";
import { authenticate } from "../plugins/auth.js";
import { resolveUserIdBySub } from "../plugins/setUserContext.js";

type PatchDebugModeBody = {
  parseAll?: boolean;
  generatePosts?: boolean;
};

type ParsedEmailsQuery = {
  limit?: string;
};

function parseLimit(limit?: string): number {
  const parsed = Number.parseInt(limit ?? "10", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 10;
  }
  return Math.min(parsed, 50);
}

export async function debugRoutes(fastify: FastifyInstance) {
  fastify.get("/debug/parse-mode", { preHandler: [authenticate] }, async (request, reply) => {
    const auth0Sub = request.authUser?.sub;
    if (!auth0Sub) {
      return reply.code(401).send({ error: "Unauthorized" });
    }

    const userId = await resolveUserIdBySub(auth0Sub);
    if (!userId) {
      return reply.code(401).send({ error: "Unauthorized" });
    }

    const rows = await db.$queryRaw<
      Array<{ debug_parse_all_emails: boolean; debug_generate_posts: boolean }>
    >`SELECT debug_parse_all_emails, debug_generate_posts FROM users WHERE id = ${userId}::uuid LIMIT 1`;
    const user = rows[0] ?? null;

    return reply.send({
      data: {
        parseAll: user?.debug_parse_all_emails ?? false,
        generatePosts: user?.debug_generate_posts ?? false,
        nodeEnv: process.env.NODE_ENV,
        warning: user?.debug_parse_all_emails
          ? "ACTIVE - all emails being processed"
          : "inactive - normal fingerprint matching",
      },
    });
  });

  fastify.patch<{ Body: PatchDebugModeBody }>("/debug/parse-mode", { preHandler: [authenticate] }, async (request, reply) => {
    const auth0Sub = request.authUser?.sub;
    if (!auth0Sub) {
      return reply.code(401).send({ error: "Unauthorized" });
    }

    const userId = await resolveUserIdBySub(auth0Sub);
    if (!userId) {
      return reply.code(401).send({ error: "Unauthorized" });
    }

    const parseAll = request.body.parseAll === true;
    const generatePosts = request.body.generatePosts === true;
    const safeGeneratePosts = parseAll ? generatePosts : false;

    await db.$executeRaw`
      UPDATE users
      SET
        debug_parse_all_emails = ${parseAll},
        debug_generate_posts = ${safeGeneratePosts},
        updated_at = NOW()
      WHERE id = ${userId}::uuid
    `;

    console.warn(
      `[DEBUG MODE CHANGED] user: ${userId} | parseAll: ${parseAll} | generatePosts: ${safeGeneratePosts}`
    );

    return reply.send({
      data: {
        parseAll,
        generatePosts: safeGeneratePosts,
        message: parseAll ? "Debug mode ON - ALL emails will be parsed" : "Debug mode OFF - normal operation restored",
        warning:
          parseAll && safeGeneratePosts
            ? "LLM pipeline active - this will use Anthropic API credits on every email"
            : parseAll
              ? "Parse only - no LLM calls, no API cost"
              : null,
      },
    });
  });

  fastify.get<{ Querystring: ParsedEmailsQuery }>(
    "/debug/parsed-emails",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const auth0Sub = request.authUser?.sub;
      if (!auth0Sub) {
        return reply.code(401).send({ error: "Unauthorized" });
      }

      const userId = await resolveUserIdBySub(auth0Sub);
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized" });
      }

      const emails = await db.processed_emails.findMany({
        where: { user_id: userId },
        orderBy: { created_at: "desc" },
        take: parseLimit(request.query.limit),
        select: {
          id: true,
          message_id: true,
          sender_email: true,
          subject: true,
          source_type: true,
          confidence_score: true,
          processing_status: true,
          extracted_data: true,
          held_reason: true,
          created_at: true,
        },
      });

      return reply.send({
        data: emails.map(email => ({
          id: email.id,
          messageId: email.message_id,
          senderEmail: email.sender_email,
          subject: email.subject,
          sourceType: email.source_type,
          confidenceScore: email.confidence_score,
          processingStatus: email.processing_status,
          extractedData: email.extracted_data,
          heldReason: email.held_reason,
          createdAt: email.created_at,
        })),
      });
    }
  );
}
