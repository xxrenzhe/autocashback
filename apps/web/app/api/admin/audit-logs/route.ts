import { NextResponse, type NextRequest } from "next/server";

import { listAuditLogs } from "@autocashback/db";

import { getRequestUser } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);

  return NextResponse.json({
    success: true,
    ...(await listAuditLogs({
      limit: Number(searchParams.get("limit") || 50),
      offset: Number(searchParams.get("offset") || 0),
      userId: searchParams.get("userId") ? Number(searchParams.get("userId")) : undefined,
      eventType: searchParams.get("eventType") as
        | "login_success"
        | "login_failed"
        | "logout"
        | "password_changed"
        | "user_created"
        | "configuration_changed"
        | "sensitive_data_access"
        | "unauthorized_access_attempt"
        | undefined
    }))
  });
}
