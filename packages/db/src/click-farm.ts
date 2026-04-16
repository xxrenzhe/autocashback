import type { ClickFarmTask, ClickFarmTaskStatus } from "@autocashback/domain";
import { getTimezoneForCountry } from "@autocashback/domain";

import { getSql } from "./client";
import { ensureDatabaseReady } from "./schema";

type DbRow = Record<string, unknown>;

type RefererConfig = ClickFarmTask["refererConfig"];

type SaveClickFarmTaskInput = {
  offerId: number;
  dailyClickCount: number;
  startTime: string;
  endTime: string;
  durationDays: number;
  scheduledStartDate: string;
  hourlyDistribution: number[];
  timezone?: string;
  refererConfig?: RefererConfig;
};

type ClickFarmDueTask = ClickFarmTask & {
  promoLink: string;
  targetCountry: string;
  brandName: string;
};

export type ClickFarmExecutionContext = ClickFarmTask & {
  promoLink: string;
  targetCountry: string;
  brandName: string;
};

function parseJsonArray<T>(value: unknown, fallback: T): T {
  if (!value) return fallback;

  try {
    return JSON.parse(String(value)) as T;
  } catch {
    return fallback;
  }
}

function serializeRefererConfig(value?: RefererConfig) {
  return value ? JSON.stringify(value) : null;
}

function parseRefererConfig(value: unknown): RefererConfig {
  if (!value) return null;

  try {
    return JSON.parse(String(value)) as RefererConfig;
  } catch {
    return null;
  }
}

function buildHourlyBreakdown(distribution: number[]) {
  return Array.from({ length: 24 }, (_, hour) => ({
    target: Number(distribution[hour] || 0),
    actual: 0,
    success: 0,
    failed: 0
  }));
}

function toClickFarmTask(row: DbRow): ClickFarmTask {
  const hourlyDistribution = parseJsonArray<number[]>(row.hourly_distribution, []);
  const dailyHistory = parseJsonArray<ClickFarmTask["dailyHistory"]>(row.daily_history, []);

  return {
    id: Number(row.id),
    userId: Number(row.user_id),
    offerId: Number(row.offer_id),
    dailyClickCount: Number(row.daily_click_count),
    startTime: String(row.start_time),
    endTime: String(row.end_time),
    durationDays: Number(row.duration_days),
    scheduledStartDate: String(row.scheduled_start_date),
    hourlyDistribution,
    timezone: String(row.timezone || "UTC"),
    refererConfig: parseRefererConfig(row.referer_config),
    status: String(row.status) as ClickFarmTaskStatus,
    pauseReason: row.pause_reason ? (String(row.pause_reason) as ClickFarmTask["pauseReason"]) : null,
    pauseMessage: row.pause_message ? String(row.pause_message) : null,
    pausedAt: row.paused_at ? String(row.paused_at) : null,
    progress: Number(row.progress || 0),
    totalClicks: Number(row.total_clicks || 0),
    successClicks: Number(row.success_clicks || 0),
    failedClicks: Number(row.failed_clicks || 0),
    dailyHistory,
    startedAt: row.started_at ? String(row.started_at) : null,
    completedAt: row.completed_at ? String(row.completed_at) : null,
    nextRunAt: row.next_run_at ? String(row.next_run_at) : null,
    isDeleted: Boolean(row.is_deleted),
    deletedAt: row.deleted_at ? String(row.deleted_at) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

async function getOfferMetadata(userId: number, offerId: number) {
  const sql = getSql();
  const rows = await sql<DbRow[]>`
    SELECT id, target_country
    FROM offers
    WHERE id = ${offerId} AND user_id = ${userId}
    LIMIT 1
  `;

  return rows[0] || null;
}

export async function listClickFarmTasks(userId: number): Promise<ClickFarmTask[]> {
  await ensureDatabaseReady();
  const sql = getSql();
  const rows = await sql<DbRow[]>`
    SELECT *
    FROM click_farm_tasks
    WHERE user_id = ${userId}
      AND is_deleted = FALSE
    ORDER BY created_at DESC
  `;

  return rows.map(toClickFarmTask);
}

export async function getClickFarmTaskById(userId: number, taskId: number) {
  await ensureDatabaseReady();
  const sql = getSql();
  const rows = await sql<DbRow[]>`
    SELECT *
    FROM click_farm_tasks
    WHERE id = ${taskId}
      AND user_id = ${userId}
      AND is_deleted = FALSE
    LIMIT 1
  `;

  return rows[0] ? toClickFarmTask(rows[0]) : null;
}

export async function getClickFarmTaskByOfferId(userId: number, offerId: number) {
  await ensureDatabaseReady();
  const sql = getSql();
  const rows = await sql<DbRow[]>`
    SELECT *
    FROM click_farm_tasks
    WHERE offer_id = ${offerId}
      AND user_id = ${userId}
      AND is_deleted = FALSE
    ORDER BY created_at DESC
    LIMIT 1
  `;

  return rows[0] ? toClickFarmTask(rows[0]) : null;
}

export async function getClickFarmTaskExecutionContext(userId: number, taskId: number) {
  await ensureDatabaseReady();
  const sql = getSql();
  const rows = await sql<DbRow[]>`
    SELECT
      tasks.*,
      offers.promo_link,
      offers.target_country,
      offers.brand_name
    FROM click_farm_tasks tasks
    JOIN offers ON offers.id = tasks.offer_id
    WHERE tasks.id = ${taskId}
      AND tasks.user_id = ${userId}
      AND tasks.is_deleted = FALSE
    LIMIT 1
  `;

  return rows[0]
    ? ({
        ...toClickFarmTask(rows[0]),
        promoLink: String(rows[0].promo_link),
        targetCountry: String(rows[0].target_country),
        brandName: String(rows[0].brand_name)
      } satisfies ClickFarmExecutionContext)
    : null;
}

export async function createClickFarmTask(userId: number, input: SaveClickFarmTaskInput) {
  await ensureDatabaseReady();
  const sql = getSql();
  const offer = await getOfferMetadata(userId, input.offerId);

  if (!offer) {
    throw new Error("Offer 不存在");
  }

  const timezone = input.timezone || getTimezoneForCountry(String(offer.target_country || ""));
  const dailyHistory = [
    {
      date: input.scheduledStartDate,
      target: input.dailyClickCount,
      actual: 0,
      success: 0,
      failed: 0,
      hourlyBreakdown: buildHourlyBreakdown(input.hourlyDistribution)
    }
  ];

  const rows = await sql<DbRow[]>`
    INSERT INTO click_farm_tasks (
      user_id,
      offer_id,
      daily_click_count,
      start_time,
      end_time,
      duration_days,
      scheduled_start_date,
      hourly_distribution,
      timezone,
      referer_config,
      status,
      progress,
      daily_history,
      next_run_at
    )
    VALUES (
      ${userId},
      ${input.offerId},
      ${input.dailyClickCount},
      ${input.startTime},
      ${input.endTime},
      ${input.durationDays},
      ${input.scheduledStartDate},
      ${JSON.stringify(input.hourlyDistribution)},
      ${timezone},
      ${serializeRefererConfig(input.refererConfig)},
      ${"pending"},
      ${0},
      ${JSON.stringify(dailyHistory)},
      CURRENT_TIMESTAMP
    )
    RETURNING *
  `;

  return toClickFarmTask(rows[0]);
}

export async function updateClickFarmTask(
  userId: number,
  taskId: number,
  input: SaveClickFarmTaskInput
) {
  await ensureDatabaseReady();
  const sql = getSql();
  const offer = await getOfferMetadata(userId, input.offerId);

  if (!offer) {
    throw new Error("Offer 不存在");
  }

  const timezone = input.timezone || getTimezoneForCountry(String(offer.target_country || ""));
  const rows = await sql<DbRow[]>`
    UPDATE click_farm_tasks
    SET offer_id = ${input.offerId},
        daily_click_count = ${input.dailyClickCount},
        start_time = ${input.startTime},
        end_time = ${input.endTime},
        duration_days = ${input.durationDays},
        scheduled_start_date = ${input.scheduledStartDate},
        hourly_distribution = ${JSON.stringify(input.hourlyDistribution)},
        timezone = ${timezone},
        referer_config = ${serializeRefererConfig(input.refererConfig)},
        status = ${"pending"},
        pause_reason = ${null},
        pause_message = ${null},
        paused_at = ${null},
        next_run_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ${taskId}
      AND user_id = ${userId}
      AND is_deleted = FALSE
    RETURNING *
  `;

  if (!rows[0]) {
    throw new Error("补点击任务不存在");
  }

  return toClickFarmTask(rows[0]);
}

export async function stopClickFarmTask(userId: number, taskId: number) {
  await ensureDatabaseReady();
  const sql = getSql();
  const rows = await sql<DbRow[]>`
    UPDATE click_farm_tasks
    SET status = ${"stopped"},
        pause_reason = ${"manual"},
        pause_message = ${"任务已手动暂停"},
        paused_at = CURRENT_TIMESTAMP,
        next_run_at = ${null},
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ${taskId}
      AND user_id = ${userId}
      AND is_deleted = FALSE
    RETURNING *
  `;

  if (!rows[0]) {
    throw new Error("补点击任务不存在");
  }

  return toClickFarmTask(rows[0]);
}

export async function restartClickFarmTask(userId: number, taskId: number) {
  await ensureDatabaseReady();
  const sql = getSql();
  const rows = await sql<DbRow[]>`
    UPDATE click_farm_tasks
    SET status = ${"pending"},
        pause_reason = ${null},
        pause_message = ${null},
        paused_at = ${null},
        next_run_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ${taskId}
      AND user_id = ${userId}
      AND is_deleted = FALSE
    RETURNING *
  `;

  if (!rows[0]) {
    throw new Error("补点击任务不存在");
  }

  return toClickFarmTask(rows[0]);
}

export async function deleteClickFarmTask(userId: number, taskId: number) {
  await ensureDatabaseReady();
  const sql = getSql();
  const rows = await sql<DbRow[]>`
    UPDATE click_farm_tasks
    SET is_deleted = TRUE,
        deleted_at = CURRENT_TIMESTAMP,
        status = ${"stopped"},
        next_run_at = ${null},
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ${taskId}
      AND user_id = ${userId}
      AND is_deleted = FALSE
    RETURNING *
  `;

  return Boolean(rows[0]);
}

export async function deleteClickFarmTasksByOffer(userId: number, offerId: number) {
  await ensureDatabaseReady();
  const sql = getSql();
  await sql`
    UPDATE click_farm_tasks
    SET is_deleted = TRUE,
        deleted_at = CURRENT_TIMESTAMP,
        status = ${"stopped"},
        next_run_at = ${null},
        updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ${userId}
      AND offer_id = ${offerId}
      AND is_deleted = FALSE
  `;
}

export async function getClickFarmStats(userId: number) {
  await ensureDatabaseReady();
  const sql = getSql();
  const rows = await sql<DbRow[]>`
    SELECT
      COUNT(*) AS total_tasks,
      SUM(CASE WHEN status IN ('pending', 'running') THEN 1 ELSE 0 END) AS active_tasks,
      SUM(total_clicks) AS total_clicks,
      SUM(success_clicks) AS success_clicks,
      SUM(failed_clicks) AS failed_clicks
    FROM click_farm_tasks
    WHERE user_id = ${userId}
      AND is_deleted = FALSE
  `;

  return {
    totalTasks: Number(rows[0]?.total_tasks || 0),
    activeTasks: Number(rows[0]?.active_tasks || 0),
    totalClicks: Number(rows[0]?.total_clicks || 0),
    successClicks: Number(rows[0]?.success_clicks || 0),
    failedClicks: Number(rows[0]?.failed_clicks || 0)
  };
}

export async function getDueClickFarmTasks(): Promise<ClickFarmDueTask[]> {
  await ensureDatabaseReady();
  const sql = getSql();
  const rows = await sql<DbRow[]>`
    SELECT
      tasks.*,
      offers.promo_link,
      offers.target_country,
      offers.brand_name
    FROM click_farm_tasks tasks
    JOIN offers ON offers.id = tasks.offer_id
    WHERE tasks.is_deleted = FALSE
      AND tasks.status IN ('pending', 'running')
      AND (tasks.next_run_at IS NULL OR tasks.next_run_at <= CURRENT_TIMESTAMP)
    ORDER BY CASE WHEN tasks.next_run_at IS NULL THEN 0 ELSE 1 END ASC, tasks.next_run_at ASC, tasks.id ASC
  `;

  return rows.map((row) => ({
    ...toClickFarmTask(row),
    promoLink: String(row.promo_link),
    targetCountry: String(row.target_country),
    brandName: String(row.brand_name)
  }));
}

export async function setClickFarmTaskPaused(taskId: number, message: string) {
  await ensureDatabaseReady();
  const sql = getSql();
  await sql`
    UPDATE click_farm_tasks
    SET status = ${"paused"},
        pause_reason = ${"no_proxy"},
        pause_message = ${message},
        paused_at = CURRENT_TIMESTAMP,
        next_run_at = ${null},
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ${taskId}
  `;
}

export async function completeClickFarmTask(taskId: number) {
  await ensureDatabaseReady();
  const sql = getSql();
  await sql`
    UPDATE click_farm_tasks
    SET status = ${"completed"},
        progress = ${100},
        completed_at = CURRENT_TIMESTAMP,
        next_run_at = ${null},
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ${taskId}
  `;
}

export async function recordClickFarmTaskRun(
  taskId: number,
  input: {
    status: ClickFarmTaskStatus;
    totalClicks: number;
    successClicks: number;
    failedClicks: number;
    progress: number;
    dailyHistory: ClickFarmTask["dailyHistory"];
    nextRunAt: string | null;
    pauseReason?: ClickFarmTask["pauseReason"];
    pauseMessage?: string | null;
    pausedAt?: string | null;
    startedAt?: string | null;
    completedAt?: string | null;
  }
) {
  await ensureDatabaseReady();
  const sql = getSql();
  await sql`
    UPDATE click_farm_tasks
    SET status = ${input.status},
        total_clicks = ${input.totalClicks},
        success_clicks = ${input.successClicks},
        failed_clicks = ${input.failedClicks},
        progress = ${input.progress},
        daily_history = ${JSON.stringify(input.dailyHistory)},
        next_run_at = ${input.nextRunAt},
        pause_reason = ${input.pauseReason ?? null},
        pause_message = ${input.pauseMessage ?? null},
        paused_at = ${input.pausedAt ?? null},
        started_at = COALESCE(started_at, ${input.startedAt ?? null}),
        completed_at = ${input.completedAt ?? null},
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ${taskId}
  `;
}
