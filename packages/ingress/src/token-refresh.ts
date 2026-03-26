import { Queue, Worker } from "bullmq";
import axios from "axios";
import { PrismaClient } from "@prisma/client";
import { decryptToken, encryptToken } from "@quilp/shared";
import { randomUUID } from "crypto";

const queueName = "token-refresh";
const bullmqPrefix = "quilp";

// Module-level singleton — avoids a new PrismaClient per setupTokenRefresh() call.
const db = new PrismaClient();

export function setupTokenRefresh(redisUrl: string) {
  const redisConnection = new URL(redisUrl);
  const connection = {
    host: redisConnection.hostname,
    port: Number(redisConnection.port || "6379"),
    maxRetriesPerRequest: null as null
  };
  const queue = new Queue(queueName, { connection, prefix: bullmqPrefix });

  const worker = new Worker(
    queueName,
    async job => {
      if (!job.data.traceId) {
        throw new Error("Token refresh job missing traceId");
      }

      const tokenKey = process.env.TOKEN_ENCRYPTION_KEY;
      const clientId = process.env.GMAIL_CLIENT_ID;
      const clientSecret = process.env.GMAIL_CLIENT_SECRET;
      if (!tokenKey || !clientId || !clientSecret) {
        throw new Error("TOKEN_ENCRYPTION_KEY, GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET are required");
      }

      const connections = await db.email_connections.findMany({
        where: {
          is_active: true,
          provider: "gmail",
          token_expires_at: {
            lt: new Date(Date.now() + 5 * 60 * 1000)
          }
        }
      });

      for (const connection of connections) {
        try {
          const refreshToken = decryptToken(connection.refresh_token_enc, tokenKey);
          const tokenResponse = await axios.post<{
            access_token: string;
            expires_in: number;
          }>(
            "https://oauth2.googleapis.com/token",
            new URLSearchParams({
              grant_type: "refresh_token",
              refresh_token: refreshToken,
              client_id: clientId,
              client_secret: clientSecret
            }).toString(),
            { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
          );

          await db.email_connections.update({
            where: { id: connection.id },
            data: {
              access_token_enc: encryptToken(tokenResponse.data.access_token, tokenKey),
              token_expires_at: new Date(Date.now() + tokenResponse.data.expires_in * 1000)
            }
          });
        } catch (error) {
          if (axios.isAxiosError(error) && error.response?.status === 401) {
            await db.email_connections.update({
              where: { id: connection.id },
              data: { is_active: false }
            });
            continue;
          }
          throw error;
        }
      }
    },
    { connection, prefix: bullmqPrefix }
  );

  const schedule = async () => {
    await queue.add(
      "gmail-token-refresh",
      { traceId: randomUUID() },
      {
        repeat: { every: 10 * 60 * 1000 },
        removeOnComplete: true
      }
    );
  };

  return {
    worker,
    schedule,
    close: async () => {
      await queue.close();
      await worker.close();
    }
  };
}
