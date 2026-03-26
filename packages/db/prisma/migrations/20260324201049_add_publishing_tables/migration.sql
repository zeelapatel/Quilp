-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('personal', 'company', 'page');

-- CreateEnum
CREATE TYPE "ApprovalChannel" AS ENUM ('email', 'slack');

-- CreateEnum
CREATE TYPE "ApprovalResponse" AS ENUM ('approved', 'rejected', 'edited', 'timed_out');

-- CreateEnum
CREATE TYPE "TimeoutAction" AS ENUM ('auto_post', 'discard');

-- CreateEnum
CREATE TYPE "ApprovalMode" AS ENUM ('require_approval', 'auto_post');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "approval_mode" "ApprovalMode" NOT NULL DEFAULT 'require_approval',
ADD COLUMN     "approval_timeout_hrs" INTEGER NOT NULL DEFAULT 4,
ADD COLUMN     "blackout_end" TEXT,
ADD COLUMN     "blackout_start" TEXT,
ADD COLUMN     "max_posts_per_day" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "timeout_action" "TimeoutAction" NOT NULL DEFAULT 'discard';

-- CreateTable
CREATE TABLE "social_connections" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "platform" "Platform" NOT NULL,
    "access_token_enc" TEXT NOT NULL,
    "refresh_token_enc" TEXT,
    "token_expires_at" TIMESTAMP(3),
    "account_id" TEXT NOT NULL,
    "account_email" TEXT NOT NULL,
    "account_name" TEXT NOT NULL,
    "account_type" "AccountType" NOT NULL DEFAULT 'personal',
    "scope_hash" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "post_id" UUID NOT NULL,
    "channel" "ApprovalChannel" NOT NULL DEFAULT 'email',
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responded_at" TIMESTAMP(3),
    "response" "ApprovalResponse",
    "timeout_action" "TimeoutAction" NOT NULL DEFAULT 'discard',
    "timeout_at" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "social_connections_user_id_platform_is_active_idx" ON "social_connections"("user_id", "platform", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "social_connections_user_id_platform_account_type_key" ON "social_connections"("user_id", "platform", "account_type");

-- CreateIndex
CREATE UNIQUE INDEX "approval_requests_token_key" ON "approval_requests"("token");

-- CreateIndex
CREATE INDEX "approval_requests_post_id_idx" ON "approval_requests"("post_id");

-- CreateIndex
CREATE INDEX "approval_requests_timeout_at_idx" ON "approval_requests"("timeout_at");
