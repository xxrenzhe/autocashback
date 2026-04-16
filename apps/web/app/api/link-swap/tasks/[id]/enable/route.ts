import { NextResponse, type NextRequest } from "next/server";

import { enqueueQueueTask, enableLinkSwapTask, getLinkSwapTaskById } from "@autocashback/db";
import { buildLinkSwapQueueTaskId } from "@autocashback/domain";

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

  if (task.enabled && task.status === "ready") {
    return NextResponse.json({ error: "任务已经是启用状态" }, { status: 400 });
  }

  const precheckError = await getLinkSwapTaskRunPrecheckError(user.id, task);
  if (precheckError) {
    return NextResponse.json({ error: precheckError }, { status: 400 });
  }

  const enabledTask = await enableLinkSwapTask(user.id, taskId);
  await enqueueQueueTask({
    id: buildLinkSwapQueueTaskId(enabledTask.id, enabledTask.nextRunAt),
    type: "url-swap",
    userId: user.id,
    payload: { linkSwapTaskId: enabledTask.id },
    priority: "normal",
    maxRetries: 0
  });

  return NextResponse.json({
    success: true,
    data: enabledTask,
    task: enabledTask,
    message: "任务已启用"
  });
}
