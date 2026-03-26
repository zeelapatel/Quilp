-- CreateEnum
CREATE TYPE "VoiceProfileType" AS ENUM ('personal', 'company');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "voice_profile_id" UUID;

-- CreateTable
CREATE TABLE "voice_profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "profile_type" "VoiceProfileType" NOT NULL DEFAULT 'personal',
    "calibration_posts" JSONB NOT NULL,
    "extracted_patterns" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "last_calibrated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voice_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "voice_profiles_user_id_profile_type_idx" ON "voice_profiles"("user_id", "profile_type");

-- CreateIndex
CREATE UNIQUE INDEX "voice_profiles_user_id_profile_type_key" ON "voice_profiles"("user_id", "profile_type");
