import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient({
  datasourceUrl: process.env.DATABASE_APP_URL ?? process.env.DATABASE_URL
});

