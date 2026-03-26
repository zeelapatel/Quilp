import { decryptToken, encryptToken } from "@quilp/shared";

export interface PublishResult {
  success: boolean;
  platformPostId: string | null;
  publishedAt: Date | null;
  error: string | null;
}

export interface SocialConnection {
  id: string;
  access_token_enc: string;
  refresh_token_enc: string | null;
  token_expires_at: Date | null;
  account_id: string;
}

export class LinkedInApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(`LinkedIn API ${status}: ${message}`);
    this.name = "LinkedInApiError";
  }
}

export async function publishToLinkedIn(
  content: string,
  connection: SocialConnection
): Promise<PublishResult> {
  const tokenKey = process.env.TOKEN_ENCRYPTION_KEY;
  if (!tokenKey) {
    throw new Error("TOKEN_ENCRYPTION_KEY is required");
  }

  const accessToken = decryptToken(connection.access_token_enc, tokenKey);

  const payload = {
    author: connection.account_id,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text: content },
        shareMediaCategory: "NONE"
      }
    },
    visibility: {
      "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
    }
  };

  const response = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const error = await response.text().catch(() => "");
    throw new LinkedInApiError(response.status, error || "Request failed");
  }

  const result = (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  const postId =
    response.headers.get("x-restli-id") ??
    (result.id as string | undefined) ??
    (result["id"] as string | undefined) ??
    null;

  return {
    success: true,
    platformPostId: postId,
    publishedAt: new Date(),
    error: null
  };
}

export async function deleteLinkedInPost(
  platformPostId: string,
  connection: SocialConnection
): Promise<{ success: boolean; error: string | null }> {
  const tokenKey = process.env.TOKEN_ENCRYPTION_KEY;
  if (!tokenKey) {
    throw new Error("TOKEN_ENCRYPTION_KEY is required");
  }

  const accessToken = decryptToken(connection.access_token_enc, tokenKey);

  const response = await fetch(
    `https://api.linkedin.com/v2/ugcPosts/${encodeURIComponent(platformPostId)}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "X-Restli-Protocol-Version": "2.0.0"
      }
    }
  );

  if (!response.ok) {
    const error = await response.text().catch(() => "");
    return {
      success: false,
      error: error || `LinkedIn delete failed with status ${response.status}`
    };
  }

  return { success: true, error: null };
}

export async function refreshLinkedInAccessToken(
  connection: SocialConnection
): Promise<{
  accessTokenEnc: string;
  refreshTokenEnc: string | null;
  tokenExpiresAt: Date | null;
}> {
  const tokenKey = process.env.TOKEN_ENCRYPTION_KEY;
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;

  if (!tokenKey) {
    throw new Error("TOKEN_ENCRYPTION_KEY is required");
  }
  if (!clientId || !clientSecret) {
    throw new Error("LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET are required");
  }

  if (!connection.refresh_token_enc) {
    throw new Error("No refresh token available");
  }

  const refreshToken = decryptToken(connection.refresh_token_enc, tokenKey);

  const response = await fetch(
    "https://www.linkedin.com/oauth/v2/accessToken",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret
      })
    }
  );

  if (!response.ok) {
    const error = await response.text().catch(() => "");
    throw new LinkedInApiError(response.status, error || "Token refresh failed");
  }

  const data = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };

  if (!data.access_token) {
    throw new LinkedInApiError(500, "Missing access_token in refresh response");
  }

  const accessTokenEnc = encryptToken(data.access_token, tokenKey);
  const refreshTokenEnc = data.refresh_token
    ? encryptToken(data.refresh_token, tokenKey)
    : null;
  const tokenExpiresAt =
    typeof data.expires_in === "number"
      ? new Date(Date.now() + data.expires_in * 1000)
      : null;

  return { accessTokenEnc, refreshTokenEnc, tokenExpiresAt };
}

