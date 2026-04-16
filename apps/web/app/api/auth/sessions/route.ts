import { NextRequest, NextResponse } from "next/server";

import {
  getAuthCookieName,
  listUserSessions,
  logAuditEvent,
  revokeAllUserSessions,
  revokeUserSession
} from "@autocashback/db";

import { getRequestAuth } from "@/lib/api-auth";
import { getRequestMetadata } from "@/lib/request-metadata";

export async function GET(request: NextRequest) {
  const auth = await getRequestAuth(request);
  if (!auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    sessions: await listUserSessions(auth.user.id, auth.session?.sessionId || null)
  });
}

export async function DELETE(request: NextRequest) {
  const auth = await getRequestAuth(request);
  if (!auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const revokeAll = Boolean(body.revokeAll);
  const sessionId = body.sessionId ? String(body.sessionId) : null;
  const currentSessionId = auth.session?.sessionId || null;
  const metadata = getRequestMetadata(request);

  if (!revokeAll && !sessionId) {
    return NextResponse.json({ error: "请提供 sessionId 或 revokeAll=true" }, { status: 400 });
  }

  const response = NextResponse.json({
    success: true,
    clearCurrentSession: revokeAll || sessionId === currentSessionId
  });

  if (revokeAll) {
    const count = await revokeAllUserSessions(auth.user.id);
    await logAuditEvent({
      userId: auth.user.id,
      eventType: "configuration_changed",
      ...metadata,
      details: {
        scope: "user_sessions",
        action: "revoke_all",
        revokedCount: count
      }
    });
    response.cookies.set(getAuthCookieName(), "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0
    });
    return response;
  }

  const revoked = await revokeUserSession(auth.user.id, sessionId as string);
  if (!revoked) {
    return NextResponse.json({ error: "会话不存在或已失效" }, { status: 404 });
  }

  await logAuditEvent({
    userId: auth.user.id,
    eventType: "configuration_changed",
    ...metadata,
    details: {
      scope: "user_sessions",
      action: "revoke_one",
      sessionId
    }
  });

  if (sessionId === currentSessionId) {
    response.cookies.set(getAuthCookieName(), "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0
    });
  }

  return response;
}
