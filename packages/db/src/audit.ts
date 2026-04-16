import { getDbType, getSql } from "./client";
import { ensureDatabaseReady } from "./schema";
import { countAsInt } from "./sql-helpers";

type DbRow = Record<string, unknown>;

export type AuditEventType =
  | "login_success"
  | "login_failed"
  | "logout"
  | "password_changed"
  | "user_created"
  | "user_updated"
  | "user_deleted"
  | "user_password_reset"
  | "configuration_changed"
  | "sensitive_data_access"
  | "unauthorized_access_attempt";

export type AuditLogEntry = {
  userId?: number | null;
  eventType: AuditEventType;
  ipAddress?: string | null;
  userAgent?: string | null;
  details?: Record<string, unknown> | null;
  createdAt?: string;
};

export type AuditLogRecord = {
  id: number;
  userId: number | null;
  eventType: string;
  ipAddress: string | null;
  userAgent: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
};

function parseDetails(value: unknown) {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(String(value)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function toAuditLogRecord(row: DbRow): AuditLogRecord {
  return {
    id: Number(row.id),
    userId: row.user_id === null || row.user_id === undefined ? null : Number(row.user_id),
    eventType: String(row.event_type || ""),
    ipAddress: row.ip_address ? String(row.ip_address) : null,
    userAgent: row.user_agent ? String(row.user_agent) : null,
    details: parseDetails(row.details),
    createdAt: String(row.created_at || "")
  };
}

export async function logAuditEvent(entry: AuditLogEntry) {
  await ensureDatabaseReady();
  const sql = getSql();

  await sql`
    INSERT INTO audit_logs (
      user_id,
      event_type,
      ip_address,
      user_agent,
      details,
      created_at
    )
    VALUES (
      ${entry.userId ?? null},
      ${entry.eventType},
      ${entry.ipAddress ?? null},
      ${entry.userAgent ?? null},
      ${entry.details ? JSON.stringify(entry.details) : null},
      ${entry.createdAt ?? new Date().toISOString()}
    )
  `;
}

export async function listAuditLogs(input?: {
  limit?: number;
  offset?: number;
  userId?: number;
  eventType?: AuditEventType;
}) {
  await ensureDatabaseReady();
  const sql = getSql();
  const dbType = getDbType();
  const limit = Math.max(1, Math.min(100, Number(input?.limit || 50)));
  const offset = Math.max(0, Number(input?.offset || 0));
  const userId = input?.userId;
  const eventType = input?.eventType;

  const whereClauses = ["1 = 1"];
  const params: Array<string | number> = [];
  if (userId !== undefined) {
    whereClauses.push("user_id = ?");
    params.push(userId);
  }
  if (eventType) {
    whereClauses.push("event_type = ?");
    params.push(eventType);
  }

  const whereSql = whereClauses.join(" AND ");
  const rows = await sql.unsafe<DbRow[]>(
    `
      SELECT *
      FROM audit_logs
      WHERE ${whereSql}
      ORDER BY created_at DESC, id DESC
      LIMIT ? OFFSET ?
    `,
    [...params, limit, offset]
  );
  const countRows = await sql.unsafe<{ count: number }[]>(
    `
      SELECT ${countAsInt("COUNT(*)", dbType)} AS count
      FROM audit_logs
      WHERE ${whereSql}
    `,
    params
  );

  return {
    logs: rows.map(toAuditLogRecord),
    total: Number(countRows[0]?.count || 0),
    limit,
    offset
  };
}
