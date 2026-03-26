-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "completion_tokens" INTEGER,
ADD COLUMN     "generation_ms" INTEGER,
ADD COLUMN     "llm_model" TEXT,
ADD COLUMN     "prompt_tokens" INTEGER,
ADD COLUMN     "source_email_id" UUID;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "llm_monthly_cap_usd" DECIMAL(10,4);

-- CreateTable
CREATE TABLE "llm_usage" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "month" TEXT NOT NULL,
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "cost_usd" DECIMAL(10,6) NOT NULL,
    "call_count" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "llm_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "llm_usage_user_id_month_idx" ON "llm_usage"("user_id", "month");

-- CreateIndex
CREATE UNIQUE INDEX "llm_usage_user_id_month_key" ON "llm_usage"("user_id", "month");
