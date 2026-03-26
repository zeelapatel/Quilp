-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('starter', 'solo', 'pro', 'team', 'agency', 'enterprise');

-- CreateEnum
CREATE TYPE "Region" AS ENUM ('us', 'eu');

-- CreateEnum
CREATE TYPE "Provider" AS ENUM ('gmail', 'outlook');

-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('linkedin_personal', 'linkedin_company', 'x', 'instagram', 'facebook', 'substack', 'beehiiv', 'slack', 'notion');

-- CreateEnum
CREATE TYPE "PostFormat" AS ENUM ('long_form', 'short_form', 'thread', 'single_tweet', 'caption', 'newsletter', 'broadcast');

-- CreateEnum
CREATE TYPE "PostStatus" AS ENUM ('draft', 'queued', 'approved', 'posted', 'failed', 'discarded');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "auth0_sub" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "plan" "Plan" NOT NULL DEFAULT 'starter',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "data_region" "Region" NOT NULL DEFAULT 'us',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_connections" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "provider" "Provider" NOT NULL,
    "access_token_enc" TEXT NOT NULL,
    "refresh_token_enc" TEXT NOT NULL,
    "token_expires_at" TIMESTAMP(3) NOT NULL,
    "last_poll_at" TIMESTAMP(3),
    "last_history_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "platform" "Platform" NOT NULL,
    "format" "PostFormat" NOT NULL,
    "content" TEXT NOT NULL,
    "content_original" TEXT,
    "category" TEXT NOT NULL,
    "confidence_score" INTEGER,
    "voice_score" INTEGER,
    "status" "PostStatus" NOT NULL DEFAULT 'draft',
    "scheduled_at" TIMESTAMP(3),
    "posted_at" TIMESTAMP(3),
    "platform_post_id" TEXT,
    "is_user_edited" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_auth0_sub_key" ON "users"("auth0_sub");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "posts_user_id_status_scheduled_at_idx" ON "posts"("user_id", "status", "scheduled_at");

-- CreateIndex
CREATE INDEX "posts_user_id_created_at_idx" ON "posts"("user_id", "created_at");
