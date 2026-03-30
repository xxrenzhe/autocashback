import { randomUUID } from "node:crypto";

import type {
  CashbackAccount,
  DashboardSummary,
  LinkSwapRunRecord,
  LinkSwapTaskRecord,
  OfferRecord
} from "@autocashback/domain";

import { getSql } from "./client";
import { decryptText, encryptText } from "./crypto";
import { ensureDatabaseReady } from "./schema";

type DbRow = Record<string, unknown>;

export async function getDashboardSummary(userId: number): Promise<DashboardSummary> {
  await ensureDatabaseReady();
  const sql = getSql();
  const [counts] = await sql<{
    active_offers: number;
    active_tasks: number;
    warning_offers: number;
    success_rate: number;
  }[]>`
    SELECT
      (SELECT COUNT(*)::int FROM offers WHERE user_id = ${userId} AND status <> 'draft') AS active_offers,
      (SELECT COUNT(*)::int FROM link_swap_tasks WHERE user_id = ${userId} AND enabled = TRUE) AS active_tasks,
      (SELECT COUNT(*)::int FROM offers WHERE user_id = ${userId} AND manual_recorded_commission_usd >= commission_cap_usd) AS warning_offers,
      COALESCE((
        SELECT ROUND(
          100.0 * COUNT(*) FILTER (WHERE status = 'success') / NULLIF(COUNT(*), 0),
          2
        )
        FROM link_swap_runs
        WHERE offer_id IN (SELECT id FROM offers WHERE user_id = ${userId})
      ), 0) AS success_rate
  `;

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
      ${input.manualRecordedCommissionUsd >= input.commissionCapUsd ? "warning" : "active"}
    )
    RETURNING *
  `;

  const offer = rows[0];
  await ensureLinkSwapTask(userId, Number(offer.id));
  return toOfferRecord(offer);
}

export async function listLinkSwapTasks(userId: number): Promise<LinkSwapTaskRecord[]> {
  await ensureDatabaseReady();
  const sql = getSql();
  const rows = await sql<DbRow[]>`
    SELECT id, user_id, offer_id, enabled, interval_minutes, status, consecutive_failures, last_run_at, next_run_at
    FROM link_swap_tasks
    WHERE user_id = ${userId}
    ORDER BY id DESC
  `;

  return rows.map((row) => ({
    id: Number(row.id),
    userId: Number(row.user_id),
    offerId: Number(row.offer_id),
    enabled: Boolean(row.enabled),
    intervalMinutes: Number(row.interval_minutes),
    status: String(row.status) as LinkSwapTaskRecord["status"],
    consecutiveFailures: Number(row.consecutive_failures),
    lastRunAt: row.last_run_at ? String(row.last_run_at) : null,
    nextRunAt: row.next_run_at ? String(row.next_run_at) : null
  }));
}

export async function updateLinkSwapTask(
  userId: number,
  offerId: number,
  input: { enabled: boolean; intervalMinutes: number }
) {
  await ensureDatabaseReady();
  const sql = getSql();
  const rows = await sql<DbRow[]>`
    UPDATE link_swap_tasks
    SET enabled = ${input.enabled},
        interval_minutes = ${input.intervalMinutes},
        next_run_at = NOW() + (${input.intervalMinutes} || ' minutes')::interval
    WHERE user_id = ${userId} AND offer_id = ${offerId}
    RETURNING id, user_id, offer_id, enabled, interval_minutes, status, consecutive_failures, last_run_at, next_run_at
  `;

  return rows[0];
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
      AND (${category ?? null}::text IS NULL OR category = ${category ?? null})
    ORDER BY user_id NULLS FIRST, category, key
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

  for (const update of updates) {
    const encryptedValue = update.isSensitive ? encryptText(update.value) : null;
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
        ${update.isSensitive ?? false},
        NOW()
      )
      ON CONFLICT (user_id, category, key)
      DO UPDATE SET
        value = EXCLUDED.value,
        encrypted_value = EXCLUDED.encrypted_value,
        is_sensitive = EXCLUDED.is_sensitive,
        updated_at = NOW()
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
      AND (${campaignLabel ?? null}::text IS NULL OR offers.campaign_label = ${campaignLabel ?? null})
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
      offers.promo_link,
      offers.brand_name
    FROM link_swap_tasks tasks
    JOIN offers ON offers.id = tasks.offer_id
    WHERE tasks.enabled = TRUE
      AND (tasks.next_run_at IS NULL OR tasks.next_run_at <= NOW())
    ORDER BY tasks.id ASC
  `;
}

export async function getProxyUrls(userId: number) {
  const settings = await getSettings(userId, "proxy");
  const raw = settings.find((item) => item.key === "proxy_urls")?.value || "[]";

  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

export async function saveLinkSwapRun(input: {
  taskId: number;
  offerId: number;
  rawUrl: string;
  resolvedUrl: string | null;
  resolvedSuffix: string | null;
  proxyUrl: string | null;
  status: "success" | "failed";
  errorMessage: string | null;
  intervalMinutes: number;
}) {
  await ensureDatabaseReady();
  const sql = getSql();

  await sql`
    INSERT INTO link_swap_runs (
      task_id,
      offer_id,
      raw_url,
      resolved_url,
      resolved_suffix,
      proxy_url,
      status,
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
      ${input.errorMessage}
    )
  `;

  await sql`
    UPDATE offers
    SET latest_resolved_url = ${input.resolvedUrl},
        latest_resolved_suffix = ${input.resolvedSuffix},
        last_resolved_at = NOW()
    WHERE id = ${input.offerId}
  `;

  await sql`
    UPDATE link_swap_tasks
    SET status = ${input.status === "success" ? "ready" : "error"},
        consecutive_failures = CASE
          WHEN ${input.status === "success"} THEN 0
          ELSE consecutive_failures + 1
        END,
        last_run_at = NOW(),
        next_run_at = NOW() + (${input.intervalMinutes} || ' minutes')::interval
    WHERE id = ${input.taskId}
  `;
}

export async function ensureLinkSwapTask(userId: number, offerId: number) {
  const sql = getSql();
  await sql`
    INSERT INTO link_swap_tasks (user_id, offer_id, enabled, interval_minutes, status, next_run_at)
    VALUES (${userId}, ${offerId}, TRUE, 60, 'ready', NOW())
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
