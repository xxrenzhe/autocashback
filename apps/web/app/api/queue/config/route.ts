import { NextResponse, type NextRequest } from "next/server";

import {
  getQueueSystemConfigState,
  saveQueueSystemConfig
} from "@autocashback/db";
import type { QueueSystemConfig, QueueTaskType } from "@autocashback/domain";

import { getRequestUser } from "@/lib/api-auth";

const KNOWN_TASK_TYPES = [
  "click-farm-trigger",
  "click-farm-batch",
  "click-farm",
  "url-swap"
] as const;

function normalizeConfigInput(body: Record<string, unknown>): Partial<
  Omit<QueueSystemConfig, "perTypeConcurrency">
> & {
  perTypeConcurrency?: Partial<Record<QueueTaskType, number>>;
} {
  return {
    globalConcurrency:
      typeof body.globalConcurrency === "number" ? body.globalConcurrency : undefined,
    pollIntervalMs: typeof body.pollIntervalMs === "number" ? body.pollIntervalMs : undefined,
    staleTimeoutMs: typeof body.staleTimeoutMs === "number" ? body.staleTimeoutMs : undefined,
    perTypeConcurrency:
      body.perTypeConcurrency && typeof body.perTypeConcurrency === "object"
        ? (body.perTypeConcurrency as Partial<Record<keyof QueueSystemConfig["perTypeConcurrency"], number>>)
        : undefined
  };
}

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { config, source } = await getQueueSystemConfigState();
  return NextResponse.json({
    success: true,
    config,
    configSource: source,
    knownTaskTypes: KNOWN_TASK_TYPES,
    note: "配置保存后会在 60 秒内自动同步到后台调度服务"
  });
}

export async function PUT(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const config = await saveQueueSystemConfig(normalizeConfigInput(body));

  return NextResponse.json({
    success: true,
    config,
    message: "队列配置已保存，后台调度服务会在 60 秒内自动应用"
  });
}
