import { NextResponse, type NextRequest } from "next/server";

import { disableLinkSwapTask, getLinkSwapTaskById } from "@autocashback/db";

import { getRequestUser } from "@/lib/api-auth";

export async function POST(
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

  if (!task.enabled || task.status === "idle") {
    return NextResponse.json({ error: "任务已经是停用状态" }, { status: 400 });
  }

  const disabledTask = await disableLinkSwapTask(user.id, taskId);

  return NextResponse.json({
    success: true,
    data: disabledTask,
    task: disabledTask,
    message: "任务已停用"
  });
}
