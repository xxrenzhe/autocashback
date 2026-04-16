import { NextResponse, type NextRequest } from "next/server";

import {
  getLinkSwapTaskById,
  scheduleLinkSwapTaskNow
} from "@autocashback/db";

import { getRequestUser } from "@/lib/api-auth";
import { getLinkSwapTaskRunPrecheckError } from "@/lib/link-swap-task-run-helpers";

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
    return NextResponse.json(
      { error: "任务处于停用状态，请先恢复任务后再立即执行" },
      { status: 400 }
    );
  }

  const precheckError = await getLinkSwapTaskRunPrecheckError(user.id, task);
  if (precheckError) {
    return NextResponse.json({ error: precheckError }, { status: 400 });
  }

  const scheduledTask = await scheduleLinkSwapTaskNow(user.id, taskId);

  return NextResponse.json({
    success: true,
    data: scheduledTask,
    task: scheduledTask,
    message: "任务已加入立即执行队列"
  });
}
