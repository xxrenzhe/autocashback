import { NextRequest, NextResponse } from "next/server";

import { getRequestAuth } from "@/lib/api-auth";

type FrontendErrorPayload = {
  type?: unknown;
  name?: unknown;
  message?: unknown;
  stack?: unknown;
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
  const body = (await request.json().catch(() => ({}))) as FrontendErrorPayload;
  const type =
    body.type === "error" || body.type === "unhandledrejection" ? String(body.type) : null;
  const message = String(body.message || "").trim();

  if (!type || !message) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  console.error("[frontend-error]", {
    type,
    name: typeof body.name === "string" ? body.name.slice(0, 128) : null,
    message: message.slice(0, 1024),
    stack: typeof body.stack === "string" ? body.stack.slice(0, 4000) : null,
    path: normalizePath(body.path),
    timestamp: Number(body.ts ?? body.timestamp) || Date.now(),
    userId: auth.user?.id || null
  });

  return NextResponse.json({ success: true });
}
