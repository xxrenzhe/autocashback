import { getDbType, getSql } from "./client";
import { ensureDatabaseReady } from "./schema";
import { countAsInt } from "./sql-helpers";

type DbRow = Record<string, unknown>;

type ProxySettingEntry = {
  label: string;
  country: string;
  url: string;
  active: boolean;
};

function parseProxyEntries(raw: string | null | undefined): ProxySettingEntry[] {
  if (!raw) {
    return [];
  }

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

        return {
          label: String(entry.label || `Proxy ${index + 1}`),
          country: String(entry.country || "GLOBAL").toUpperCase(),
          url: String(entry.url || ""),
          active: entry.active === false ? false : true
        };
      })
      .filter((entry) => entry.url.trim().length > 0);
  } catch {
    return [];
  }
}

export async function getAdminUrlSwapStats() {
  await ensureDatabaseReady();
  const sql = getSql();
  const dbType = getDbType();
  const [rows] = await sql.unsafe<{
    total_tasks: number;
    enabled_tasks: number;
    google_ads_mode_tasks: number;
    script_mode_tasks: number;
    errored_tasks: number;
    due_tasks: number;
    success_rate: number;
  }[]>(
    `
      SELECT
        ${countAsInt("COUNT(*)", dbType)} AS total_tasks,
        SUM(CASE WHEN enabled = ${dbType === "postgres" ? "TRUE" : "1"} THEN 1 ELSE 0 END) AS enabled_tasks,
        SUM(CASE WHEN mode = 'google_ads_api' THEN 1 ELSE 0 END) AS google_ads_mode_tasks,
        SUM(CASE WHEN mode = 'script' THEN 1 ELSE 0 END) AS script_mode_tasks,
        SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) AS errored_tasks,
        SUM(CASE WHEN enabled = ${dbType === "postgres" ? "TRUE" : "1"} AND next_run_at IS NOT NULL AND next_run_at <= CURRENT_TIMESTAMP THEN 1 ELSE 0 END) AS due_tasks,
        COALESCE((
          SELECT ROUND(100.0 * SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) / NULLIF(COUNT(*), 0), 2)
          FROM link_swap_runs
          WHERE created_at >= ${dbType === "postgres" ? "CURRENT_TIMESTAMP - INTERVAL '24 hours'" : "datetime('now', '-24 hours')"}
        ), 0) AS success_rate
      FROM link_swap_tasks
    `
  );

  return {
    totalTasks: Number(rows?.total_tasks || 0),
    enabledTasks: Number(rows?.enabled_tasks || 0),
    googleAdsModeTasks: Number(rows?.google_ads_mode_tasks || 0),
    scriptModeTasks: Number(rows?.script_mode_tasks || 0),
    erroredTasks: Number(rows?.errored_tasks || 0),
    dueTasks: Number(rows?.due_tasks || 0),
    recentSuccessRate: Number(rows?.success_rate || 0)
  };
}

export async function getAdminUrlSwapHealth() {
  await ensureDatabaseReady();
  const sql = getSql();
  const dbType = getDbType();
  const [rows] = await sql.unsafe<{
    stale_running_tasks: number;
    high_failure_tasks: number;
    missing_resolved_url_offers: number;
  }[]>(
    `
      SELECT
        SUM(
          CASE
            WHEN status IN ('ready', 'warning')
             AND last_run_at IS NOT NULL
             AND last_run_at <= ${dbType === "postgres" ? "CURRENT_TIMESTAMP - INTERVAL '2 hours'" : "datetime('now', '-2 hours')"}
            THEN 1 ELSE 0
          END
        ) AS stale_running_tasks,
        SUM(CASE WHEN consecutive_failures >= 3 THEN 1 ELSE 0 END) AS high_failure_tasks,
        (
          SELECT ${countAsInt("COUNT(*)", dbType)}
          FROM offers
          WHERE status <> 'draft'
            AND (latest_resolved_url IS NULL OR latest_resolved_url = '')
        ) AS missing_resolved_url_offers
      FROM link_swap_tasks
    `
  );

  return {
    staleRunningTasks: Number(rows?.stale_running_tasks || 0),
    highFailureTasks: Number(rows?.high_failure_tasks || 0),
    missingResolvedUrlOffers: Number(rows?.missing_resolved_url_offers || 0)
  };
}

export async function getAdminClickFarmStats() {
  await ensureDatabaseReady();
  const sql = getSql();
  const [rows] = await sql.unsafe<{
    total_tasks: number;
    active_tasks: number;
    paused_tasks: number;
    total_clicks: number;
    success_clicks: number;
    failed_clicks: number;
  }[]>(
    `
      SELECT
        COUNT(*) AS total_tasks,
        SUM(CASE WHEN is_deleted = ${getDbType() === "postgres" ? "FALSE" : "0"} AND status IN ('pending', 'running') THEN 1 ELSE 0 END) AS active_tasks,
        SUM(CASE WHEN is_deleted = ${getDbType() === "postgres" ? "FALSE" : "0"} AND status = 'paused' THEN 1 ELSE 0 END) AS paused_tasks,
        SUM(CASE WHEN is_deleted = ${getDbType() === "postgres" ? "FALSE" : "0"} THEN total_clicks ELSE 0 END) AS total_clicks,
        SUM(CASE WHEN is_deleted = ${getDbType() === "postgres" ? "FALSE" : "0"} THEN success_clicks ELSE 0 END) AS success_clicks,
        SUM(CASE WHEN is_deleted = ${getDbType() === "postgres" ? "FALSE" : "0"} THEN failed_clicks ELSE 0 END) AS failed_clicks
      FROM click_farm_tasks
    `
  );

  const totalClicks = Number(rows?.total_clicks || 0);
  const successClicks = Number(rows?.success_clicks || 0);

  return {
    totalTasks: Number(rows?.total_tasks || 0),
    activeTasks: Number(rows?.active_tasks || 0),
    pausedTasks: Number(rows?.paused_tasks || 0),
    totalClicks,
    successClicks,
    failedClicks: Number(rows?.failed_clicks || 0),
    successRate: totalClicks > 0 ? Number(((successClicks / totalClicks) * 100).toFixed(2)) : 0
  };
}

export async function listAdminClickFarmTasks(input?: { page?: number; limit?: number }) {
  await ensureDatabaseReady();
  const sql = getSql();
  const page = Math.max(1, Number(input?.page || 1));
  const limit = Math.max(1, Math.min(100, Number(input?.limit || 20)));
  const offset = (page - 1) * limit;
  const dbType = getDbType();
  const activeFalse = dbType === "postgres" ? "FALSE" : "0";

  const rows = await sql.unsafe<DbRow[]>(
    `
      SELECT
        tasks.*,
        users.username,
        offers.brand_name
      FROM click_farm_tasks tasks
      JOIN users ON users.id = tasks.user_id
      JOIN offers ON offers.id = tasks.offer_id
      WHERE tasks.is_deleted = ${activeFalse}
      ORDER BY tasks.updated_at DESC, tasks.id DESC
      LIMIT ? OFFSET ?
    `,
    [limit, offset]
  );

  const countRows = await sql.unsafe<{ count: number }[]>(
    `
      SELECT ${countAsInt("COUNT(*)", dbType)} AS count
      FROM click_farm_tasks
      WHERE is_deleted = ${activeFalse}
    `
  );

  return {
    tasks: rows.map((row) => ({
      id: Number(row.id),
      userId: Number(row.user_id),
      username: String(row.username || ""),
      offerId: Number(row.offer_id),
      brandName: String(row.brand_name || ""),
      status: String(row.status || ""),
      progress: Number(row.progress || 0),
      totalClicks: Number(row.total_clicks || 0),
      successClicks: Number(row.success_clicks || 0),
      failedClicks: Number(row.failed_clicks || 0),
      nextRunAt: row.next_run_at ? String(row.next_run_at) : null,
      updatedAt: String(row.updated_at || "")
    })),
    total: Number(countRows[0]?.count || 0),
    page,
    limit
  };
}

export async function getAdminProxyHealth() {
  await ensureDatabaseReady();
  const sql = getSql();
  const rows = await sql<{
    user_id: number;
    username: string;
    value: string | null;
  }[]>`
    SELECT settings.user_id, users.username, settings.value
    FROM system_settings settings
    JOIN users ON users.id = settings.user_id
    WHERE settings.category = ${"proxy"}
      AND settings.key = ${"proxy_urls"}
      AND settings.user_id IS NOT NULL
    ORDER BY users.username ASC
  `;

  const byCountry = new Map<string, { total: number; active: number }>();
  const users = rows.map((row) => {
    const entries = parseProxyEntries(row.value);
    for (const entry of entries) {
      const current = byCountry.get(entry.country) || { total: 0, active: 0 };
      current.total += 1;
      current.active += entry.active ? 1 : 0;
      byCountry.set(entry.country, current);
    }

    return {
      userId: Number(row.user_id),
      username: String(row.username),
      totalProxies: entries.length,
      activeProxies: entries.filter((entry) => entry.active).length,
      countries: Array.from(new Set(entries.map((entry) => entry.country))).sort()
    };
  });

  return {
    users,
    summary: {
      usersWithProxyConfig: users.length,
      totalProxies: users.reduce((sum, item) => sum + item.totalProxies, 0),
      activeProxies: users.reduce((sum, item) => sum + item.activeProxies, 0),
      countries: Array.from(byCountry.entries())
        .sort((left, right) => left[0].localeCompare(right[0]))
        .map(([country, item]) => ({
          country,
          total: item.total,
          active: item.active
        }))
    }
  };
}
