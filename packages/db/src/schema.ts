import { DEFAULT_SCRIPT_TEMPLATE, PLATFORM_OPTIONS } from "@autocashback/domain";

import { hashPassword } from "./crypto";
import { getDbType, getSql } from "./client";
import { getServerEnv } from "./env";
import {
  booleanColumnDefinition,
  countAsInt,
  currentTimestampColumnDefinition,
  decimalColumnDefinition,
  nullableTimestampColumnDefinition,
  primaryKeyColumnDefinition
} from "./sql-helpers";

let bootstrapped = false;

export async function ensureDatabaseReady() {
  if (bootstrapped) return;

  const sql = getSql();
  const dbType = getDbType();

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS users (
      id ${primaryKeyColumnDefinition(dbType)},
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at ${currentTimestampColumnDefinition(dbType)}
    );
  `);

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS cashback_platforms (
      id ${primaryKeyColumnDefinition(dbType)},
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      integration_mode TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      notes TEXT,
      created_at ${currentTimestampColumnDefinition(dbType)}
    );
  `);

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS cashback_accounts (
      id ${primaryKeyColumnDefinition(dbType)},
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      platform_code TEXT NOT NULL,
      account_name TEXT NOT NULL,
      register_email TEXT NOT NULL,
      payout_method TEXT NOT NULL,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at ${currentTimestampColumnDefinition(dbType)}
    );
  `);

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS offers (
      id ${primaryKeyColumnDefinition(dbType)},
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      platform_code TEXT NOT NULL,
      cashback_account_id INTEGER NOT NULL REFERENCES cashback_accounts(id) ON DELETE CASCADE,
      promo_link TEXT NOT NULL,
      target_country TEXT NOT NULL,
      brand_name TEXT NOT NULL,
      campaign_label TEXT NOT NULL,
      commission_cap_usd ${decimalColumnDefinition(dbType, 200)},
      manual_recorded_commission_usd ${decimalColumnDefinition(dbType, 0)},
      latest_resolved_url TEXT,
      latest_resolved_suffix TEXT,
      last_resolved_at ${nullableTimestampColumnDefinition(dbType)},
      status TEXT NOT NULL DEFAULT 'draft',
      created_at ${currentTimestampColumnDefinition(dbType)},
      UNIQUE(user_id, campaign_label)
    );
  `);

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS link_swap_tasks (
      id ${primaryKeyColumnDefinition(dbType)},
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      offer_id INTEGER NOT NULL UNIQUE REFERENCES offers(id) ON DELETE CASCADE,
      enabled ${booleanColumnDefinition(dbType, true)},
      interval_minutes INTEGER NOT NULL DEFAULT 60,
      status TEXT NOT NULL DEFAULT 'idle',
      consecutive_failures INTEGER NOT NULL DEFAULT 0,
      last_run_at ${nullableTimestampColumnDefinition(dbType)},
      next_run_at ${nullableTimestampColumnDefinition(dbType)},
      created_at ${currentTimestampColumnDefinition(dbType)}
    );
  `);

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS link_swap_runs (
      id ${primaryKeyColumnDefinition(dbType)},
      task_id INTEGER NOT NULL REFERENCES link_swap_tasks(id) ON DELETE CASCADE,
      offer_id INTEGER NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
      raw_url TEXT NOT NULL,
      resolved_url TEXT,
      resolved_suffix TEXT,
      proxy_url TEXT,
      status TEXT NOT NULL,
      error_message TEXT,
      created_at ${currentTimestampColumnDefinition(dbType)}
    );
  `);

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS system_settings (
      id ${primaryKeyColumnDefinition(dbType)},
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      category TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT,
      encrypted_value TEXT,
      is_sensitive ${booleanColumnDefinition(dbType, false)},
      created_at ${currentTimestampColumnDefinition(dbType)},
      updated_at ${currentTimestampColumnDefinition(dbType)},
      UNIQUE(user_id, category, key)
    );
  `);

  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS script_tokens (
      id ${primaryKeyColumnDefinition(dbType)},
      user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      created_at ${currentTimestampColumnDefinition(dbType)}
    );
  `);

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
