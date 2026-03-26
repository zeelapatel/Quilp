import { randomBytes } from "node:crypto";
import { sendEmail } from "@quilp/shared";
import { prisma } from "./db.js";

import type { PostStatus } from "@prisma/client";

async function decryptUserEmail(userId: string): Promise<string> {
  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) {
    throw new Error("ENCRYPTION_KEY is required");
  }

  const rows = await prisma.$queryRaw<Array<{ email: string }>>`
    SELECT pgp_sym_decrypt(email, ${encryptionKey})::text AS email
    FROM users
    WHERE id = ${userId}
    LIMIT 1
  `;

  return rows[0]?.email ?? "";
}

function buildApprovalEmailHtml(params: {
  previewText: string;
  platform: string;
  category: string;
  confidenceScore: number | null;
  voiceScore: number | null;
  approveUrl: string;
  rejectUrl: string;
  editUrl: string;
  timeoutHrs: number;
  timeoutAction: string;
}): string {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      body { font-family: -apple-system, sans-serif; background:#0A0A0A; color:#F0F0F0; margin:0; padding:0; }
      .container { max-width:560px; margin:40px auto; padding:0 20px; }
      .logo { font-family: "Courier New", monospace; font-size:20px; margin-bottom:24px; color:#F0F0F0; }
      .card { background:#111; border:1px solid #222; border-radius:8px; padding:20px; margin-bottom:16px; }
      .badge { display:inline-block; font-size:10px; padding:2px 6px; background:#0077B5; color:white; border-radius:3px; font-weight:600; }
      .preview { white-space: pre-wrap; font-size:14px; line-height:1.6; margin-top:10px; }
      .actions { display:flex; gap:12px; margin:24px 0; flex-wrap:wrap; }
      a.btn { display:inline-block; padding:12px 20px; border-radius:6px; text-decoration:none; font-size:14px; border:1px solid #333; color:#888; }
      a.btn-approve { background:#E8F94A; border-color:#E8F94A; color:#0A0A0A; font-weight:600; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="logo">quilp<span>.</span></div>
      <div class="card">
        <div class="badge">${params.platform.replace("_", " ").toUpperCase()}</div>
        <div style="margin-top:10px; font-size:12px; color:#888; text-transform:uppercase; letter-spacing:0.06em;">
          Post preview
        </div>
        <div class="preview">${params.previewText}${params.previewText.length >= 200 ? "..." : ""}</div>
        <div style="margin-top:14px; font-size:12px; color:#999;">
          Category: ${params.category}
          ${params.confidenceScore !== null ? `| Confidence: ${params.confidenceScore}` : ""}
          ${params.voiceScore !== null ? `| Voice: ${params.voiceScore}` : ""}
        </div>
      </div>

      <div class="actions">
        <a href="${params.approveUrl}" class="btn btn-approve">Approve &amp; schedule</a>
        <a href="${params.editUrl}" class="btn">Edit</a>
        <a href="${params.rejectUrl}" class="btn">Discard</a>
      </div>

      <div style="font-size:12px; color:#555;">
        This request expires in ${params.timeoutHrs} hours. If no action is taken, the post will be
        ${params.timeoutAction === "auto_post" ? "automatically scheduled" : "discarded"}.
      </div>
    </div>
  </body>
</html>`;
}

export async function sendApprovalEmail(
  postId: string,
  userId: string
): Promise<void> {
  const [post, user] = await Promise.all([
    prisma.posts.findUnique({
      where: { id: postId },
      select: {
        content: true,
        platform: true,
        category: true,
        confidence_score: true,
        voice_score: true,
        status: true
      }
    }),
    prisma.users.findUnique({
      where: { id: userId },
      select: {
        approval_timeout_hrs: true,
        timeout_action: true
      }
    })
  ]);

  if (!post || !user) return;
  if (post.status !== ("queued" as PostStatus)) return;

  const token = randomBytes(32).toString("hex");
  const timeoutHrs = user.approval_timeout_hrs ?? 4;
  const timeoutAt = new Date(Date.now() + timeoutHrs * 60 * 60 * 1000);

  await prisma.approval_requests.create({
    data: {
      post_id: postId,
      channel: "email",
      token,
      timeout_action: user.timeout_action ?? "discard",
      timeout_at: timeoutAt
    }
  });

  const userEmail = await decryptUserEmail(userId);
  if (!userEmail) {
    console.error(`[sendApprovalEmail] Could not decrypt user email for userId=${userId}`);
    throw new Error("Could not decrypt user email for approval");
  }

  const apiUrl = process.env.API_URL ?? "http://localhost:3000";
  const appUrl = process.env.APP_URL ?? "http://localhost:5173";

  const previewText = post.content ?? "";

  const html = buildApprovalEmailHtml({
    previewText,
    platform: post.platform,
    category: post.category,
    confidenceScore: post.confidence_score ?? null,
    voiceScore: post.voice_score ?? null,
    approveUrl: `${apiUrl}/api/v1/approval/${token}/approve`,
    rejectUrl: `${apiUrl}/api/v1/approval/${token}/reject`,
    editUrl: `${appUrl}/queue?post=${postId}`,
    timeoutHrs,
    timeoutAction: user.timeout_action ?? "discard"
  });

  // Do not log token (security).
  await sendEmail(
    userEmail,
    `Review your Quilp post — ${post.category}`,
    html
  );
}

