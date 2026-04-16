import { NextRequest, NextResponse } from "next/server";

import { getRequestAuth } from "@/lib/api-auth";

type WebVitalPayload = {
  id?: unknown;
  name?: unknown;
  value?: unknown;
  delta?: unknown;
  rating?: unknown;
  path?: unknown;
  ts?: unknown;
  timestamp?: unknown;
};

function normalizePath(value: unknown) {
  if (typeof value !== "string" || !value.startsWith("/")) {
    return "/";
  }

  return value.slice(0, 256) || "/";
}

export async function POST(request: NextRequest) {
  const auth = await getRequestAuth(request);
  const body = (await request.json().catch(() => ({}))) as WebVitalPayload;
  const name = String(body.name || "").trim().toUpperCase().slice(0, 32);
  const value = Number(body.value);

  if (!name || !Number.isFinite(value)) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  console.info("[web-vital]", {
    id: typeof body.id === "string" ? body.id.slice(0, 64) : null,
    name,
    value,
    delta: Number.isFinite(Number(body.delta)) ? Number(body.delta) : null,
    rating:
      body.rating === "good" || body.rating === "needs-improvement" || body.rating === "poor"
        ? body.rating
        : null,
    path: normalizePath(body.path),
    timestamp: Number(body.ts ?? body.timestamp) || Date.now(),
    userId: auth.user?.id || null
  });

  return NextResponse.json({ success: true });
}
