import type { FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import type { JwtUser } from "../types/auth.js";

type SupabaseUser = {
  id?: unknown;
  email?: unknown;
  user_metadata?: unknown;
  app_metadata?: unknown;
};

let supabaseUserEndpoint = "";
let supabaseApiKey = "";

export const authPlugin = fp(async () => {
  const supabaseUrl = process.env.SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error("SUPABASE_URL is required");
  }
  const apiKey = process.env.SUPABASE_ANON_KEY;
  if (!apiKey) {
    throw new Error("SUPABASE_ANON_KEY is required");
  }
  supabaseUserEndpoint = `${supabaseUrl.replace(/\/+$/, "")}/auth/v1/user`;
  supabaseApiKey = apiKey;
});

function unauthorized(reply: FastifyReply) {
  return reply.code(401).send({ error: "Unauthorized" });
}

function getPlanFromMetadata(user: SupabaseUser): string | undefined {
  const metadataSources = [user.user_metadata, user.app_metadata];
  for (const source of metadataSources) {
    if (!source || typeof source !== "object") {
      continue;
    }
    const metadata = source as Record<string, unknown>;
    if (typeof metadata.plan === "string") {
      return metadata.plan;
    }
  }
  return undefined;
}

function normalizeUser(user: SupabaseUser | null): JwtUser | null {
  if (!user || typeof user !== "object") {
    return null;
  }
  if (typeof user.id !== "string") {
    return null;
  }
  const normalizedUser: JwtUser = { sub: user.id };
  if (typeof user.email === "string") {
    normalizedUser.email = user.email;
  }
  const plan = getPlanFromMetadata(user);
  if (plan) {
    normalizedUser.plan = plan;
  }
  return normalizedUser;
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    const user = await introspectUserFromRequest(request);
    if (!user) {
      return unauthorized(reply);
    }
    request.authUser = user;
  } catch (err) {
    request.log.warn({ err }, "JWT verification failed");
    return unauthorized(reply);
  }
}

export async function optionalAuthenticate(request: FastifyRequest, _reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
    return;
  }
  try {
    request.authUser = (await introspectUserFromRequest(request)) ?? undefined;
  } catch {
    request.authUser = undefined;
  }
}

async function introspectUserFromRequest(request: FastifyRequest): Promise<JwtUser | null> {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
    throw new Error("Missing bearer token");
  }
  const token = authHeader.slice("Bearer ".length);
  const response = await fetch(supabaseUserEndpoint, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: supabaseApiKey
    }
  });
  if (!response.ok) {
    throw new Error(`Supabase introspection failed with status ${response.status}`);
  }
  const user = (await response.json()) as SupabaseUser;
  return normalizeUser(user);
}
