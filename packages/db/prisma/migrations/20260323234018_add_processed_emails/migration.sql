-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('fathom', 'fireflies', 'otter', 'phantom', 'apollo', 'gong', 'tldv', 'loom', 'zoom', 'generic');

-- CreateEnum
CREATE TYPE "ProcessingStatus" AS ENUM ('pending', 'processing', 'completed', 'failed', 'held', 'dlq');

-- CreateTable
CREATE TABLE "processed_emails" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "connection_id" UUID NOT NULL,
    "message_id" TEXT NOT NULL,
    "sender_email" TEXT NOT NULL,
    "sender_name" TEXT,
    "source_type" "SourceType" NOT NULL,
    "subject" TEXT NOT NULL,
    "extracted_data" JSONB NOT NULL,
    "confidence_score" INTEGER NOT NULL,
    "processing_status" "ProcessingStatus" NOT NULL DEFAULT 'pending',
    "held_reason" TEXT,
    "raw_processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_emails_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "processed_emails_user_id_created_at_idx" ON "processed_emails"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "processed_emails_connection_id_message_id_idx" ON "processed_emails"("connection_id", "message_id");

-- CreateIndex
CREATE UNIQUE INDEX "processed_emails_connection_id_message_id_key" ON "processed_emails"("connection_id", "message_id");
