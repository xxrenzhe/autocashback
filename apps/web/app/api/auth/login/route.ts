import { NextRequest, NextResponse } from "next/server";

import {
  findUserIdByLoginIdentifier,
  getAuthCookieName,
  logAuditEvent,
  loginUser
} from "@autocashback/db";

import { getRequestMetadata } from "@/lib/request-metadata";

export async function POST(request: NextRequest) {
  const metadata = getRequestMetadata(request);
  const body = await request.json().catch(() => ({}));
  const username = String(body.username || "").trim();
  const password = String(body.password || "");

  try {
    const result = await loginUser(username, password, metadata);

    await logAuditEvent({
      userId: result.user.id,
      eventType: "login_success",
      ...metadata,
      details: {
        username
      }
    });

    const response = NextResponse.json({ user: result.user });
    response.cookies.set(getAuthCookieName(), result.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7
    });

    return response;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "登录失败";
    const matchedUserId = await findUserIdByLoginIdentifier(username);
    await logAuditEvent({
      userId: matchedUserId,
      eventType: "login_failed",
      ...metadata,
      details: {
        username: username.slice(0, 128),
        failureReason: message
      }
    });

    return NextResponse.json({ error: message }, { status: 401 });
  }
}
