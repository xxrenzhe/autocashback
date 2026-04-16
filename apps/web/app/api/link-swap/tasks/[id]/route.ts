import { NextResponse, type NextRequest } from "next/server";

import { getLinkSwapTaskById } from "@autocashback/db";

import { getRequestUser } from "@/lib/api-auth";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const taskId = Number(params.id);
  if (!Number.isFinite(taskId)) {
    return NextResponse.json({ error: "无效的任务 ID" }, { status: 400 });
  }

  const task = await getLinkSwapTaskById(user.id, taskId);
  if (!task) {
    return NextResponse.json({ error: "换链接任务不存在" }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    data: task,
    task,
    message: "已找到换链接任务"
  });
}
