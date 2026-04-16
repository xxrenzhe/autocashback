import { NextResponse, type NextRequest } from "next/server";

import { enqueueQueueTask, restartClickFarmTask } from "@autocashback/db";
import { buildClickFarmTriggerQueueTaskId } from "@autocashback/domain";

import { getRequestUser } from "@/lib/api-auth";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const task = await restartClickFarmTask(user.id, Number(params.id));
    await enqueueQueueTask({
      id: buildClickFarmTriggerQueueTaskId(task.id, task.nextRunAt),
      type: "click-farm-trigger",
      userId: user.id,
      payload: { clickFarmTaskId: task.id },
      priority: "high",
      maxRetries: 0
    });

    return NextResponse.json({
      task
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "恢复补点击任务失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
