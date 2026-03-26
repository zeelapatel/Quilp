import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { randomUUID } from "crypto";

let adminClient: Client;
let appClient: Client;
const hasRequiredEnv = Boolean(process.env.DATABASE_URL && process.env.DATABASE_APP_URL);

(hasRequiredEnv ? describe : describe.skip)("RLS isolation", () => {
  const userOneId = randomUUID();
  const userTwoId = randomUUID();
  const userOnePostId = randomUUID();
  const userTwoPostId = randomUUID();

  beforeAll(async () => {
    const databaseUrl = process.env.DATABASE_URL;
    const appDatabaseUrl = process.env.DATABASE_APP_URL;
    if (!databaseUrl || !appDatabaseUrl) {
      throw new Error("DATABASE_URL and DATABASE_APP_URL are required for RLS tests");
    }

    adminClient = new Client({ connectionString: databaseUrl });
    appClient = new Client({ connectionString: appDatabaseUrl });
    await adminClient.connect();
    await appClient.connect();

    await adminClient.query(
      `INSERT INTO users (id, auth0_sub, email, plan, timezone, data_region)
       VALUES 
       ($1, $2, pgp_sym_encrypt($3, $7), 'starter', 'UTC', 'us'),
       ($4, $5, pgp_sym_encrypt($6, $7), 'starter', 'UTC', 'us')`,
      [
        userOneId,
        `auth0|${userOneId}`,
        "u1@quilp.local",
        userTwoId,
        `auth0|${userTwoId}`,
        "u2@quilp.local",
        process.env.ENCRYPTION_KEY ?? "01234567890123456789012345678901"
      ]
    );

    await adminClient.query(
      `INSERT INTO posts (id, user_id, platform, format, content, category, status)
       VALUES 
       ($1, $2, 'x', 'short_form', 'post-user-1', 'test', 'draft'),
       ($3, $4, 'x', 'short_form', 'post-user-2', 'test', 'draft')`,
      [userOnePostId, userOneId, userTwoPostId, userTwoId]
    );
  });

  afterAll(async () => {
    if (adminClient) {
      await adminClient.query("DELETE FROM posts WHERE id = $1 OR id = $2", [userOnePostId, userTwoPostId]);
      await adminClient.query("DELETE FROM users WHERE id = $1 OR id = $2", [userOneId, userTwoId]);
      await adminClient.end();
    }
    if (appClient) {
      await appClient.end();
    }
  });

  it("only returns posts for the active app.user_id", async () => {
    await appClient.query("SELECT set_config('app.user_id', $1, true)", [userOneId]);
    const asUserOne = await appClient.query("SELECT id, user_id, content FROM posts ORDER BY created_at ASC");
    expect(asUserOne.rows).toHaveLength(1);
    expect(asUserOne.rows[0].user_id).toBe(userOneId);
    expect(asUserOne.rows[0].content).toBe("post-user-1");

    await appClient.query("SELECT set_config('app.user_id', $1, true)", [userTwoId]);
    const asUserTwo = await appClient.query("SELECT id, user_id, content FROM posts ORDER BY created_at ASC");
    expect(asUserTwo.rows).toHaveLength(1);
    expect(asUserTwo.rows[0].user_id).toBe(userTwoId);
    expect(asUserTwo.rows[0].content).toBe("post-user-2");
  });
});
