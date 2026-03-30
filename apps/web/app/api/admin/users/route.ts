import { NextResponse, type NextRequest } from "next/server";

import { createUser, listUsers } from "@autocashback/db";

import { getRequestUser } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ users: await listUsers() });
}

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const created = await createUser({
      username: body.username,
      email: body.email,
      password: body.password,
      role: body.role
    });
    return NextResponse.json({ user: created });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "创建失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
