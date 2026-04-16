import { randomUUID } from "node:crypto";

import type { NextRequest, NextResponse } from "next/server";

const GOOGLE_ADS_OAUTH_STATE_COOKIE = "autocashback_google_ads_oauth_state";
const GOOGLE_ADS_OAUTH_STATE_MAX_AGE_MS = 10 * 60 * 1000;

type GoogleAdsOAuthStatePayload = {
  userId: number;
  nonce: string;
  timestamp: number;
};

function encodeStatePayload(payload: GoogleAdsOAuthStatePayload) {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function decodeStatePayload(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as GoogleAdsOAuthStatePayload;
  } catch {
    return null;
  }
}

function buildCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds
  };
}

export function issueGoogleAdsOAuthState(userId: number) {
  return encodeStatePayload({
    userId,
    nonce: randomUUID(),
    timestamp: Date.now()
  });
}

export function attachGoogleAdsOAuthStateCookie(response: NextResponse, state: string) {
  response.cookies.set(
    GOOGLE_ADS_OAUTH_STATE_COOKIE,
    state,
    buildCookieOptions(GOOGLE_ADS_OAUTH_STATE_MAX_AGE_MS / 1000)
  );
  return response;
}

export function clearGoogleAdsOAuthStateCookie(response: NextResponse) {
  response.cookies.set(GOOGLE_ADS_OAUTH_STATE_COOKIE, "", buildCookieOptions(0));
  return response;
}

export function verifyGoogleAdsOAuthState(
  request: NextRequest,
  state: string | null,
  currentUserId: number
): "invalid_state" | "state_expired" | null {
  const cookieState = request.cookies.get(GOOGLE_ADS_OAUTH_STATE_COOKIE)?.value || null;
  if (!state || !cookieState || cookieState !== state) {
    return "invalid_state";
  }

  const payload = decodeStatePayload(state);
  if (!payload || payload.userId !== currentUserId) {
    return "invalid_state";
  }

  if (
    !Number.isFinite(payload.timestamp) ||
    Date.now() - payload.timestamp > GOOGLE_ADS_OAUTH_STATE_MAX_AGE_MS
  ) {
    return "state_expired";
  }

  return null;
}
