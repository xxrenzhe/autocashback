import { SignJWT, jwtVerify } from "jose";

import { getSql } from "./client";
import { hashPassword, verifyPassword } from "./crypto";
import { getServerEnv } from "./env";
import { ensureDatabaseReady } from "./schema";

const COOKIE_NAME = "autocashback_token";

type SessionPayload = {
  userId: number;
  role: "admin" | "user";
};

function getSecret() {
  return new TextEncoder().encode(getServerEnv().JWT_SECRET);
}

export async function loginUser(usernameOrEmail: string, password: string) {
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

  const token = await new SignJWT({
    userId: user.id,
    role: user.role
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());

  return {
    token,
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
    return verified.payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function getCurrentUser(token?: string | null) {
  const payload = await verifySessionToken(token);
  if (!payload) return null;

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
    WHERE id = ${payload.userId}
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

export function getAuthCookieName() {
  return COOKIE_NAME;
}
