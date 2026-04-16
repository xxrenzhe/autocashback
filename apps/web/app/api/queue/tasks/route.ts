import { NextResponse, type NextRequest } from "next/server";

import { listQueueTasks } from "@autocashback/db";
import type { QueueTaskStatus, QueueTaskType } from "@autocashback/domain";

import { getRequestUser } from "@/lib/api-auth";

function normalizeStatus(value: string | null): QueueTaskStatus | undefined {
  if (value === "pending" || value === "running" || value === "completed" || value === "failed") {
    return value;
  }

  return undefined;
}

function normalizeType(value: string | null): QueueTaskType | undefined {
  if (
    value === "click-farm-trigger" ||
    value === "click-farm-batch" ||
    value === "click-farm" ||
    value === "url-swap"
  ) {
    return value;
  }

  return undefined;
}

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const tasks = await listQueueTasks({
    limit: Number(searchParams.get("limit") || 100),
    status: normalizeStatus(searchParams.get("status")),
    type: normalizeType(searchParams.get("type"))
  });

  return NextResponse.json({ success: true, tasks });
}
