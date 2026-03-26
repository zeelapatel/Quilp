import type { FastifyInstance } from "fastify";
import { authenticate } from "../plugins/auth.js";
import { db } from "../lib/db.js";
import { resolveUserIdBySub, setUserContext } from "../plugins/setUserContext.js";
import type { Prisma } from "@prisma/client";

type RegisterBody = {
  timezone?: string;
};

function getDataRegion(headers: Record<string, string | string[] | undefined>): "us" | "eu" {
  const value = headers["x-data-region"] ?? headers["x-region"];
  const region = Array.isArray(value) ? value[0] : value;
  return region === "eu" ? "eu" : "us";
}

export async function usersRoutes(fastify: FastifyInstance) {
  fastify.post<{ Body: RegisterBody }>("/api/v1/auth/register", { preHandler: [authenticate] }, async (request, reply) => {
    const auth0Sub = request.authUser?.sub;
    const email = request.authUser?.email;
    if (!auth0Sub || !email) {
      return reply.code(401).send({ error: "Unauthorized" });
    }

    const existing = await db.users.findUnique({
      where: { auth0_sub: auth0Sub },
      select: {
        id: true,
        plan: true,
        timezone: true,
        data_region: true,
        created_at: true
      }
    });
    if (existing) {
      return existing;
    }

    const encryptionKey = process.env.ENCRYPTION_KEY;
    if (!encryptionKey) {
      throw new Error("ENCRYPTION_KEY is required");
    }

    const timezone = request.body?.timezone?.trim() || "UTC";
    const dataRegion = getDataRegion(request.headers);

    const inserted = await db.$queryRaw<
      Array<{
        id: string;
        plan: string;
        timezone: string;
        data_region: string;
        created_at: Date;
      }>
    >`
      INSERT INTO users (auth0_sub, email, plan, timezone, data_region, updated_at)
      VALUES (
        ${auth0Sub},
        pgp_sym_encrypt(${email}, ${encryptionKey}),
        'starter'::"Plan",
        ${timezone},
        ${dataRegion}::"Region",
        NOW()
      )
      RETURNING id, plan, timezone, data_region, created_at
    `;

    return reply.code(201).send(inserted[0]);
  });

  fastify.get("/api/v1/users/me", { preHandler: [authenticate] }, async (request, reply) => {
    const auth0Sub = request.authUser?.sub;
    if (!auth0Sub) {
      return reply.code(401).send({ error: "Unauthorized" });
    }

    const user = await db.users.findUnique({
      where: { auth0_sub: auth0Sub },
      select: {
        id: true,
        plan: true,
        timezone: true,
        data_region: true,
        created_at: true,
        updated_at: true
      }
    });
    if (!user) {
      return reply.code(404).send({ error: "User not found" });
    }
    return user;
  });

  fastify.get(
    "/api/v1/users/me/settings",
    { preHandler: [authenticate, setUserContext] },
    async (request, reply) => {
      const auth0Sub = request.authUser?.sub;
      if (!auth0Sub) return reply.code(401).send({ error: "Unauthorized" });

      const userId = await resolveUserIdBySub(auth0Sub);
      if (!userId) return reply.code(401).send({ error: "Unauthorized" });

      const user = await db.users.findUnique({
        where: { id: userId },
        select: {
          approval_mode: true,
          approval_timeout_hrs: true,
          timeout_action: true,
          max_posts_per_day: true,
          blackout_start: true,
          blackout_end: true,
          timezone: true
        }
      });

      if (!user) return reply.code(404).send({ error: "User not found" });

      return reply.send({
        approvalMode: user.approval_mode,
        approvalTimeoutHrs: user.approval_timeout_hrs,
        timeoutAction: user.timeout_action,
        maxPostsPerDay: user.max_posts_per_day,
        blackoutStart: user.blackout_start,
        blackoutEnd: user.blackout_end,
        timezone: user.timezone
      });
    }
  );

  fastify.patch(
    "/api/v1/users/me/settings",
    { preHandler: [authenticate, setUserContext] },
    async (request, reply) => {
      const auth0Sub = request.authUser?.sub;
      if (!auth0Sub) return reply.code(401).send({ error: "Unauthorized" });

      const userId = await resolveUserIdBySub(auth0Sub);
      if (!userId) return reply.code(401).send({ error: "Unauthorized" });

      const body = request.body as Partial<{
        approvalMode: "require_approval" | "auto_post";
        approvalTimeoutHrs: number;
        timeoutAction: "auto_post" | "discard";
        maxPostsPerDay: number;
        blackoutStart: string;
        blackoutEnd: string;
        timezone: string;
      }>;

      const allowedApprovalModes = ["require_approval", "auto_post"];
      const allowedTimeoutActions = ["auto_post", "discard"];

      const blackoutValid = (value: string): boolean => {
        if (!/^\d{2}:\d{2}$/.test(value)) return false;
        const parts = value.split(":").map(Number);
        const h = parts[0];
        const m = parts[1];
        if (h === undefined || m === undefined) return false;
        return h >= 0 && h <= 23 && m >= 0 && m <= 59;
      };

      const timezoneValid = (value: string): boolean => {
        try {
          // If the timezone is invalid, Intl.DateTimeFormat throws.
          new Intl.DateTimeFormat("en-US", { timeZone: value }).format(
            new Date()
          );
          return true;
        } catch {
          return false;
        }
      };

      const updates: Record<string, unknown> = {};

      if (body.approvalMode !== undefined) {
        if (!allowedApprovalModes.includes(body.approvalMode)) {
          return reply.code(400).send({ error: "Invalid approvalMode" });
        }
        updates.approval_mode = body.approvalMode;
      }

      if (body.approvalTimeoutHrs !== undefined) {
        const v = Number(body.approvalTimeoutHrs);
        if (!Number.isInteger(v) || v < 1 || v > 24) {
          return reply
            .code(400)
            .send({ error: "approvalTimeoutHrs must be between 1 and 24" });
        }
        updates.approval_timeout_hrs = v;
      }

      if (body.timeoutAction !== undefined) {
        if (!allowedTimeoutActions.includes(body.timeoutAction)) {
          return reply.code(400).send({ error: "Invalid timeoutAction" });
        }
        updates.timeout_action = body.timeoutAction;
      }

      if (body.maxPostsPerDay !== undefined) {
        const v = Number(body.maxPostsPerDay);
        if (!Number.isInteger(v) || v < 1 || v > 10) {
          return reply.code(400).send({ error: "maxPostsPerDay must be between 1 and 10" });
        }
        updates.max_posts_per_day = v;
      }

      if (body.blackoutStart !== undefined) {
        if (body.blackoutStart !== null && body.blackoutStart !== "" && !blackoutValid(body.blackoutStart)) {
          return reply
            .code(400)
            .send({ error: "blackoutStart must be in HH:MM format" });
        }
        updates.blackout_start = body.blackoutStart || null;
      }

      if (body.blackoutEnd !== undefined) {
        if (body.blackoutEnd !== null && body.blackoutEnd !== "" && !blackoutValid(body.blackoutEnd)) {
          return reply
            .code(400)
            .send({ error: "blackoutEnd must be in HH:MM format" });
        }
        updates.blackout_end = body.blackoutEnd || null;
      }

      if (body.timezone !== undefined) {
        if (!timezoneValid(body.timezone)) {
          return reply.code(400).send({ error: "Invalid timezone" });
        }
        updates.timezone = body.timezone;
      }

      if (Object.keys(updates).length === 0) {
        return reply.code(400).send({ error: "No valid settings provided" });
      }

      const updated = await db.users.update({
        where: { id: userId },
        data: updates as Prisma.usersUpdateInput,
        select: {
          approval_mode: true,
          approval_timeout_hrs: true,
          timeout_action: true,
          max_posts_per_day: true,
          blackout_start: true,
          blackout_end: true,
          timezone: true
        }
      });

      return reply.send({
        approvalMode: updated.approval_mode,
        approvalTimeoutHrs: updated.approval_timeout_hrs,
        timeoutAction: updated.timeout_action,
        maxPostsPerDay: updated.max_posts_per_day,
        blackoutStart: updated.blackout_start,
        blackoutEnd: updated.blackout_end,
        timezone: updated.timezone
      });
    }
  );
}
