CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;
ALTER TABLE users ALTER COLUMN email TYPE bytea USING convert_to(email, 'UTF8');

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_isolation ON users;
CREATE POLICY users_isolation ON users
  USING (id::text = current_setting('app.user_id', true));

DROP POLICY IF EXISTS email_connections_isolation ON email_connections;
CREATE POLICY email_connections_isolation ON email_connections
  USING (user_id::text = current_setting('app.user_id', true));

DROP POLICY IF EXISTS posts_isolation ON posts;
CREATE POLICY posts_isolation ON posts
  USING (user_id::text = current_setting('app.user_id', true));

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'quilp_app') THEN
    CREATE ROLE quilp_app LOGIN PASSWORD 'quilp_app_dev';
  END IF;
END
$$;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO quilp_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO quilp_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO quilp_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT USAGE, SELECT ON SEQUENCES TO quilp_app;
