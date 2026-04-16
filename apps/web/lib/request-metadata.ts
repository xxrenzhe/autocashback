import type { NextRequest } from "next/server";

function firstHeaderValue(value: string | null) {
  if (!value) {
    return null;
  }

  const candidate = value
    .split(",")
    .map((item) => item.trim())
    .find(Boolean);

  return candidate || null;
}

export function getRequestMetadata(request: NextRequest | Request) {
  return {
    ipAddress:
      firstHeaderValue(request.headers.get("x-forwarded-for")) ||
      firstHeaderValue(request.headers.get("cf-connecting-ip")) ||
      firstHeaderValue(request.headers.get("x-real-ip")),
    userAgent: request.headers.get("user-agent")?.slice(0, 512) || null
  };
}
