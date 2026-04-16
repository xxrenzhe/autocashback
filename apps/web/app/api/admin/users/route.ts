import { NextResponse, type NextRequest } from "next/server";

import {
  createUser,
  listAdminUsers,
  logAuditEvent
} from "@autocashback/db";

import { getRequestUser } from "@/lib/api-auth";
import { getRequestMetadata } from "@/lib/request-metadata";

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;

  return NextResponse.json(
    await listAdminUsers({
      page: Number(searchParams.get("page") || 1),
      limit: Number(searchParams.get("limit") || 10),
      search: searchParams.get("search") || "",
      role: (searchParams.get("role") as "admin" | "user" | "all" | null) || "all",
      status:
        (searchParams.get("status") as
          | "all"
          | "risk"
          | "locked"
          | "disabled"
          | "active-session"
          | null) || "all",
      sortBy:
        (searchParams.get("sortBy") as
          | "id"
          | "username"
          | "email"
          | "role"
          | "createdAt"
          | "lastLoginAt"
          | "status"
          | null) ||
        "createdAt",
      sortOrder: (searchParams.get("sortOrder") as "asc" | "desc" | null) || "desc"
    })
  );
}

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const password =
      typeof body.password === "string" && body.password.trim()
        ? body.password.trim()
        : Math.random().toString(36).slice(-10) + "Aa1";
    const created = await createUser({
      username: body.username,
      email: body.email,
      password,
      role: body.role
    });
    await logAuditEvent({
      userId: user.id,
      eventType: "user_created",
      ...getRequestMetadata(request),
      details: {
        createdUserId: created.id,
        createdUsername: created.username,
        createdRole: created.role
      }
    });
    return NextResponse.json({ user: created, defaultPassword: password });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "创建失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
