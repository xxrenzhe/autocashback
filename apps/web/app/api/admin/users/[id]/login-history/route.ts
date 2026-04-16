import { NextResponse, type NextRequest } from "next/server";

import { listUserLoginHistoryByAdmin } from "@autocashback/db";

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

    const limit = Number(request.nextUrl.searchParams.get("limit") || 20);
    return NextResponse.json({
      records: await listUserLoginHistoryByAdmin(userId, limit)
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "获取登录记录失败" },
      { status: 400 }
    );
  }
}
