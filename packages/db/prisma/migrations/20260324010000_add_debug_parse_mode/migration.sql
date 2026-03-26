-- AlterTable
ALTER TABLE "users"
ADD COLUMN "debug_parse_all_emails" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "debug_generate_posts" BOOLEAN NOT NULL DEFAULT false;
