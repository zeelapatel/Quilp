import type { FastifyInstance } from "fastify";
import { db } from "../lib/db.js";
import { authenticate } from "../plugins/auth.js";
import { resolveUserIdBySub, setUserContext } from "../plugins/setUserContext.js";

export async function senderAllowlistRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/api/v1/sender-allowlist",
    { preHandler: [authenticate, setUserContext] },
    async (request, reply) => {
      const auth0Sub = request.authUser?.sub;
      if (!auth0Sub) return reply.code(401).send({ error: "Unauthorized" });

      const userId = await resolveUserIdBySub(auth0Sub);
      if (!userId) return reply.code(401).send({ error: "Unauthorized" });

      const entries = await db.sender_allowlist.findMany({
        where: { user_id: userId },
        orderBy: { created_at: "desc" },
        select: { id: true, email: true, label: true, created_at: true },
      });

      return entries;
    }
  );

  fastify.post<{ Body: { email: string; label?: string } }>(
    "/api/v1/sender-allowlist",
    { preHandler: [authenticate, setUserContext] },
    async (request, reply) => {
      const auth0Sub = request.authUser?.sub;
      if (!auth0Sub) return reply.code(401).send({ error: "Unauthorized" });

      const userId = await resolveUserIdBySub(auth0Sub);
      if (!userId) return reply.code(401).send({ error: "Unauthorized" });

      const email = request.body?.email?.trim().toLowerCase();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return reply.code(400).send({ error: "Invalid email address" });
      }

      const label = request.body?.label?.trim() || null;

      const existing = await db.sender_allowlist.count({
        where: { user_id: userId },
      });
      if (existing >= 50) {
        return reply.code(400).send({ error: "Allowlist limit of 50 reached" });
      }

      const entry = await db.sender_allowlist.upsert({
        where: { user_id_email: { user_id: userId, email } },
        create: { user_id: userId, email, label },
        update: { label },
        select: { id: true, email: true, label: true, created_at: true },
      });

      return reply.code(201).send(entry);
    }
  );

  fastify.delete(
    "/api/v1/sender-allowlist/:id",
    { preHandler: [authenticate, setUserContext] },
    async (request, reply) => {
      const auth0Sub = request.authUser?.sub;
      if (!auth0Sub) return reply.code(401).send({ error: "Unauthorized" });

      const userId = await resolveUserIdBySub(auth0Sub);
      if (!userId) return reply.code(401).send({ error: "Unauthorized" });

      const id = (request.params as { id?: string }).id;
      if (!id) return reply.code(400).send({ error: "ID is required" });

      const existing = await db.sender_allowlist.findFirst({
        where: { id, user_id: userId },
      });
      if (!existing) return reply.code(404).send({ error: "Entry not found" });

      await db.sender_allowlist.delete({ where: { id } });
      return reply.code(204).send();
    }
  );
}
