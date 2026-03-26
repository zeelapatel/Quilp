import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { createHash, randomBytes, randomUUID } from "crypto";
import axios from "axios";
import { pollQueue, schedulePollingForAllConnections } from "@quilp/ingress/worker";
import { encryptToken } from "@quilp/shared";
import { db } from "../lib/db.js";
import { redis } from "../lib/redis.js";
import { authenticate } from "../plugins/auth.js";
import { resolveUserIdBySub, setUserContext } from "../plugins/setUserContext.js";

type GoogleTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
};

type GmailProfileResponse = {
  emailAddress?: string;
  messagesTotal?: number;
  threadsTotal?: number;
  historyId?: string;
};

function isConfigured(value: string | undefined): value is string {
  const trimmed = value?.trim();
  if (!trimmed) {
    return false;
  }
  return !trimmed.startsWith("REPLACE_ME");
}

function toBase64UrlSha256(input: string): string {
  return createHash("sha256").update(input).digest("base64url");
}

const GMAIL_CALLBACK_PATHS = [
  "/api/v1/email-connections/gmail/callback",
  "/auth/gmail/callback",
  "/callback"
] as const;

function buildOnboardingRedirectUrl(): string {
  const webAppUrl = process.env.WEB_APP_URL?.trim() || "http://localhost:5173";
  return new URL("/onboarding?connected=gmail", webAppUrl).toString();
}

export async function gmailAuthRoutes(fastify: FastifyInstance) {
  fastify.post(
    "/api/v1/email-connections/gmail/auth",
    {
      preHandler: [authenticate, setUserContext],
      config: {
        rateLimit: {
          max: 5,
          timeWindow: "1 minute"
        }
      }
    },
    async (request, reply) => {
      const auth0Sub = request.authUser?.sub;
      if (!auth0Sub) {
        return reply.code(401).send({ error: "Unauthorized" });
      }
      const userId = await resolveUserIdBySub(auth0Sub);
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized" });
      }

      const clientId = process.env.GMAIL_CLIENT_ID;
      const redirectUri = process.env.GMAIL_REDIRECT_URI;
      if (!isConfigured(clientId) || !isConfigured(redirectUri)) {
        return reply.code(503).send({
          error: "Gmail OAuth is not configured"
        });
      }

      const codeVerifier = randomBytes(32).toString("base64url");
      const codeChallenge = toBase64UrlSha256(codeVerifier);
      const state = randomUUID();

      await redis.set(
        `quilp:oauth:state:${state}`,
        JSON.stringify({ userId, codeVerifier }),
        "EX",
        10 * 60
      );

      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: "https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.labels",
        response_type: "code",
        access_type: "offline",
        prompt: "select_account consent",
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
        state
      });

      return { authUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` };
    }
  );

  const callbackHandler = async (request: FastifyRequest, reply: FastifyReply) => {
    const state = (request.query as Record<string, string | undefined>).state;
    const code = (request.query as Record<string, string | undefined>).code;
    if (!state || !code) {
      return reply.code(400).send({ error: "Invalid OAuth callback" });
    }

    const stateKey = `quilp:oauth:state:${state}`;
    const cachedState = await redis.get(stateKey);
    if (!cachedState) {
      return reply.code(400).send({ error: "Invalid state" });
    }
    await redis.del(stateKey);

    const parsedState = JSON.parse(cachedState) as { userId?: string; codeVerifier?: string };
    if (!parsedState.userId || !parsedState.codeVerifier) {
      return reply.code(400).send({ error: "Invalid state payload" });
    }

    const clientId = process.env.GMAIL_CLIENT_ID;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET;
    const redirectUri = process.env.GMAIL_REDIRECT_URI;
    const tokenKey = process.env.TOKEN_ENCRYPTION_KEY;
    if (!isConfigured(clientId) || !isConfigured(clientSecret) || !isConfigured(redirectUri) || !isConfigured(tokenKey)) {
      throw new Error(
        "GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REDIRECT_URI, TOKEN_ENCRYPTION_KEY are required"
      );
    }

    const tokenResponse = await axios.post<GoogleTokenResponse>(
      "https://oauth2.googleapis.com/token",
      new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
        code_verifier: parsedState.codeVerifier
      }).toString(),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" }
      }
    );

    const accessTokenEnc = encryptToken(tokenResponse.data.access_token, tokenKey);
    const expiresAt = new Date(Date.now() + tokenResponse.data.expires_in * 1000);

    const gmailProfileResponse = await axios.get<GmailProfileResponse>(
      "https://gmail.googleapis.com/gmail/v1/users/me/profile",
      {
      headers: {
        Authorization: `Bearer ${tokenResponse.data.access_token}`
      }
      }
    );
    const connectedEmail = gmailProfileResponse.data.emailAddress?.trim().toLowerCase();
    const connectedName = null;
    if (!connectedEmail) {
      return reply.code(502).send({ error: "Failed to resolve connected Gmail account" });
    }

    const existingConnection = await db.email_connections.findFirst({
      where: {
        user_id: parsedState.userId,
        provider: "gmail"
      },
      select: {
        id: true,
        refresh_token_enc: true
      },
      orderBy: { created_at: "desc" }
    });

    const refreshTokenEnc = tokenResponse.data.refresh_token
      ? encryptToken(tokenResponse.data.refresh_token, tokenKey)
      : existingConnection?.refresh_token_enc ?? "";

    const newConnection = existingConnection
      ? await db.email_connections.update({
          where: { id: existingConnection.id },
          data: {
            account_email: connectedEmail,
            account_name: connectedName,
            access_token_enc: accessTokenEnc,
            refresh_token_enc: refreshTokenEnc,
            token_expires_at: expiresAt,
            last_history_id: null,
            is_active: true
          }
        })
      : await db.email_connections.create({
          data: {
            user_id: parsedState.userId,
            provider: "gmail",
            account_email: connectedEmail,
            account_name: connectedName,
            access_token_enc: accessTokenEnc,
            refresh_token_enc: refreshTokenEnc,
            token_expires_at: expiresAt,
            last_history_id: null,
            is_active: true
          }
        });

    const user = await db.users.findUnique({
      where: { id: parsedState.userId },
      select: { timezone: true }
    });
    const userTimezone = user?.timezone ?? "UTC";

    try {
      await pollQueue.add("poll-gmail", {
        connectionId: newConnection.id,
        userId: parsedState.userId,
        userTimezone,
        traceId: randomUUID()
      });
      await schedulePollingForAllConnections();
    } catch (err) {
      console.error("Failed to enqueue initial Gmail poll after OAuth callback:", err);
    }

    return reply.redirect(buildOnboardingRedirectUrl());
  };

  for (const callbackPath of GMAIL_CALLBACK_PATHS) {
    fastify.get(callbackPath, callbackHandler);
  }

  fastify.get(
    "/api/v1/email-connections",
    { preHandler: [authenticate, setUserContext] },
    async (request, reply) => {
      const auth0Sub = request.authUser?.sub;
      if (!auth0Sub) {
        return reply.code(401).send({ error: "Unauthorized" });
      }
      const userId = await resolveUserIdBySub(auth0Sub);
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized" });
      }
      return db.email_connections.findMany({
        where: { user_id: userId },
        select: {
          id: true,
          provider: true,
          account_email: true,
          account_name: true,
          is_active: true,
          last_poll_at: true,
          created_at: true
        },
        orderBy: { created_at: "desc" }
      });
    }
  );

  fastify.delete(
    "/api/v1/email-connections/:id",
    { preHandler: [authenticate, setUserContext] },
    async (request, reply) => {
      const auth0Sub = request.authUser?.sub;
      if (!auth0Sub) {
        return reply.code(401).send({ error: "Unauthorized" });
      }
      const userId = await resolveUserIdBySub(auth0Sub);
      if (!userId) {
        return reply.code(401).send({ error: "Unauthorized" });
      }

      const id = (request.params as Record<string, string | undefined>).id;
      if (!id) {
        return reply.code(400).send({ error: "Connection ID is required" });
      }

      const existing = await db.email_connections.findFirst({
        where: { id, user_id: userId },
        select: { id: true }
      });
      if (!existing) {
        return reply.code(404).send({ error: "Connection not found" });
      }

      await db.email_connections.update({
        where: { id },
        data: {
          is_active: false,
          access_token_enc: "",
          refresh_token_enc: ""
        }
      });

      return reply.code(204).send();
    }
  );
}
