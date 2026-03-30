import { createHash } from "node:crypto";

import Redis from "ioredis";
import type { NextRequest } from "next/server";

declare global {
  // eslint-disable-next-line no-var
  var __autocashback_redis__: Redis | undefined;
  // eslint-disable-next-line no-var
  var __autocashback_snapshot_rate_limit__:
    | Map<string, { count: number; resetAt: number }>
    | undefined;
}

const WINDOW_MS = 60_000;
const LIMIT = 120;

function getClientIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }

  return request.headers.get("x-real-ip") || "unknown";
}

function getRequestFingerprint(request: NextRequest) {
  const ip = getClientIp(request);
  const userAgent = request.headers.get("user-agent") || "unknown";
  return createHash("sha256").update(`${ip}:${userAgent}`).digest("hex");
}

function getRedisClient() {
  if (!global.__autocashback_redis__) {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      throw new Error("REDIS_URL is required for script snapshot rate limit");
    }

    global.__autocashback_redis__ = new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false
    });
  }

  return global.__autocashback_redis__;
}

function takeInMemoryRateLimit(key: string) {
  const now = Date.now();
  const store = global.__autocashback_snapshot_rate_limit__ || new Map();
  global.__autocashback_snapshot_rate_limit__ = store;

  const current = store.get(key);
  if (!current || current.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return {
      allowed: true,
      limit: LIMIT,
      remaining: LIMIT - 1,
      retryAfterSec: Math.ceil(WINDOW_MS / 1000)
    };
  }

  current.count += 1;
  store.set(key, current);

  return {
    allowed: current.count <= LIMIT,
    limit: LIMIT,
    remaining: Math.max(0, LIMIT - current.count),
    retryAfterSec: Math.max(1, Math.ceil((current.resetAt - now) / 1000))
  };
}

async function takeRedisRateLimit(key: string) {
  const redis = getRedisClient();
  if (redis.status === "wait") {
    await redis.connect();
  }

  const count = await redis.incr(key);
  if (count === 1) {
    await redis.pexpire(key, WINDOW_MS);
  }

  const ttlMs = await redis.pttl(key);
  return {
    allowed: count <= LIMIT,
    limit: LIMIT,
    remaining: Math.max(0, LIMIT - count),
    retryAfterSec: Math.max(1, Math.ceil((ttlMs > 0 ? ttlMs : WINDOW_MS) / 1000))
  };
}

export async function takeScriptSnapshotRateLimit(request: NextRequest) {
  const fingerprint = getRequestFingerprint(request);
  const bucket = Math.floor(Date.now() / WINDOW_MS);
  const key = `ratelimit:script-snapshot:${fingerprint}:${bucket}`;

  try {
    return await takeRedisRateLimit(key);
  } catch (error) {
    console.error("[script-snapshot] redis rate limit failed, falling back to memory", error);
    return takeInMemoryRateLimit(key);
  }
}
