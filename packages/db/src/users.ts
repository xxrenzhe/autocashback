import { createHash, randomBytes, randomUUID } from "node:crypto";

import { SignJWT, jwtVerify } from "jose";

import { getDbType, getSql } from "./client";
import { hashPassword, verifyPassword } from "./crypto";
import { getServerEnv } from "./env";
import { ensureDatabaseReady } from "./schema";
import { booleanValue, countAsInt, plusMinutesExpression } from "./sql-helpers";

const COOKIE_NAME = "autocashback_token";
const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCK_WINDOW_MINUTES = 30;

type SessionPayload = {
  userId: number;
  role: "admin" | "user";
  sessionId: string;
};

function toBooleanFlag(value: unknown) {
  return value === true || value === 1 || value === "1";
}

function toNullableTimestamp(value: unknown) {
  return value ? String(value) : null;
}

function isFutureTimestamp(value: string | null) {
  if (!value) {
    return false;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp > Date.now();
}

function getRemainingLockMinutes(value: string | null) {
  if (!value) {
    return 0;
  }

  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return 0;
  }

  return Math.max(0, Math.ceil((timestamp - Date.now()) / (60 * 1000)));
}

function getLoginLockMessage(lockedUntil: string | null) {
  const remainingMinutes = getRemainingLockMinutes(lockedUntil);
  if (remainingMinutes > 0) {
    return `账号已锁定，请 ${remainingMinutes} 分钟后再试`;
  }

  return "账号已锁定，请稍后再试";
}

function getSecret() {
  return new TextEncoder().encode(getServerEnv().JWT_SECRET);
}

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function buildSessionExpiryDate() {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
}

async function issueSessionToken(
  user: { id: number; role: "admin" | "user" },
  context?: { ipAddress?: string | null; userAgent?: string | null }
) {
  await ensureDatabaseReady();
  const sql = getSql();
  const sessionId = randomUUID();
  const expiresAt = buildSessionExpiryDate();
  const token = await new SignJWT({
    userId: user.id,
    role: user.role,
    sessionId
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());

  await sql`
    INSERT INTO user_sessions (
      session_id,
      user_id,
      token_hash,
      ip_address,
      user_agent,
      expires_at
    )
    VALUES (
      ${sessionId},
      ${user.id},
      ${hashSessionToken(token)},
      ${context?.ipAddress ?? null},
      ${context?.userAgent ?? null},
      ${expiresAt.toISOString()}
    )
  `;

  return {
    sessionId,
    token,
    expiresAt: expiresAt.toISOString()
  };
}

export async function loginUser(
  usernameOrEmail: string,
  password: string,
  context?: { ipAddress?: string | null; userAgent?: string | null }
) {
  await ensureDatabaseReady();
  const sql = getSql();
  const users = await sql<{
    id: number;
    username: string;
    email: string;
    password_hash: string;
    role: "admin" | "user";
    is_active: boolean | number;
    locked_until: string | null;
    failed_login_count: number;
  }[]>`
    SELECT id, username, email, password_hash, role, is_active, locked_until, failed_login_count
    FROM users
    WHERE username = ${usernameOrEmail} OR email = ${usernameOrEmail}
    LIMIT 1
  `;

  const user = users[0];
  if (!user) throw new Error("用户名或密码错误");

  if (!toBooleanFlag(user.is_active)) {
    throw new Error("账号已停用，请联系管理员");
  }

  let lockedUntil = toNullableTimestamp(user.locked_until);
  if (lockedUntil && !isFutureTimestamp(lockedUntil)) {
    await clearUserLoginSecurityState(user.id);
    lockedUntil = null;
  }

  if (lockedUntil) {
    throw new Error(getLoginLockMessage(lockedUntil));
  }

  const matched = await verifyPassword(password, user.password_hash);
  if (!matched) {
    const failureState = await recordFailedLoginAttempt(user.id);
    if (
      failureState.failedLoginCount >= MAX_FAILED_LOGIN_ATTEMPTS ||
      isFutureTimestamp(failureState.lockedUntil)
    ) {
      throw new Error(`密码错误次数过多，账号已锁定 ${LOGIN_LOCK_WINDOW_MINUTES} 分钟`);
    }

    throw new Error("用户名或密码错误");
  }

  if (Number(user.failed_login_count || 0) > 0) {
    await clearUserLoginSecurityState(user.id);
  }

  const session = await issueSessionToken(
    {
      id: user.id,
      role: user.role
    },
    context
  );

  return {
    token: session.token,
    sessionId: session.sessionId,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    }
  };
}

export async function verifySessionToken(token?: string | null) {
  if (!token) return null;

  try {
    const verified = await jwtVerify(token, getSecret());
    const payload = verified.payload as unknown as SessionPayload;
    if (!payload.sessionId) {
      return null;
    }

    await ensureDatabaseReady();
    const sql = getSql();
    const dbType = getDbType();
    const rows = await sql.unsafe<{
      session_id: string;
    }[]>(
      `
      SELECT user_sessions.session_id
      FROM user_sessions
      INNER JOIN users ON users.id = user_sessions.user_id
      WHERE user_sessions.session_id = ?
        AND user_sessions.token_hash = ?
        AND user_sessions.revoked_at IS NULL
        AND user_sessions.expires_at > CURRENT_TIMESTAMP
        AND users.is_active = ${dbType === "postgres" ? "TRUE" : "1"}
      LIMIT 1
    `,
      [payload.sessionId, hashSessionToken(token)]
    );
    if (!rows[0]) {
      return null;
    }

    await sql`
      UPDATE user_sessions
      SET last_activity_at = CURRENT_TIMESTAMP
      WHERE session_id = ${payload.sessionId}
    `;

    return payload;
  } catch {
    return null;
  }
}

export async function getCurrentUser(token?: string | null) {
  const payload = await verifySessionToken(token);
  if (!payload) return null;

  return getUserById(payload.userId);
}

export async function getUserById(userId: number) {
  await ensureDatabaseReady();
  const sql = getSql();
  const rows = await sql<{
    id: number;
    username: string;
    email: string;
    role: "admin" | "user";
    created_at: string;
    is_active: boolean | number;
  }[]>`
    SELECT id, username, email, role, created_at, is_active
    FROM users
    WHERE id = ${userId}
    LIMIT 1
  `;

  if (!rows[0]) {
    return null;
  }

  return {
    id: rows[0].id,
    username: rows[0].username,
    email: rows[0].email,
    role: rows[0].role,
    created_at: rows[0].created_at,
    createdAt: rows[0].created_at,
    isActive: toBooleanFlag(rows[0].is_active)
  };
}

export async function listUsers() {
  await ensureDatabaseReady();
  const sql = getSql();
  return sql<{
    id: number;
    username: string;
    email: string;
    role: "admin" | "user";
    created_at: string;
    is_active: boolean | number;
  }[]>`
    SELECT id, username, email, role, created_at, is_active
    FROM users
    ORDER BY created_at DESC
  `;
}

export type AdminUsersQueryInput = {
  limit?: number;
  page?: number;
  role?: "admin" | "user" | "all";
  search?: string;
  sortBy?: "id" | "username" | "email" | "role" | "createdAt" | "lastLoginAt";
  sortOrder?: "asc" | "desc";
};

export type AdminUserListRecord = {
  id: number;
  username: string;
  email: string;
  role: "admin" | "user";
  createdAt: string;
  lastLoginAt: string | null;
  activeSessionCount: number;
  isActive: boolean;
  lockedUntil: string | null;
  failedLoginCount: number;
};

function generateTemporaryPassword(length = 14) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = randomBytes(length);

  let password = "";
  for (let index = 0; index < length; index += 1) {
    password += alphabet[bytes[index] % alphabet.length];
  }

  return password;
}

function toAdminUserListRecord(row: Record<string, unknown>): AdminUserListRecord {
  return {
    id: Number(row.id),
    username: String(row.username),
    email: String(row.email),
    role: String(row.role) as "admin" | "user",
    createdAt: String(row.created_at),
    lastLoginAt: row.last_login_at ? String(row.last_login_at) : null,
    activeSessionCount: Number(row.active_session_count || 0),
    isActive: toBooleanFlag(row.is_active),
    lockedUntil: toNullableTimestamp(row.locked_until),
    failedLoginCount: Number(row.failed_login_count || 0)
  };
}

export async function listAdminUsers(input?: AdminUsersQueryInput) {
  await ensureDatabaseReady();
  const sql = getSql();
  const dbType = getDbType();
  const page = Math.max(1, Number(input?.page || 1));
  const limit = Math.max(1, Math.min(100, Number(input?.limit || 10)));
  const offset = (page - 1) * limit;
  const search = String(input?.search || "").trim().toLowerCase();
  const role = input?.role === "admin" || input?.role === "user" ? input.role : null;
  const sortBy = input?.sortBy || "createdAt";
  const sortOrder = input?.sortOrder === "asc" ? "ASC" : "DESC";

  const sortColumnMap: Record<NonNullable<AdminUsersQueryInput["sortBy"]>, string> = {
    id: "users.id",
    username: "users.username",
    email: "users.email",
    role: "users.role",
    createdAt: "users.created_at",
    lastLoginAt: "last_login_at"
  };

  const whereClauses = ["1 = 1"];
  const params: unknown[] = [];

  if (search) {
    whereClauses.push("(LOWER(users.username) LIKE ? OR LOWER(users.email) LIKE ?)");
    params.push(`%${search}%`, `%${search}%`);
  }

  if (role) {
    whereClauses.push("users.role = ?");
    params.push(role);
  }

  const whereSql = whereClauses.join(" AND ");
  const orderBy = sortColumnMap[sortBy] || sortColumnMap.createdAt;
  const rows = await sql.unsafe<Record<string, unknown>[]>(
    `
      SELECT
        users.id,
        users.username,
        users.email,
        users.role,
        users.created_at,
        users.is_active,
        users.locked_until,
        users.failed_login_count,
        MAX(user_sessions.last_activity_at) AS last_login_at,
        ${countAsInt(
          "COUNT(CASE WHEN user_sessions.revoked_at IS NULL AND user_sessions.expires_at > CURRENT_TIMESTAMP THEN 1 END)",
          dbType
        )} AS active_session_count
      FROM users
      LEFT JOIN user_sessions ON user_sessions.user_id = users.id
      WHERE ${whereSql}
      GROUP BY
        users.id,
        users.username,
        users.email,
        users.role,
        users.created_at,
        users.is_active,
        users.locked_until,
        users.failed_login_count
      ORDER BY ${orderBy} ${sortOrder}, users.id DESC
      LIMIT ? OFFSET ?
    `,
    [...params, limit, offset]
  );

  const totalRows = await sql.unsafe<{ count: number }[]>(
    `
      SELECT ${countAsInt("COUNT(*)", dbType)} AS count
      FROM users
      WHERE ${whereSql.replaceAll("users.", "")}
    `,
    params
  );

  const total = Number(totalRows[0]?.count || 0);

  return {
    users: rows.map(toAdminUserListRecord),
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit))
    }
  };
}

export async function createUser(input: {
  username: string;
  email: string;
  password: string;
  role?: "admin" | "user";
}) {
  await ensureDatabaseReady();
  const sql = getSql();
  const passwordHash = await hashPassword(input.password);
  const rows = await sql<{
    id: number;
    username: string;
    email: string;
    role: "admin" | "user";
    created_at: string;
  }[]>`
    INSERT INTO users (username, email, password_hash, role)
    VALUES (
      ${input.username},
      ${input.email},
      ${passwordHash},
      ${input.role ?? "user"}
    )
    RETURNING id, username, email, role, created_at
  `;

  return rows[0];
}

export async function updateUserByAdmin(
  userId: number,
  input: {
    email?: string;
    role?: "admin" | "user";
    isActive?: boolean;
    unlock?: boolean;
  }
) {
  await ensureDatabaseReady();
  const sql = getSql();
  const dbType = getDbType();
  const targetRows = await sql<{
    id: number;
    username: string;
    email: string;
    role: "admin" | "user";
    created_at: string;
    is_active: boolean | number;
    locked_until: string | null;
    failed_login_count: number;
  }[]>`
    SELECT id, username, email, role, created_at, is_active, locked_until, failed_login_count
    FROM users
    WHERE id = ${userId}
    LIMIT 1
  `;

  const target = targetRows[0];
  if (!target) {
    throw new Error("用户不存在");
  }

  const currentIsActive = toBooleanFlag(target.is_active);
  const nextRole = input.role ?? target.role;
  const nextIsActive = input.isActive ?? currentIsActive;

  if (target.role === "admin" && nextRole !== "admin") {
    const countRows = await sql.unsafe<{ count: number }[]>(
      `
        SELECT ${countAsInt("COUNT(*)", dbType)} AS count
        FROM users
        WHERE role = 'admin'
      `
    );
    if (Number(countRows[0]?.count || 0) <= 1) {
      throw new Error("至少需要保留一个管理员账号");
    }
  }

  if (target.role === "admin" && currentIsActive && !nextIsActive) {
    const activeAdminRows = await sql.unsafe<{ count: number }[]>(
      `
        SELECT ${countAsInt("COUNT(*)", dbType)} AS count
        FROM users
        WHERE role = 'admin'
          AND is_active = ${dbType === "postgres" ? "TRUE" : "1"}
      `
    );
    if (Number(activeAdminRows[0]?.count || 0) <= 1) {
      throw new Error("至少需要保留一个启用中的管理员账号");
    }
  }

  const assignments = [];
  const params: unknown[] = [];

  if (input.email !== undefined && input.email !== target.email) {
    assignments.push("email = ?");
    params.push(input.email);
  }

  if (input.role !== undefined && input.role !== target.role) {
    assignments.push("role = ?");
    params.push(input.role);
  }

  if (input.isActive !== undefined && input.isActive !== currentIsActive) {
    assignments.push("is_active = ?");
    params.push(booleanValue(input.isActive, dbType));
  }

  const shouldUnlock =
    Boolean(input.unlock) &&
    (Number(target.failed_login_count || 0) > 0 || Boolean(target.locked_until));

  if (shouldUnlock) {
    assignments.push("failed_login_count = 0");
    assignments.push("locked_until = NULL");
  }

  if (!assignments.length) {
    throw new Error("没有可更新的字段");
  }

  const rows = await sql.unsafe<{
    id: number;
    username: string;
    email: string;
    role: "admin" | "user";
    created_at: string;
    is_active: boolean | number;
    locked_until: string | null;
    failed_login_count: number;
  }[]>(
    `
      UPDATE users
      SET ${assignments.join(", ")}
      WHERE id = ?
      RETURNING id, username, email, role, created_at, is_active, locked_until, failed_login_count
    `,
    [...params, userId]
  );

  if (!rows[0]) {
    throw new Error("用户不存在");
  }

  if (currentIsActive && !toBooleanFlag(rows[0].is_active)) {
    await revokeAllUserSessions(userId);
  }

  return {
    id: rows[0].id,
    username: rows[0].username,
    email: rows[0].email,
    role: rows[0].role,
    createdAt: rows[0].created_at,
    isActive: toBooleanFlag(rows[0].is_active),
    lockedUntil: toNullableTimestamp(rows[0].locked_until),
    failedLoginCount: Number(rows[0].failed_login_count || 0)
  };
}

export async function deleteUserByAdmin(userId: number) {
  await ensureDatabaseReady();
  const sql = getSql();
  const dbType = getDbType();
  const targetRows = await sql<{
    id: number;
    username: string;
    role: "admin" | "user";
    is_active: boolean | number;
  }[]>`
    SELECT id, username, role, is_active
    FROM users
    WHERE id = ${userId}
    LIMIT 1
  `;

  const target = targetRows[0];
  if (!target) {
    throw new Error("用户不存在");
  }

  if (toBooleanFlag(target.is_active)) {
    throw new Error("无法删除启用中的用户，请先停用该账号");
  }

  if (target.role === "admin") {
    const countRows = await sql.unsafe<{ count: number }[]>(
      `
        SELECT ${countAsInt("COUNT(*)", dbType)} AS count
        FROM users
        WHERE role = 'admin'
      `
    );
    if (Number(countRows[0]?.count || 0) <= 1) {
      throw new Error("至少需要保留一个管理员账号");
    }
  }

  await sql`
    DELETE FROM users
    WHERE id = ${userId}
  `;

  return target;
}

export async function resetUserPasswordByAdmin(userId: number) {
  await ensureDatabaseReady();
  const sql = getSql();
  const rows = await sql<{
    id: number;
    username: string;
  }[]>`
    SELECT id, username
    FROM users
    WHERE id = ${userId}
    LIMIT 1
  `;

  if (!rows[0]) {
    throw new Error("用户不存在");
  }

  const nextPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(nextPassword);

  await sql`
    UPDATE users
    SET password_hash = ${passwordHash}
      , failed_login_count = ${0}
      , locked_until = ${null}
    WHERE id = ${userId}
  `;

  await revokeAllUserSessions(userId);

  return {
    userId,
    username: rows[0].username,
    password: nextPassword
  };
}

export async function listUserLoginHistoryByAdmin(userId: number, limit = 50) {
  await ensureDatabaseReady();
  const sql = getSql();
  const safeLimit = Math.max(1, Math.min(100, Number(limit || 50)));
  const rows = await sql<{
    session_id: string;
    ip_address: string | null;
    user_agent: string | null;
    created_at: string;
    last_activity_at: string;
    expires_at: string;
    revoked_at: string | null;
  }[]>`
    SELECT
      session_id,
      ip_address,
      user_agent,
      created_at,
      last_activity_at,
      expires_at,
      revoked_at
    FROM user_sessions
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT ${safeLimit}
  `;

  return rows.map((row) => ({
    sessionId: row.session_id,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    createdAt: row.created_at,
    lastActivityAt: row.last_activity_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    status: row.revoked_at
      ? "revoked"
      : new Date(row.expires_at).getTime() <= Date.now()
        ? "expired"
        : "active"
  }));
}

export async function changeUserPassword(input: {
  userId: number;
  currentPassword: string;
  newPassword: string;
}) {
  await ensureDatabaseReady();
  const sql = getSql();
  const rows = await sql<{
    id: number;
    password_hash: string;
  }[]>`
    SELECT id, password_hash
    FROM users
    WHERE id = ${input.userId}
    LIMIT 1
  `;
  const user = rows[0];
  if (!user) {
    throw new Error("用户不存在");
  }

  const matched = await verifyPassword(input.currentPassword, user.password_hash);
  if (!matched) {
    throw new Error("当前密码错误");
  }

  const reused = await verifyPassword(input.newPassword, user.password_hash);
  if (reused) {
    throw new Error("新密码不能与当前密码相同");
  }

  const nextHash = await hashPassword(input.newPassword);
  await sql`
    UPDATE users
    SET password_hash = ${nextHash}
      , failed_login_count = ${0}
      , locked_until = ${null}
    WHERE id = ${input.userId}
  `;
}

export async function createUserSession(
  userId: number,
  role: "admin" | "user",
  context?: { ipAddress?: string | null; userAgent?: string | null }
) {
  return issueSessionToken({ id: userId, role }, context);
}

export async function revokeUserSession(userId: number, sessionId: string) {
  await ensureDatabaseReady();
  const sql = getSql();
  const rows = await sql<{ session_id: string }[]>`
    UPDATE user_sessions
    SET revoked_at = CURRENT_TIMESTAMP
    WHERE session_id = ${sessionId}
      AND user_id = ${userId}
      AND revoked_at IS NULL
    RETURNING session_id
  `;

  return Boolean(rows[0]);
}

export async function revokeAllUserSessions(userId: number, excludeSessionId?: string | null) {
  await ensureDatabaseReady();
  const sql = getSql();
  if (excludeSessionId) {
    const rows = await sql<{ session_id: string }[]>`
      UPDATE user_sessions
      SET revoked_at = CURRENT_TIMESTAMP
      WHERE user_id = ${userId}
        AND revoked_at IS NULL
        AND session_id <> ${excludeSessionId}
      RETURNING session_id
    `;
    return rows.length;
  }

  const rows = await sql<{ session_id: string }[]>`
    UPDATE user_sessions
    SET revoked_at = CURRENT_TIMESTAMP
    WHERE user_id = ${userId}
      AND revoked_at IS NULL
    RETURNING session_id
  `;
  return rows.length;
}

export async function listUserSessions(userId: number, currentSessionId?: string | null) {
  await ensureDatabaseReady();
  const sql = getSql();
  const rows = await sql<{
    session_id: string;
    ip_address: string | null;
    user_agent: string | null;
    created_at: string;
    last_activity_at: string;
    expires_at: string;
  }[]>`
    SELECT session_id, ip_address, user_agent, created_at, last_activity_at, expires_at
    FROM user_sessions
    WHERE user_id = ${userId}
      AND revoked_at IS NULL
      AND expires_at > CURRENT_TIMESTAMP
    ORDER BY last_activity_at DESC, created_at DESC
  `;

  return rows.map((row) => ({
    sessionId: row.session_id,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    isCurrent: row.session_id === currentSessionId,
    createdAt: row.created_at,
    lastActivityAt: row.last_activity_at,
    expiresAt: row.expires_at
  }));
}

export function getAuthCookieName() {
  return COOKIE_NAME;
}

async function clearUserLoginSecurityState(userId: number) {
  await ensureDatabaseReady();
  const sql = getSql();

  await sql`
    UPDATE users
    SET failed_login_count = ${0},
        locked_until = ${null}
    WHERE id = ${userId}
  `;
}

async function recordFailedLoginAttempt(userId: number) {
  await ensureDatabaseReady();
  const sql = getSql();
  const dbType = getDbType();
  const rows = await sql.unsafe<{
    failed_login_count: number;
    locked_until: string | null;
  }[]>(
    `
      UPDATE users
      SET failed_login_count = failed_login_count + 1,
          locked_until = CASE
            WHEN failed_login_count + 1 >= ? THEN ${plusMinutesExpression(LOGIN_LOCK_WINDOW_MINUTES, dbType)}
            ELSE locked_until
          END
      WHERE id = ?
      RETURNING failed_login_count, locked_until
    `,
    [MAX_FAILED_LOGIN_ATTEMPTS, userId]
  );

  return {
    failedLoginCount: Number(rows[0]?.failed_login_count || 0),
    lockedUntil: toNullableTimestamp(rows[0]?.locked_until)
  };
}
