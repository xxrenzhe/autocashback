import { NextRequest, NextResponse } from "next/server";

import { getAuthCookieName, logAuditEvent, revokeUserSession } from "@autocashback/db";

import { getRequestAuth } from "@/lib/api-auth";
import { getRequestMetadata } from "@/lib/request-metadata";

export async function POST(request: NextRequest) {
  const auth = await getRequestAuth(request);
  const metadata = getRequestMetadata(request);

  if (auth.user && auth.session?.sessionId) {
    await revokeUserSession(auth.user.id, auth.session.sessionId);
    await logAuditEvent({
      userId: auth.user.id,
      eventType: "logout",
      ...metadata,
      details: {
        sessionId: auth.session.sessionId
      }
    });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(getAuthCookieName(), "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
  return response;
}
