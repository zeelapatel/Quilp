-- Sprint 5: Add FK constraints, cascade deletes, composite indexes, and CHECK constraints

-- FK: email_connections.user_id → users.id (CASCADE)
ALTER TABLE "email_connections"
  ADD CONSTRAINT "email_connections_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- FK: processed_emails.connection_id → email_connections.id (CASCADE)
ALTER TABLE "processed_emails"
  ADD CONSTRAINT "processed_emails_connection_id_fkey"
  FOREIGN KEY ("connection_id") REFERENCES "email_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- FK: posts.user_id → users.id (CASCADE)
ALTER TABLE "posts"
  ADD CONSTRAINT "posts_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- FK: posts.source_email_id → processed_emails.id (SET NULL)
ALTER TABLE "posts"
  ADD CONSTRAINT "posts_source_email_id_fkey"
  FOREIGN KEY ("source_email_id") REFERENCES "processed_emails"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- FK: social_connections.user_id → users.id (CASCADE)
ALTER TABLE "social_connections"
  ADD CONSTRAINT "social_connections_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- FK: voice_profiles.user_id → users.id (CASCADE)
ALTER TABLE "voice_profiles"
  ADD CONSTRAINT "voice_profiles_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- FK: users.voice_profile_id → voice_profiles.id (SET NULL, NO ACTION on update to avoid cycle)
ALTER TABLE "users"
  ADD CONSTRAINT "users_voice_profile_id_fkey"
  FOREIGN KEY ("voice_profile_id") REFERENCES "voice_profiles"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- FK: approval_requests.post_id → posts.id (CASCADE)
ALTER TABLE "approval_requests"
  ADD CONSTRAINT "approval_requests_post_id_fkey"
  FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Composite indexes for hot query paths
CREATE INDEX IF NOT EXISTS "email_connections_user_id_is_active_idx"
  ON "email_connections"("user_id", "is_active");

CREATE INDEX IF NOT EXISTS "posts_user_id_status_platform_idx"
  ON "posts"("user_id", "status", "platform");

-- Replace single-column approval_requests.timeout_at index with composite
DROP INDEX IF EXISTS "approval_requests_timeout_at_idx";
CREATE INDEX IF NOT EXISTS "approval_requests_timeout_at_post_id_idx"
  ON "approval_requests"("timeout_at", "post_id");

-- CHECK constraints on numeric fields
ALTER TABLE "users"
  ADD CONSTRAINT "chk_max_posts_per_day"
  CHECK ("max_posts_per_day" BETWEEN 1 AND 50);

ALTER TABLE "users"
  ADD CONSTRAINT "chk_approval_timeout_hrs"
  CHECK ("approval_timeout_hrs" BETWEEN 1 AND 24);

ALTER TABLE "posts"
  ADD CONSTRAINT "chk_prompt_tokens"
  CHECK ("prompt_tokens" IS NULL OR "prompt_tokens" >= 0);

ALTER TABLE "posts"
  ADD CONSTRAINT "chk_completion_tokens"
  CHECK ("completion_tokens" IS NULL OR "completion_tokens" >= 0);
