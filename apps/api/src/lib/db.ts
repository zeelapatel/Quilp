import { PrismaClient } from "@prisma/client";

const databaseUrl = process.env.DATABASE_APP_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_APP_URL is required");
}

export const db = new PrismaClient({
  datasourceUrl: databaseUrl
});
