import { randomUUID } from "node:crypto";

import type {
  QueueStats,
  QueueTaskPriority,
  QueueTaskRecord,
  QueueTaskStatus,
  QueueTaskType
} from "@autocashback/domain";

import { getSql } from "./client";
import { ensureDatabaseReady } from "./schema";

type DbRow = Record<string, unknown>;

function parsePayload(value: unknown) {
  if (!value) {
    return {};
  }

  try {
    return JSON.parse(String(value)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function toQueueTaskRecord(row: DbRow): QueueTaskRecord {
  return {
    id: String(row.id),
    type: String(row.type) as QueueTaskType,
    userId: Number(row.user_id),
    payload: parsePayload(row.payload),
    parentRequestId: row.parent_request_id ? String(row.parent_request_id) : null,
    priority: String(row.priority) as QueueTaskPriority,
    status: String(row.status) as QueueTaskStatus,
    availableAt: String(row.available_at),
    startedAt: row.started_at ? String(row.started_at) : null,
    completedAt: row.completed_at ? String(row.completed_at) : null,
    errorMessage: row.error_message ? String(row.error_message) : null,
    retryCount: Number(row.retry_count || 0),
    maxRetries: Number(row.max_retries || 0),
    workerId: row.worker_id ? String(row.worker_id) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function getPriorityOrderExpression(columnName: string) {
  return `CASE ${columnName}
    WHEN 'high' THEN 1
    WHEN 'normal' THEN 2
    ELSE 3
  END`;
}

export async function enqueueQueueTask(input: {
  id?: string;
  type: QueueTaskType;
  userId: number;
  payload: Record<string, unknown>;
  parentRequestId?: string | null;
  priority?: QueueTaskPriority;
  availableAt?: string;
  maxRetries?: number;
}) {
  await ensureDatabaseReady();
  const sql = getSql();
  const taskId = String(input.id || randomUUID());
  const priority = input.priority || "normal";
  const availableAt = input.availableAt || new Date().toISOString();
  const maxRetries = Number.isFinite(input.maxRetries) ? Number(input.maxRetries) : 0;

  const inserted = await sql<DbRow[]>`
    INSERT INTO unified_queue_tasks (
      id,
      type,
      user_id,
      payload,
      parent_request_id,
      priority,
      status,
      available_at,
      max_retries
    )
    VALUES (
      ${taskId},
      ${input.type},
      ${input.userId},
      ${JSON.stringify(input.payload || {})},
      ${input.parentRequestId ?? null},
      ${priority},
      ${"pending"},
      ${availableAt},
      ${maxRetries}
    )
    ON CONFLICT (id) DO NOTHING
    RETURNING *
  `;

  if (inserted[0]) {
    return toQueueTaskRecord(inserted[0]);
  }

  const existing = await sql<DbRow[]>`
    SELECT *
    FROM unified_queue_tasks
    WHERE id = ${taskId}
    LIMIT 1
  `;

  if (!existing[0]) {
    throw new Error("队列任务入队失败");
  }

  return toQueueTaskRecord(existing[0]);
}

export async function claimNextQueueTask(workerId: string, allowedTypes: QueueTaskType[] = []) {
  await ensureDatabaseReady();
  const sql = getSql();

  const typeFilter = allowedTypes.length
    ? `AND type IN (${allowedTypes.map(() => "?").join(", ")})`
    : "";
  const orderBy = `${getPriorityOrderExpression("priority")} ASC, available_at ASC, created_at ASC`;
  const params = [...allowedTypes, workerId];

  const rows = await sql.unsafe<DbRow[]>(
    `
      WITH candidate AS (
        SELECT id
        FROM unified_queue_tasks
        WHERE status = 'pending'
          AND available_at <= CURRENT_TIMESTAMP
          ${typeFilter}
        ORDER BY ${orderBy}
        LIMIT 1
      )
      UPDATE unified_queue_tasks
      SET status = 'running',
          started_at = CURRENT_TIMESTAMP,
          worker_id = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = (SELECT id FROM candidate)
        AND status = 'pending'
      RETURNING *
    `,
    params
  );

  return rows[0] ? toQueueTaskRecord(rows[0]) : null;
}

export async function completeQueueTask(taskId: string) {
  await ensureDatabaseReady();
  const sql = getSql();
  const rows = await sql<DbRow[]>`
    UPDATE unified_queue_tasks
    SET status = ${"completed"},
        completed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ${taskId}
    RETURNING *
  `;

  if (!rows[0]) {
    throw new Error("队列任务不存在");
  }

  return toQueueTaskRecord(rows[0]);
}

export async function retryQueueTask(taskId: string, errorMessage: string, availableAt: string) {
  await ensureDatabaseReady();
  const sql = getSql();
  const rows = await sql<DbRow[]>`
    UPDATE unified_queue_tasks
    SET status = ${"pending"},
        worker_id = ${null},
        started_at = ${null},
        completed_at = ${null},
        retry_count = retry_count + 1,
        error_message = ${errorMessage},
        available_at = ${availableAt},
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ${taskId}
    RETURNING *
  `;

  if (!rows[0]) {
    throw new Error("队列任务不存在");
  }

  return toQueueTaskRecord(rows[0]);
}

export async function failQueueTask(taskId: string, errorMessage: string) {
  await ensureDatabaseReady();
  const sql = getSql();
  const rows = await sql<DbRow[]>`
    UPDATE unified_queue_tasks
    SET status = ${"failed"},
        error_message = ${errorMessage},
        completed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ${taskId}
    RETURNING *
  `;

  if (!rows[0]) {
    throw new Error("队列任务不存在");
  }

  return toQueueTaskRecord(rows[0]);
}

export async function listQueueTasks(input?: {
  limit?: number;
  status?: QueueTaskStatus;
  type?: QueueTaskType;
}) {
  await ensureDatabaseReady();
  const sql = getSql();
  const limit = Math.max(1, Math.min(200, Number(input?.limit || 100)));
  const params: unknown[] = [];
  const conditions = [];

  if (input?.status) {
    conditions.push("status = ?");
    params.push(input.status);
  }

  if (input?.type) {
    conditions.push("type = ?");
    params.push(input.type);
  }

  params.push(limit);

  const rows = await sql.unsafe<DbRow[]>(
    `
      SELECT *
      FROM unified_queue_tasks
      ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""}
      ORDER BY created_at DESC
      LIMIT ?
    `,
    params
  );

  return rows.map(toQueueTaskRecord);
}

export async function getQueueTaskById(taskId: string) {
  await ensureDatabaseReady();
  const sql = getSql();
  const rows = await sql<DbRow[]>`
    SELECT *
    FROM unified_queue_tasks
    WHERE id = ${taskId}
    LIMIT 1
  `;

  return rows[0] ? toQueueTaskRecord(rows[0]) : null;
}

export async function getQueueStats(): Promise<QueueStats> {
  await ensureDatabaseReady();
  const sql = getSql();
  const rows = await sql.unsafe<DbRow[]>(
    `
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) AS running,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed,
        SUM(CASE WHEN type = 'click-farm-trigger' THEN 1 ELSE 0 END) AS click_farm_trigger,
        SUM(CASE WHEN type = 'click-farm-batch' THEN 1 ELSE 0 END) AS click_farm_batch,
        SUM(CASE WHEN type = 'click-farm' THEN 1 ELSE 0 END) AS click_farm,
        SUM(CASE WHEN type = 'url-swap' THEN 1 ELSE 0 END) AS url_swap
      FROM unified_queue_tasks
    `,
    []
  );

  const row = rows[0] || {};

  return {
    total: Number(row.total || 0),
    pending: Number(row.pending || 0),
    running: Number(row.running || 0),
    completed: Number(row.completed || 0),
    failed: Number(row.failed || 0),
    byType: {
      "click-farm-trigger": Number(row.click_farm_trigger || 0),
      "click-farm-batch": Number(row.click_farm_batch || 0),
      "click-farm": Number(row.click_farm || 0),
      "url-swap": Number(row.url_swap || 0)
    }
  };
}

export async function resetStaleRunningQueueTasks(olderThanIso: string) {
  await ensureDatabaseReady();
  const sql = getSql();
  await sql`
    UPDATE unified_queue_tasks
    SET status = ${"pending"},
        worker_id = ${null},
        started_at = ${null},
        updated_at = CURRENT_TIMESTAMP
    WHERE status = ${"running"}
      AND started_at IS NOT NULL
      AND started_at <= ${olderThanIso}
  `;
}
