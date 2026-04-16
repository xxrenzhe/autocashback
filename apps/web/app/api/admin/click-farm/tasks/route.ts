import { NextResponse, type NextRequest } from "next/server";

import { listAdminClickFarmTasks } from "@autocashback/db";

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
    data: await listAdminClickFarmTasks({
      page: Number(searchParams.get("page") || 1),
      limit: Number(searchParams.get("limit") || 20)
    })
  });
}
