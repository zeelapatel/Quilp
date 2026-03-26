import { FastifyInstance } from "fastify";

export async function healthRoutes(fastify: FastifyInstance) {
  fastify.get("/health", async (_request, _reply) => {
    // Scaffold pattern for user_id scoping:
    // const userId = request.user?.id; // from JWT
    // All DB queries must include user_id scoped from JWT - never from request body.
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    };
  });
}
