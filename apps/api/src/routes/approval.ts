import type { FastifyInstance } from "fastify";
import { db } from "../lib/db.js";
import { schedulePostJob, FrequencyCapReachedError } from "@quilp/publish/schedule";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function htmlPage(title: string, body: string) {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      body { font-family: -apple-system, sans-serif; background:#0A0A0A; color:#F0F0F0; margin:0; padding:0; }
      .container { max-width:600px; margin:40px auto; padding:0 20px; }
      h1 { font-size:18px; margin:0 0 12px; }
      .card { background:#111; border:1px solid #222; border-radius:8px; padding:16px; }
      a { color:#E8F94A; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="card">
        <h1>${esc(title)}</h1>
        <div>${body}</div>
      </div>
    </div>
  </body>
</html>`;
}

export async function approvalRoutes(fastify: FastifyInstance) {
  fastify.get("/api/v1/approval/:token/approve", async (request, reply) => {
    const token = (request.params as { token?: string }).token;
    if (!token) {
      return reply.code(400).type("text/html").send(
        htmlPage("Invalid link", "This link is invalid or expired.")
      );
    }

    const requestRow = await db.approval_requests.findUnique({
      where: { token },
      select: {
        id: true,
        post_id: true,
        responded_at: true,
        response: true,
        timeout_at: true
      }
    });

    if (!requestRow || requestRow.timeout_at <= new Date()) {
      return reply
        .code(200)
        .type("text/html")
        .send(htmlPage("Approval expired", "This link is invalid or expired."));
    }

    if (requestRow.response !== null) {
      return reply
        .code(200)
        .type("text/html")
        .send(htmlPage("Already responded", "You have already responded to this request."));
    }

    const post = await db.posts.findUnique({
      where: { id: requestRow.post_id },
      select: { id: true, user_id: true, status: true }
    });

    if (!post || post.status !== "queued") {
      return reply
        .code(200)
        .type("text/html")
        .send(
          htmlPage(
            "Approval request expired",
            "This approval request has expired."
          )
        );
    }

    // One-time token consumption — wrap both writes in a transaction to prevent double-approval.
    const updated = await db.$transaction(async tx => {
      const result = await tx.approval_requests.updateMany({
        where: { token, response: null },
        data: {
          responded_at: new Date(),
          response: "approved"
        }
      });
      if (result.count > 0) {
        await tx.posts.updateMany({
          where: { id: post.id, status: "queued" },
          data: { status: "approved" }
        });
      }
      return result;
    });

    if (updated.count === 0) {
      return reply
        .code(200)
        .type("text/html")
        .send(
          htmlPage(
            "Already responded",
            "You have already responded to this request."
          )
        );
    }

    try {
      const scheduled = await schedulePostJob(post.id);

      const appUrl = process.env.APP_URL ?? "http://localhost:5173";
      return reply
        .code(200)
        .type("text/html")
        .send(
          htmlPage(
            "Post scheduled",
            `Your post has been scheduled for <b>${scheduled.scheduledAt.toISOString()}</b>.<br/>
             <a href="${appUrl}/queue?post=${post.id}">View in Quilp →</a>`
          )
        );
    } catch (err: unknown) {
      if (err instanceof FrequencyCapReachedError) {
        await db.posts.updateMany({
          where: { id: post.id },
          data: { status: "queued" }
        });
        // Allow retry: scheduling failed before a publish job was enqueued.
        await db.approval_requests.updateMany({
          where: { id: requestRow.id },
          data: { response: null, responded_at: null }
        });

        return reply
          .code(200)
          .type("text/html")
          .send(
            htmlPage(
              "Frequency cap reached",
              "Your post could not be scheduled because the frequency cap was reached. Please try again later."
            )
          );
      }

      throw err;
    }
  });

  fastify.get("/api/v1/approval/:token/reject", async (request, reply) => {
    const token = (request.params as { token?: string }).token;
    if (!token) {
      return reply.code(400).type("text/html").send(
        htmlPage("Invalid link", "This link is invalid or expired.")
      );
    }

    const requestRow = await db.approval_requests.findUnique({
      where: { token },
      select: {
        id: true,
        post_id: true,
        response: true,
        timeout_at: true
      }
    });

    if (!requestRow || requestRow.timeout_at <= new Date()) {
      return reply
        .code(200)
        .type("text/html")
        .send(htmlPage("Approval expired", "This link is invalid or expired."));
    }

    if (requestRow.response !== null) {
      return reply
        .code(200)
        .type("text/html")
        .send(htmlPage("Already responded", "You have already responded to this request."));
    }

    const postForReject = await db.posts.findUnique({
      where: { id: requestRow.post_id },
      select: { id: true, status: true }
    });

    if (!postForReject || postForReject.status !== "queued") {
      return reply
        .code(200)
        .type("text/html")
        .send(
          htmlPage(
            "Cannot discard",
            `This post cannot be discarded — current status: ${esc(postForReject?.status ?? "unknown")}.`
          )
        );
    }

    const updated = await db.approval_requests.updateMany({
      where: { token, response: null },
      data: {
        responded_at: new Date(),
        response: "rejected"
      }
    });

    if (updated.count === 0) {
      return reply
        .code(200)
        .type("text/html")
        .send(htmlPage("Already responded", "You have already responded to this request."));
    }

    await db.posts.updateMany({
      where: { id: requestRow.post_id, status: "queued" },
      data: { status: "discarded" }
    });

    const appUrl = process.env.APP_URL ?? "http://localhost:5173";
    return reply
      .code(200)
      .type("text/html")
      .send(
        htmlPage(
          "Post discarded",
          `Post discarded.<br/><a href="${appUrl}/queue">View queue →</a>`
        )
      );
  });
}

