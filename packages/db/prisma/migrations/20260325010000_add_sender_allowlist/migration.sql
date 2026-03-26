-- Add sender_allowlist table for per-user email allowlisting

CREATE TABLE "sender_allowlist" (
  "id"         UUID        NOT NULL DEFAULT gen_random_uuid(),
  "user_id"    UUID        NOT NULL,
  "email"      TEXT        NOT NULL,
  "label"      TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "sender_allowlist_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sender_allowlist_user_id_email_key" UNIQUE ("user_id", "email"),
  CONSTRAINT "sender_allowlist_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "sender_allowlist_user_id_idx" ON "sender_allowlist"("user_id");
