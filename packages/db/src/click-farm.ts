import type { ClickFarmTask, ClickFarmTaskStatus } from "@autocashback/domain";
import { getTimezoneForCountry } from "@autocashback/domain";

import { getSql } from "./client";
import { removePendingClickFarmQueueTasksByTaskIds } from "./queue-cleanup";
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

function getFormatter(timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
}

function getLocalParts(date: Date, timeZone: string) {
  const parts = getFormatter(timeZone).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(values.year || 0),
    month: Number(values.month || 0),
    day: Number(values.day || 0),
    hour: Number(values.hour || 0),
    minute: Number(values.minute || 0),
    second: Number(values.second || 0)
  };
}

function getLocalDateString(date: Date, timeZone: string) {
  const parts = getLocalParts(date, timeZone);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map((item) => Number(item || 0));
  return hours * 60 + minutes;
}

function createDateInTimezone(dateStr: string, timeStr: string, timeZone: string) {
  const [year, month, day] = dateStr.split("-").map((item) => Number(item || 0));
  const [hour, minute] = timeStr.split(":").map((item) => Number(item || 0));
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const parts = getLocalParts(utcGuess, timeZone);
  const interpretedUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );
  const desiredUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  return new Date(utcGuess.getTime() + (desiredUtc - interpretedUtc));
}

function getFirstScheduledHour(startTime: string, hourlyDistribution: number[]) {
  const startHour = Math.max(0, Math.min(23, Math.floor(timeToMinutes(startTime) / 60)));
  const firstActiveHour = Array.isArray(hourlyDistribution)
    ? hourlyDistribution.findIndex((count) => Number(count || 0) > 0)
    : -1;

  return firstActiveHour === -1 ? startHour : Math.max(startHour, firstActiveHour);
}

function calculateClickFarmNextRunAt(input: {
  scheduledStartDate: string;
  startTime: string;
  hourlyDistribution: number[];
  timezone: string;
  now?: Date;
}) {
  const now = input.now || new Date();
  const todayInTaskTimezone = getLocalDateString(now, input.timezone);
  const currentLocal = getLocalParts(now, input.timezone);
  const currentLocalMinutes = currentLocal.hour * 60 + currentLocal.minute;
  const firstScheduledHour = getFirstScheduledHour(input.startTime, input.hourlyDistribution);
  const firstScheduledMinutes = firstScheduledHour * 60;

  if (input.scheduledStartDate > todayInTaskTimezone) {
    return createDateInTimezone(
      input.scheduledStartDate,
      `${String(firstScheduledHour).padStart(2, "0")}:00`,
      input.timezone
    ).toISOString();
  }

  if (
    input.scheduledStartDate === todayInTaskTimezone &&
    currentLocalMinutes < firstScheduledMinutes
  ) {
    return createDateInTimezone(
      input.scheduledStartDate,
      `${String(firstScheduledHour).padStart(2, "0")}:00`,
      input.timezone
    ).toISOString();
  }

  return now.toISOString();
}

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
  const nextRunAt = calculateClickFarmNextRunAt({
    scheduledStartDate: input.scheduledStartDate,
    startTime: input.startTime,
    hourlyDistribution: input.hourlyDistribution,
    timezone
  });
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
      ${nextRunAt}
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
  const nextRunAt = calculateClickFarmNextRunAt({
    scheduledStartDate: input.scheduledStartDate,
    startTime: input.startTime,
    hourlyDistribution: input.hourlyDistribution,
    timezone
  });
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
        next_run_at = ${nextRunAt},
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ${taskId}
      AND user_id = ${userId}
      AND is_deleted = FALSE
    RETURNING *
  `;

  if (!rows[0]) {
    throw new Error("补点击任务不存在");
  }

  await removePendingClickFarmQueueTasksByTaskIds([taskId], userId);

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

  await removePendingClickFarmQueueTasksByTaskIds([taskId], userId);

  return toClickFarmTask(rows[0]);
}

export async function restartClickFarmTask(userId: number, taskId: number) {
  await ensureDatabaseReady();
  const sql = getSql();
  const existingRows = await sql<DbRow[]>`
    SELECT scheduled_start_date, start_time, hourly_distribution, timezone
    FROM click_farm_tasks
    WHERE id = ${taskId}
      AND user_id = ${userId}
      AND is_deleted = FALSE
    LIMIT 1
  `;
  const existing = existingRows[0];
  const nextRunAt = existing
    ? calculateClickFarmNextRunAt({
        scheduledStartDate: String(existing.scheduled_start_date),
        startTime: String(existing.start_time),
        hourlyDistribution: parseJsonArray<number[]>(existing.hourly_distribution, []),
        timezone: String(existing.timezone || "UTC")
      })
    : new Date().toISOString();
  const rows = await sql<DbRow[]>`
    UPDATE click_farm_tasks
    SET status = ${"pending"},
        pause_reason = ${null},
        pause_message = ${null},
        paused_at = ${null},
        next_run_at = ${nextRunAt},
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ${taskId}
      AND user_id = ${userId}
      AND is_deleted = FALSE
    RETURNING *
  `;

  if (!rows[0]) {
    throw new Error("补点击任务不存在");
  }

  await removePendingClickFarmQueueTasksByTaskIds([taskId], userId);

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

  if (rows[0]) {
    await removePendingClickFarmQueueTasksByTaskIds([taskId], userId);
  }

  return Boolean(rows[0]);
}

export async function deleteClickFarmTasksByOffer(userId: number, offerId: number) {
  await ensureDatabaseReady();
  const sql = getSql();
  const taskRows = await sql<{ id: number }[]>`
    SELECT id
    FROM click_farm_tasks
    WHERE user_id = ${userId}
      AND offer_id = ${offerId}
      AND is_deleted = FALSE
  `;

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

  await removePendingClickFarmQueueTasksByTaskIds(
    taskRows.map((row) => row.id),
    userId
  );
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

  await removePendingClickFarmQueueTasksByTaskIds([taskId]);
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

  await removePendingClickFarmQueueTasksByTaskIds([taskId]);
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
