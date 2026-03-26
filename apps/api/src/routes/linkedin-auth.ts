import type { FastifyInstance } from "fastify";
import axios from "axios";
import { createHash, randomUUID } from "node:crypto";
import { encryptToken } from "@quilp/shared";
import { authenticate } from "../plugins/auth.js";
import { resolveUserIdBySub, setUserContext } from "../plugins/setUserContext.js";
import { redis } from "../lib/redis.js";
import { db } from "../lib/db.js";

function buildOnboardingRedirectUrl(): string {
  const webAppUrl = process.env.WEB_APP_URL?.trim() || "http://localhost:5173";
  return new URL("/onboarding?connected=linkedin", webAppUrl).toString();
}

function getLinkedInScopes(): string {
  return "openid profile email w_member_social";
}

function maskClientId(value: string): string {
  if (value.length <= 4) {
    return `${"*".repeat(value.length)} (${value.length})`;
  }
  return `${value.slice(0, 4)}*** (${value.length})`;
}

export async function linkedinAuthRoutes(fastify: FastifyInstance) {
  fastify.post(
    "/api/v1/social-connections/linkedin/auth",
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

      const clientId = process.env.LINKEDIN_CLIENT_ID;
      const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
      const redirectUri = process.env.LINKEDIN_REDIRECT_URI;
      if (!clientId || !clientSecret || !redirectUri) {
        return reply.code(503).send({ error: "LinkedIn OAuth is not configured" });
      }

      const state = randomUUID();

      await redis.set(
        `quilp:oauth:linkedin:state:${state}`,
        JSON.stringify({ userId }),
        "EX",
        10 * 60
      );

      const scopes = getLinkedInScopes();
      const params = new URLSearchParams({
        response_type: "code",
        client_id: clientId,
        redirect_uri: redirectUri,
        scope: scopes,
        state
      });

      return { authUrl: `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}` };
    }
  );

  fastify.get(
    "/api/v1/social-connections/linkedin/callback",
    async (request, reply) => {
      const query = request.query as Record<string, string | undefined>;
      const state = query.state;
      const code = query.code;
      if (!state || !code) {
        return reply.code(400).send({ error: "Invalid OAuth callback" });
      }

      const stateKey = `quilp:oauth:linkedin:state:${state}`;
      const cachedState = await redis.get(stateKey);
      if (!cachedState) {
        return reply.code(400).send({ error: "Invalid state" });
      }
      await redis.del(stateKey);

      let parsed: { userId?: string };
      try {
        parsed = JSON.parse(cachedState) as { userId?: string };
      } catch {
        return reply.code(400).send({ error: "Invalid state payload" });
      }
      if (!parsed.userId) {
        return reply.code(400).send({ error: "Invalid state payload" });
      }

      const clientId = process.env.LINKEDIN_CLIENT_ID;
      const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
      const redirectUri = process.env.LINKEDIN_REDIRECT_URI;
      const tokenKey = process.env.TOKEN_ENCRYPTION_KEY;
      if (!clientId || !clientSecret || !redirectUri || !tokenKey) {
        return reply.code(500).send({ error: "LinkedIn OAuth is not configured" });
      }

      fastify.log.info(
        {
          oauthDebug: {
            clientId: maskClientId(clientId),
            clientSecretSet: Boolean(clientSecret),
            clientSecretLength: clientSecret.length,
            redirectUri
          }
        },
        "LinkedIn OAuth callback config check"
      );

      const tokenResponse = await axios.post(
        "https://www.linkedin.com/oauth/v2/accessToken",
        new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
          client_id: clientId,
          client_secret: clientSecret
        }),
        { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
      );

      const accessToken = tokenResponse.data.access_token as string | undefined;
      const refreshToken = tokenResponse.data.refresh_token as string | undefined;
      const expiresIn = tokenResponse.data.expires_in as number | undefined;
      if (!accessToken) {
        return reply.code(502).send({ error: "Failed to get LinkedIn access token" });
      }

      const expiresAt = typeof expiresIn === "number"
        ? new Date(Date.now() + expiresIn * 1000)
        : null;

      const accessTokenEnc = encryptToken(accessToken, tokenKey);
      const refreshTokenEnc = refreshToken
        ? encryptToken(refreshToken, tokenKey)
        : null;

      const profile = await axios.get("https://api.linkedin.com/v2/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      const accountIdRaw = profile.data?.sub as string | undefined;
      const accountName = profile.data?.name as string | undefined;
      const accountEmail = profile.data?.email as string | undefined;

      if (!accountIdRaw || !accountEmail || !accountName) {
        return reply.code(502).send({ error: "Failed to resolve LinkedIn profile" });
      }

      // Keep: account_email must be from LinkedIn userinfo — never request.user.email.
      let accountId = accountIdRaw.trim();
      if (!accountId.startsWith("urn:li:")) {
        accountId = `urn:li:person:${accountId}`;
      }

      const existing = await db.social_connections.findFirst({
        where: {
          user_id: parsed.userId,
          platform: "linkedin_personal",
          account_type: "personal"
        },
        select: { id: true, refresh_token_enc: true, access_token_enc: true }
      });

      const scopeHash = createHash("sha256")
        .update(getLinkedInScopes())
        .digest("hex");

      if (existing) {
        await db.social_connections.update({
          where: { id: existing.id },
          data: {
            is_active: true,
            access_token_enc: accessTokenEnc,
            refresh_token_enc: refreshToken ? refreshTokenEnc : existing.refresh_token_enc,
            token_expires_at: expiresAt,
            account_id: accountId,
            account_email: accountEmail.trim().toLowerCase(),
            account_name: accountName,
            scope_hash: scopeHash
          }
        });
      } else {
        await db.social_connections.create({
          data: {
            user_id: parsed.userId,
            platform: "linkedin_personal",
            account_id: accountId,
            account_email: accountEmail.trim().toLowerCase(),
            account_name: accountName,
            account_type: "personal",
            access_token_enc: accessTokenEnc,
            refresh_token_enc: refreshToken ? refreshTokenEnc : null,
            token_expires_at: expiresAt,
            scope_hash: scopeHash,
            is_active: true
          }
        });
      }
      return reply.redirect(buildOnboardingRedirectUrl());
    }
  );

  fastify.get(
    "/api/v1/social-connections",
    { preHandler: [authenticate, setUserContext] },
    async (request, reply) => {
      const auth0Sub = request.authUser?.sub;
      if (!auth0Sub) return reply.code(401).send({ error: "Unauthorized" });

      const userId = await resolveUserIdBySub(auth0Sub);
      if (!userId) return reply.code(401).send({ error: "Unauthorized" });

      const connections = await db.social_connections.findMany({
        where: { user_id: userId },
        select: {
          id: true,
          platform: true,
          account_email: true,
          account_name: true,
          account_type: true,
          is_active: true,
          created_at: true
        },
        orderBy: { created_at: "desc" }
      });

      return connections;
    }
  );

  fastify.delete(
    "/api/v1/social-connections/:id",
    { preHandler: [authenticate, setUserContext] },
    async (request, reply) => {
      const auth0Sub = request.authUser?.sub;
      if (!auth0Sub) return reply.code(401).send({ error: "Unauthorized" });

      const userId = await resolveUserIdBySub(auth0Sub);
      if (!userId) return reply.code(401).send({ error: "Unauthorized" });

      const id = (request.params as Record<string, string | undefined>).id;
      if (!id) return reply.code(400).send({ error: "Connection ID is required" });

      const existing = await db.social_connections.findFirst({
        where: { id, user_id: userId }
      });

      if (!existing) return reply.code(404).send({ error: "Connection not found" });

      await db.social_connections.update({
        where: { id },
        data: {
          is_active: false,
          access_token_enc: "",
          refresh_token_enc: "",
          token_expires_at: null
        }
      });

      return reply.code(204).send();
    }
  );
}

