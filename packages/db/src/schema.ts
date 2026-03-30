import { DEFAULT_SCRIPT_TEMPLATE, PLATFORM_OPTIONS } from "@autocashback/domain";

import { hashPassword } from "./crypto";
import { getDbType, getSql } from "./client";
import { getServerEnv } from "./env";
import { ensureDatabaseSchema } from "./migrations";
import { countAsInt } from "./sql-helpers";

let bootstrapped = false;
const SKIP_RUNTIME_DB_INIT_ENV = "SKIP_RUNTIME_DB_INIT";

function shouldTrustStartupBootstrap() {
  return process.env[SKIP_RUNTIME_DB_INIT_ENV] === "true";
}

export function resetDatabaseReadyStateForTests() {
  bootstrapped = false;
}

export async function ensureDatabaseReady() {
  if (bootstrapped || shouldTrustStartupBootstrap()) {
    bootstrapped = true;
    return;
  }

  await ensureDatabaseSchema();

  const sql = getSql();
  for (const platform of PLATFORM_OPTIONS) {
    await sql`
      INSERT INTO cashback_platforms (code, name, integration_mode, notes)
      VALUES (${platform.value}, ${platform.label}, ${"manual"}, ${platform.note})
      ON CONFLICT (code) DO NOTHING
    `;
  }

  await ensureDefaultAdmin();
  await ensureDefaultSettings();

  bootstrapped = true;
}

async function ensureDefaultAdmin() {
  const sql = getSql();
  const dbType = getDbType();
  const admins = await sql.unsafe<{ count: number }[]>(
    `
      SELECT ${countAsInt("COUNT(*)", dbType)} AS count
      FROM users
      WHERE role = 'admin'
    `
  );

  if (admins[0]?.count) return;

  const env = getServerEnv();
  const passwordHash = await hashPassword(env.DEFAULT_ADMIN_PASSWORD);

  await sql`
    INSERT INTO users (username, email, password_hash, role)
    VALUES (${`admin`}, ${`admin@autocashback.local`}, ${passwordHash}, ${`admin`})
  `;
}

async function ensureDefaultSettings() {
  const sql = getSql();
  const dbType = getDbType();
  const defaults = [
    {
      category: "cashback",
      key: "topcashback_notes",
      value: "TopCashback 按手工模式运营，账号、Offer、佣金进度均在 AutoCashBack 内部维护。"
    },
    {
      category: "cashback",
      key: "rakuten_notes",
      value: "Rakuten 按手工模式运营，不依赖公开 API。"
    },
    {
      category: "cashback",
      key: "custom_notes",
      value: "Custom 平台用于录入无法标准化接入的返利网。"
    },
    {
      category: "linkSwap",
      key: "script_template",
      value: DEFAULT_SCRIPT_TEMPLATE
    },
    {
      category: "proxy",
      key: "proxy_urls",
      value: JSON.stringify([])
    }
  ];

  for (const item of defaults) {
    const existing = await sql.unsafe<{ count: number }[]>(
      `
        SELECT ${countAsInt("COUNT(*)", dbType)} AS count
        FROM system_settings
        WHERE user_id IS NULL
          AND category = ?
          AND key = ?
      `,
      [item.category, item.key]
    );

    if (!existing[0]?.count) {
      await sql`
        INSERT INTO system_settings (user_id, category, key, value, is_sensitive)
        VALUES (NULL, ${item.category}, ${item.key}, ${item.value}, FALSE)
      `;
    }
  }
}
