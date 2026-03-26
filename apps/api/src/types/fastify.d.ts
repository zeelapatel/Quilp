import type { JwtUser } from "./auth.js";

declare module "fastify" {
  interface FastifyRequest {
    authUser?: JwtUser;
  }
}
