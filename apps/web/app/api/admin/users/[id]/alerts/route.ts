import { NextResponse, type NextRequest } from "next/server";

import { getUserSecurityAlertsByAdmin } from "@autocashback/db";

import { getRequestUser } from "@/lib/api-auth";

export async function GET(
  request: NextRequest,
  context: { params: { id: string } }
) {
  const currentUser = await getRequestUser(request);
  if (!currentUser || currentUser.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const userId = Number(context.params.id);
    if (!Number.isInteger(userId) || userId <= 0) {
      throw new Error("用户不存在");
    }

    return NextResponse.json({
      alerts: await getUserSecurityAlertsByAdmin(userId)
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "获取安全告警失败" },
      { status: 400 }
    );
  }
}
