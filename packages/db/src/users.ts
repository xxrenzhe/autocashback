import { createHash, randomUUID } from "node:crypto";

import { SignJWT, jwtVerify } from "jose";

import { getSql } from "./client";
import { hashPassword, verifyPassword } from "./crypto";
import { getServerEnv } from "./env";
import { ensureDatabaseReady } from "./schema";

const COOKIE_NAME = "autocashback_token";

type SessionPayload = {
  userId: number;
  role: "admin" | "user";
  sessionId: string;
};

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
  }[]>`
    SELECT id, username, email, password_hash, role
    FROM users
    WHERE username = ${usernameOrEmail} OR email = ${usernameOrEmail}
    LIMIT 1
  `;

  const user = users[0];
  if (!user) throw new Error("用户名或密码错误");

  const matched = await verifyPassword(password, user.password_hash);
  if (!matched) throw new Error("用户名或密码错误");

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
    const rows = await sql<{
      session_id: string;
    }[]>`
      SELECT session_id
      FROM user_sessions
      WHERE session_id = ${payload.sessionId}
        AND token_hash = ${hashSessionToken(token)}
        AND revoked_at IS NULL
        AND expires_at > CURRENT_TIMESTAMP
      LIMIT 1
    `;
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
  }[]>`
    SELECT id, username, email, role, created_at
    FROM users
    WHERE id = ${userId}
    LIMIT 1
  `;

  return rows[0] ?? null;
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
  }[]>`
    SELECT id, username, email, role, created_at
    FROM users
    ORDER BY created_at DESC
  `;
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
