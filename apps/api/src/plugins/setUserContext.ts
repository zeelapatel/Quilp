import type { FastifyReply, FastifyRequest } from "fastify";
import { db } from "../lib/db.js";

export async function resolveUserIdBySub(auth0Sub: string): Promise<string | null> {
  const user = await db.users.findUnique({
    where: { auth0_sub: auth0Sub },
    select: { id: true }
  });
  return user?.id ?? null;
}

export async function setUserContext(request: FastifyRequest, reply: FastifyReply) {
  const auth0Sub = request.authUser?.sub;
  if (!auth0Sub) {
    return reply.code(401).send({ error: "Unauthorized" });
  }

  const userId = await resolveUserIdBySub(auth0Sub);
  if (!userId) {
    return reply.code(401).send({ error: "Unauthorized" });
  }

  try {
    await db.$executeRaw`SELECT set_config('app.user_id', ${userId}, true)`;
  } catch (err) {
    console.error("Failed to set RLS user context:", err);
    return reply.code(500).send({ error: "Failed to set user context" });
  }
}
