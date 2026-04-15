import { randomUUID } from "node:crypto";

import type {
  CashbackAccount,
  DashboardSummary,
  LinkSwapRunRecord,
  LinkSwapTaskRecord,
  OfferRecord,
  ProxySettingEntry
} from "@autocashback/domain";

import { getDbType, getSql } from "./client";
import { decryptText, encryptText } from "./crypto";
import { ensureDatabaseReady } from "./schema";
import {
  booleanValue,
  countAsInt,
  plusMinutesExpression,
  successRateExpression
} from "./sql-helpers";

type DbRow = Record<string, unknown>;

export async function getDashboardSummary(userId: number): Promise<DashboardSummary> {
  await ensureDatabaseReady();
  const sql = getSql();
  const dbType = getDbType();
  const [counts] = await sql.unsafe<{
    active_offers: number;
    active_tasks: number;
    warning_offers: number;
    success_rate: number;
  }[]>(
    `
      SELECT
        (SELECT ${countAsInt("COUNT(*)", dbType)} FROM offers WHERE user_id = ? AND status <> 'draft') AS active_offers,
        (SELECT ${countAsInt("COUNT(*)", dbType)} FROM link_swap_tasks WHERE user_id = ? AND enabled = TRUE) AS active_tasks,
        (SELECT ${countAsInt("COUNT(*)", dbType)} FROM offers WHERE user_id = ? AND manual_recorded_commission_usd >= commission_cap_usd) AS warning_offers,
        COALESCE((
          SELECT ${successRateExpression(dbType)}
          FROM link_swap_runs
          WHERE offer_id IN (SELECT id FROM offers WHERE user_id = ?)
        ), 0) AS success_rate
    `,
    [userId, userId, userId, userId]
  );

  return {
    activeOffers: counts?.active_offers ?? 0,
    activeTasks: counts?.active_tasks ?? 0,
    successRate: Number(counts?.success_rate ?? 0),
    warningOffers: counts?.warning_offers ?? 0
  };
}

export async function listAccounts(userId: number): Promise<CashbackAccount[]> {
  await ensureDatabaseReady();
  const sql = getSql();
  const rows = await sql<DbRow[]>`
    SELECT id, user_id, platform_code, account_name, register_email, payout_method, notes, status, created_at
    FROM cashback_accounts
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
  `;

  return rows.map(toAccountRecord);
}

export async function createAccount(
  userId: number,
  input: Omit<CashbackAccount, "id" | "userId" | "createdAt" | "status">
) {
  await ensureDatabaseReady();
  const sql = getSql();
  const rows = await sql<DbRow[]>`
    INSERT INTO cashback_accounts (
      user_id,
      platform_code,
      account_name,
      register_email,
      payout_method,
      notes
    )
    VALUES (
      ${userId},
      ${input.platformCode},
      ${input.accountName},
      ${input.registerEmail},
      ${input.payoutMethod},
      ${input.notes}
    )
    RETURNING id, user_id, platform_code, account_name, register_email, payout_method, notes, status, created_at
  `;

  return toAccountRecord(rows[0]);
}

export async function updateAccount(
  userId: number,
  accountId: number,
  input: Omit<CashbackAccount, "id" | "userId" | "createdAt">
) {
  await ensureDatabaseReady();
  const sql = getSql();
  const rows = await sql<DbRow[]>`
    UPDATE cashback_accounts
    SET platform_code = ${input.platformCode},
        account_name = ${input.accountName},
        register_email = ${input.registerEmail},
        payout_method = ${input.payoutMethod},
        notes = ${input.notes},
        status = ${input.status}
    WHERE id = ${accountId} AND user_id = ${userId}
    RETURNING id, user_id, platform_code, account_name, register_email, payout_method, notes, status, created_at
  `;

  if (!rows[0]) {
    throw new Error("返利网账号不存在");
  }

  return toAccountRecord(rows[0]);
}

export async function deleteAccount(userId: number, accountId: number) {
  await ensureDatabaseReady();
  const sql = getSql();
  const rows = await sql<{ id: number }[]>`
    DELETE FROM cashback_accounts
    WHERE id = ${accountId} AND user_id = ${userId}
    RETURNING id
  `;

  return Boolean(rows[0]);
}

export async function listOffers(userId: number): Promise<OfferRecord[]> {
  await ensureDatabaseReady();
  const sql = getSql();
  const rows = await sql<DbRow[]>`
    SELECT *
    FROM offers
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
  `;

  return rows.map(toOfferRecord);
}

export async function createOffer(
  userId: number,
  input: Omit<
    OfferRecord,
    | "id"
    | "userId"
    | "latestResolvedUrl"
    | "latestResolvedSuffix"
    | "lastResolvedAt"
    | "status"
    | "createdAt"
  >
) {
  await ensureDatabaseReady();
  const sql = getSql();
  const rows = await sql<DbRow[]>`
    INSERT INTO offers (
      user_id,
      platform_code,
      cashback_account_id,
      promo_link,
      target_country,
      brand_name,
      campaign_label,
      commission_cap_usd,
      manual_recorded_commission_usd,
      status
    )
    VALUES (
      ${userId},
      ${input.platformCode},
      ${input.cashbackAccountId},
      ${input.promoLink},
      ${input.targetCountry},
      ${input.brandName},
      ${input.campaignLabel},
      ${input.commissionCapUsd},
      ${input.manualRecordedCommissionUsd},
      ${computeOfferStatus(input)}
    )
    RETURNING *
  `;

  const offer = rows[0];
  await ensureLinkSwapTask(userId, Number(offer.id));
  return toOfferRecord(offer);
}

export async function updateOffer(
  userId: number,
  offerId: number,
  input: Omit<
    OfferRecord,
    | "id"
    | "userId"
    | "latestResolvedUrl"
    | "latestResolvedSuffix"
    | "lastResolvedAt"
    | "status"
    | "createdAt"
  >
) {
  await ensureDatabaseReady();
  const sql = getSql();
  const rows = await sql<DbRow[]>`
    UPDATE offers
    SET platform_code = ${input.platformCode},
        cashback_account_id = ${input.cashbackAccountId},
        promo_link = ${input.promoLink},
        target_country = ${input.targetCountry},
        brand_name = ${input.brandName},
        campaign_label = ${input.campaignLabel},
        commission_cap_usd = ${input.commissionCapUsd},
        manual_recorded_commission_usd = ${input.manualRecordedCommissionUsd},
        status = ${computeOfferStatus(input)}
    WHERE id = ${offerId} AND user_id = ${userId}
    RETURNING *
  `;

  if (!rows[0]) {
    throw new Error("Offer 不存在");
  }

  return toOfferRecord(rows[0]);
}

export async function deleteOffer(userId: number, offerId: number) {
  await ensureDatabaseReady();
  const sql = getSql();
  const rows = await sql<{ id: number }[]>`
    DELETE FROM offers
    WHERE id = ${offerId} AND user_id = ${userId}
    RETURNING id
  `;

  return Boolean(rows[0]);
}

export async function listLinkSwapTasks(userId: number): Promise<LinkSwapTaskRecord[]> {
  await ensureDatabaseReady();
  const sql = getSql();
  const rows = await sql<DbRow[]>`
    SELECT
      id,
      user_id,
      offer_id,
      enabled,
      interval_minutes,
      duration_days,
      mode,
      google_customer_id,
      google_campaign_id,
      status,
      consecutive_failures,
      last_run_at,
      next_run_at
    FROM link_swap_tasks
    WHERE user_id = ${userId}
    ORDER BY id DESC
  `;

  return rows.map(toLinkSwapTaskRecord);
}

export async function getLinkSwapTaskByOfferId(userId: number, offerId: number) {
  await ensureDatabaseReady();
  const sql = getSql();
  const rows = await sql<DbRow[]>`
    SELECT
      id,
      user_id,
      offer_id,
      enabled,
      interval_minutes,
      duration_days,
      mode,
      google_customer_id,
      google_campaign_id,
      status,
      consecutive_failures,
      last_run_at,
      next_run_at
    FROM link_swap_tasks
    WHERE user_id = ${userId}
      AND offer_id = ${offerId}
    LIMIT 1
  `;

  return rows[0] ? toLinkSwapTaskRecord(rows[0]) : null;
}

export async function updateLinkSwapTask(
  userId: number,
  offerId: number,
  input: {
    enabled: boolean;
    intervalMinutes: number;
    durationDays: number;
    mode: LinkSwapTaskRecord["mode"];
    googleCustomerId: string | null;
    googleCampaignId: string | null;
  }
) {
  await ensureDatabaseReady();
  const sql = getSql();
  const dbType = getDbType();
  const rows = await sql.unsafe<DbRow[]>(
    `
      UPDATE link_swap_tasks
      SET enabled = ?,
          interval_minutes = ?,
          duration_days = ?,
          mode = ?,
          google_customer_id = ?,
          google_campaign_id = ?,
          status = ?,
          next_run_at = CASE
            WHEN ? THEN ${plusMinutesExpression(input.intervalMinutes, dbType)}
            ELSE NULL
          END
      WHERE user_id = ? AND offer_id = ?
      RETURNING
        id,
        user_id,
        offer_id,
        enabled,
        interval_minutes,
        duration_days,
        mode,
        google_customer_id,
        google_campaign_id,
        status,
        consecutive_failures,
        last_run_at,
        next_run_at
    `,
    [
      booleanValue(input.enabled, dbType),
      input.intervalMinutes,
      input.durationDays,
      input.mode,
      input.googleCustomerId,
      input.googleCampaignId,
      input.enabled ? "ready" : "idle",
      booleanValue(input.enabled, dbType),
      userId,
      offerId
    ]
  );

  if (!rows[0]) {
    throw new Error("换链接任务不存在");
  }

  return toLinkSwapTaskRecord(rows[0]);
}

export async function listLinkSwapRuns(userId: number): Promise<LinkSwapRunRecord[]> {
  await ensureDatabaseReady();
  const sql = getSql();
  const rows = await sql<DbRow[]>`
    SELECT runs.*
    FROM link_swap_runs runs
    JOIN offers ON offers.id = runs.offer_id
    WHERE offers.user_id = ${userId}
    ORDER BY runs.created_at DESC
    LIMIT 50
  `;

  return rows.map((row) => ({
    id: Number(row.id),
    taskId: Number(row.task_id),
    offerId: Number(row.offer_id),
    rawUrl: String(row.raw_url),
    resolvedUrl: row.resolved_url ? String(row.resolved_url) : null,
    resolvedSuffix: row.resolved_suffix ? String(row.resolved_suffix) : null,
    proxyUrl: row.proxy_url ? String(row.proxy_url) : null,
    status: String(row.status) as LinkSwapRunRecord["status"],
    applyStatus: String(row.apply_status || "not_applicable") as LinkSwapRunRecord["applyStatus"],
    applyErrorMessage: row.apply_error_message ? String(row.apply_error_message) : null,
    errorMessage: row.error_message ? String(row.error_message) : null,
    createdAt: String(row.created_at)
  }));
}

export async function getSettings(userId: number | null, category?: string) {
  await ensureDatabaseReady();
  const sql = getSql();
  const rows = await sql<DbRow[]>`
    SELECT *
    FROM system_settings
    WHERE (user_id = ${userId} OR user_id IS NULL)
      AND (${category ?? null} IS NULL OR category = ${category ?? null})
    ORDER BY CASE WHEN user_id IS NULL THEN 0 ELSE 1 END, category, key
  `;

  return rows.map((row) => ({
    category: String(row.category),
    key: String(row.key),
    value:
      row.is_sensitive
        ? decryptText(row.encrypted_value ? String(row.encrypted_value) : null)
        : row.value
          ? String(row.value)
          : "",
    isSensitive: Boolean(row.is_sensitive)
  }));
}

export async function saveSettings(
  userId: number | null,
  updates: Array<{
    category: string;
    key: string;
    value: string;
    isSensitive?: boolean;
  }>
) {
  await ensureDatabaseReady();
  const sql = getSql();
  const dbType = getDbType();

  for (const update of updates) {
    const encryptedValue = update.isSensitive ? encryptText(update.value) : null;
    if (userId === null) {
      const updated = await sql<{ id: number }[]>`
        UPDATE system_settings
        SET value = ${update.isSensitive ? null : update.value},
            encrypted_value = ${encryptedValue},
            is_sensitive = ${booleanValue(update.isSensitive ?? false, dbType)},
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id IS NULL
          AND category = ${update.category}
          AND key = ${update.key}
        RETURNING id
      `;

      if (!updated[0]) {
        await sql`
          INSERT INTO system_settings (
            user_id,
            category,
            key,
            value,
            encrypted_value,
            is_sensitive,
            updated_at
          )
          VALUES (
            NULL,
            ${update.category},
            ${update.key},
            ${update.isSensitive ? null : update.value},
            ${encryptedValue},
            ${booleanValue(update.isSensitive ?? false, dbType)},
            CURRENT_TIMESTAMP
          )
        `;
      }

      continue;
    }

    await sql`
      INSERT INTO system_settings (
        user_id,
        category,
        key,
        value,
        encrypted_value,
        is_sensitive,
        updated_at
      )
      VALUES (
        ${userId},
        ${update.category},
        ${update.key},
        ${update.isSensitive ? null : update.value},
        ${encryptedValue},
        ${booleanValue(update.isSensitive ?? false, dbType)},
        CURRENT_TIMESTAMP
      )
      ON CONFLICT (user_id, category, key)
      DO UPDATE SET
        value = EXCLUDED.value,
        encrypted_value = EXCLUDED.encrypted_value,
        is_sensitive = EXCLUDED.is_sensitive,
        updated_at = CURRENT_TIMESTAMP
    `;
  }
}

export async function getOrCreateScriptToken(userId: number) {
  await ensureDatabaseReady();
  const sql = getSql();
  const existing = await sql<{ token: string }[]>`
    SELECT token FROM script_tokens WHERE user_id = ${userId} LIMIT 1
  `;

  if (existing[0]) return existing[0].token;

  const token = randomUUID();
  await sql`
    INSERT INTO script_tokens (user_id, token)
    VALUES (${userId}, ${token})
  `;

  return token;
}

export async function rotateScriptToken(userId: number) {
  await ensureDatabaseReady();
  const sql = getSql();
  const token = randomUUID();
  await sql`
    INSERT INTO script_tokens (user_id, token)
    VALUES (${userId}, ${token})
    ON CONFLICT (user_id)
    DO UPDATE SET token = EXCLUDED.token
  `;
  return token;
}

export async function getScriptTokenOwnerId(token: string) {
  await ensureDatabaseReady();
  const sql = getSql();
  const rows = await sql<{ user_id: number }[]>`
    SELECT user_id
    FROM script_tokens
    WHERE token = ${token}
    LIMIT 1
  `;

  return rows[0]?.user_id ?? null;
}

export async function getScriptSnapshot(token: string, campaignLabel?: string) {
  await ensureDatabaseReady();
  const sql = getSql();
  const rows = await sql<DbRow[]>`
    SELECT
      tasks.id AS task_id,
      offers.id AS offer_id,
      offers.user_id,
      offers.brand_name,
      offers.campaign_label,
      offers.target_country,
      offers.latest_resolved_url,
      offers.latest_resolved_suffix,
      offers.last_resolved_at
    FROM script_tokens scripts
    JOIN offers ON offers.user_id = scripts.user_id
    JOIN link_swap_tasks tasks ON tasks.offer_id = offers.id
    WHERE scripts.token = ${token}
      AND tasks.enabled = TRUE
      AND tasks.mode = ${"script"}
      AND (${campaignLabel ?? null} IS NULL OR offers.campaign_label = ${campaignLabel ?? null})
    ORDER BY offers.id DESC
  `;

  return rows;
}

export async function getDueLinkSwapTasks() {
  await ensureDatabaseReady();
  const sql = getSql();
  return sql<DbRow[]>`
    SELECT
      tasks.id,
      tasks.user_id,
      tasks.offer_id,
      tasks.interval_minutes,
      tasks.duration_days,
      tasks.mode,
      tasks.google_customer_id,
      tasks.google_campaign_id,
      offers.promo_link,
      offers.brand_name,
      offers.target_country
    FROM link_swap_tasks tasks
    JOIN offers ON offers.id = tasks.offer_id
    WHERE tasks.enabled = TRUE
      AND (tasks.next_run_at IS NULL OR tasks.next_run_at <= CURRENT_TIMESTAMP)
    ORDER BY tasks.id ASC
  `;
}

export async function getProxyUrls(userId: number, targetCountry?: string) {
  const settings = await getSettings(userId, "proxy");
  const raw = settings.find((item) => item.key === "proxy_urls")?.value || "[]";
  const entries = normalizeProxyEntries(raw);
  const country = String(targetCountry || "").trim().toUpperCase();

  if (!country) {
    return entries.filter((entry) => entry.active).map((entry) => entry.url);
  }

  const matched = entries.filter((entry) => entry.active && entry.country === country);
  const fallbacks = entries.filter((entry) => entry.active && entry.country === "GLOBAL");
  return [...matched, ...fallbacks].map((entry) => entry.url);
}

export async function saveLinkSwapRun(input: {
  taskId: number;
  offerId: number;
  rawUrl: string;
  resolvedUrl: string | null;
  resolvedSuffix: string | null;
  proxyUrl: string | null;
  status: "success" | "failed";
  applyStatus: LinkSwapRunRecord["applyStatus"];
  applyErrorMessage: string | null;
  errorMessage: string | null;
  intervalMinutes: number;
}) {
  await ensureDatabaseReady();
  const sql = getSql();
  const dbType = getDbType();

  await sql`
    INSERT INTO link_swap_runs (
      task_id,
      offer_id,
      raw_url,
      resolved_url,
      resolved_suffix,
      proxy_url,
      status,
      apply_status,
      apply_error_message,
      error_message
    )
    VALUES (
      ${input.taskId},
      ${input.offerId},
      ${input.rawUrl},
      ${input.resolvedUrl},
      ${input.resolvedSuffix},
      ${input.proxyUrl},
      ${input.status},
      ${input.applyStatus},
      ${input.applyErrorMessage},
      ${input.errorMessage}
    )
  `;

  if (input.resolvedUrl && input.resolvedSuffix) {
    await sql`
      UPDATE offers
      SET latest_resolved_url = ${input.resolvedUrl},
          latest_resolved_suffix = ${input.resolvedSuffix},
          last_resolved_at = CURRENT_TIMESTAMP
      WHERE id = ${input.offerId}
    `;
  }

  await sql.unsafe(
    `
      UPDATE link_swap_tasks
      SET status = CASE
            WHEN ? THEN 'ready'
            WHEN consecutive_failures + 1 >= 3 THEN 'warning'
            ELSE 'error'
          END,
          consecutive_failures = CASE
            WHEN ? THEN 0
            ELSE consecutive_failures + 1
          END,
          last_run_at = CURRENT_TIMESTAMP,
          next_run_at = ${plusMinutesExpression(input.intervalMinutes, dbType)}
      WHERE id = ?
    `,
    [
      booleanValue(input.status === "success", dbType),
      booleanValue(input.status === "success", dbType),
      input.taskId
    ]
  );
}

export async function ensureLinkSwapTask(userId: number, offerId: number) {
  const sql = getSql();
  const dbType = getDbType();
  await sql`
    INSERT INTO link_swap_tasks (
      user_id,
      offer_id,
      enabled,
      interval_minutes,
      duration_days,
      mode,
      status,
      next_run_at
    )
    VALUES (
      ${userId},
      ${offerId},
      ${booleanValue(true, dbType)},
      60,
      -1,
      ${"script"},
      'ready',
      CURRENT_TIMESTAMP
    )
    ON CONFLICT (offer_id) DO NOTHING
  `;
}

function toAccountRecord(row: DbRow): CashbackAccount {
  return {
    id: Number(row.id),
    userId: Number(row.user_id),
    platformCode: String(row.platform_code) as CashbackAccount["platformCode"],
    accountName: String(row.account_name),
    registerEmail: String(row.register_email),
    payoutMethod: String(row.payout_method) as CashbackAccount["payoutMethod"],
    notes: row.notes ? String(row.notes) : null,
    status: String(row.status) as CashbackAccount["status"],
    createdAt: String(row.created_at)
  };
}

function computeOfferStatus(input: {
  commissionCapUsd: number;
  manualRecordedCommissionUsd: number;
}) {
  return input.manualRecordedCommissionUsd >= input.commissionCapUsd ? "warning" : "active";
}

function normalizeProxyEntries(raw: string): ProxySettingEntry[] {
  try {
    const parsed = JSON.parse(raw) as Array<string | Record<string, unknown>>;

    return parsed
      .map((entry, index) => {
        if (typeof entry === "string") {
          return {
            label: `Proxy ${index + 1}`,
            country: "GLOBAL",
            url: entry,
            active: true
          };
        }

        const url = String(entry.url || "").trim();
        if (!url) {
          return null;
        }

        return {
          label: String(entry.label || `Proxy ${index + 1}`),
          country: String(entry.country || "GLOBAL").trim().toUpperCase(),
          url,
          active: entry.active === false ? false : true
        };
      })
      .filter((entry): entry is ProxySettingEntry => Boolean(entry));
  } catch {
    return [];
  }
}

function toOfferRecord(row: DbRow): OfferRecord {
  return {
    id: Number(row.id),
    userId: Number(row.user_id),
    platformCode: String(row.platform_code) as OfferRecord["platformCode"],
    cashbackAccountId: Number(row.cashback_account_id),
    promoLink: String(row.promo_link),
    targetCountry: String(row.target_country),
    brandName: String(row.brand_name),
    campaignLabel: String(row.campaign_label),
    commissionCapUsd: Number(row.commission_cap_usd),
    manualRecordedCommissionUsd: Number(row.manual_recorded_commission_usd),
    latestResolvedUrl: row.latest_resolved_url ? String(row.latest_resolved_url) : null,
    latestResolvedSuffix: row.latest_resolved_suffix ? String(row.latest_resolved_suffix) : null,
    lastResolvedAt: row.last_resolved_at ? String(row.last_resolved_at) : null,
    status: String(row.status) as OfferRecord["status"],
    createdAt: String(row.created_at)
  };
}

function toLinkSwapTaskRecord(row: DbRow): LinkSwapTaskRecord {
  return {
    id: Number(row.id),
    userId: Number(row.user_id),
    offerId: Number(row.offer_id),
    enabled: Boolean(row.enabled),
    intervalMinutes: Number(row.interval_minutes),
    durationDays: Number(row.duration_days ?? -1),
    mode: String(row.mode || "script") as LinkSwapTaskRecord["mode"],
    googleCustomerId: row.google_customer_id ? String(row.google_customer_id) : null,
    googleCampaignId: row.google_campaign_id ? String(row.google_campaign_id) : null,
    status: String(row.status) as LinkSwapTaskRecord["status"],
    consecutiveFailures: Number(row.consecutive_failures),
    lastRunAt: row.last_run_at ? String(row.last_run_at) : null,
    nextRunAt: row.next_run_at ? String(row.next_run_at) : null
  };
}
