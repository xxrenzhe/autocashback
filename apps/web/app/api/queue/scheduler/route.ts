import { NextResponse, type NextRequest } from "next/server";

import {
  ensureQueueTaskEnqueued,
  getDueClickFarmTasks,
  getDueLinkSwapTasks,
  getClickFarmSchedulerMetrics,
  getLinkSwapSchedulerMetrics,
  getQueueSchedulerHeartbeat,
  logAuditEvent
} from "@autocashback/db";
import {
  buildClickFarmTriggerQueueTaskId,
  buildLinkSwapQueueTaskId
} from "@autocashback/domain";

import { getRequestUser } from "@/lib/api-auth";
import { getRequestMetadata } from "@/lib/request-metadata";

type SchedulerHealth = "healthy" | "warning" | "error";

function getHealthFromHeartbeat(heartbeatAt: string | null): SchedulerHealth {
  if (!heartbeatAt) {
    return "error";
  }

  const heartbeatMs = Date.parse(heartbeatAt);
  if (!Number.isFinite(heartbeatMs)) {
    return "error";
  }

  const ageMs = Date.now() - heartbeatMs;
  if (ageMs <= 3 * 60_000) {
    return "healthy";
  }

  if (ageMs <= 10 * 60_000) {
    return "warning";
  }

  return "error";
}

function buildSchedulerMessage(params: {
  schedulerName: string;
  heartbeatAt: string | null;
  overdueTasks: number;
  recentQueuedTasks: number;
}) {
  if (!params.heartbeatAt) {
    return `${params.schedulerName} 尚未上报心跳`;
  }

  const health = getHealthFromHeartbeat(params.heartbeatAt);
  if (health === "error") {
    return `${params.schedulerName} 心跳超时，请检查后台调度服务`;
  }

  if (params.overdueTasks > 0 && params.recentQueuedTasks === 0) {
    return `${params.schedulerName} 存在待调度任务，但最近 1 小时没有新的入队记录`;
  }

  if (health === "warning") {
    return `${params.schedulerName} 心跳偏旧，但仍在可接受范围内`;
  }

  return `${params.schedulerName} 运行正常`;
}

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [heartbeat, clickFarmMetrics, linkSwapMetrics] = await Promise.all([
    getQueueSchedulerHeartbeat(),
    getClickFarmSchedulerMetrics(),
    getLinkSwapSchedulerMetrics()
  ]);

  const clickFarmStatus = getHealthFromHeartbeat(heartbeat.heartbeatAt);
  const linkSwapStatus = getHealthFromHeartbeat(heartbeat.heartbeatAt);

  return NextResponse.json({
    success: true,
    data: {
      mode: "external_scheduler_process",
      heartbeatAt: heartbeat.heartbeatAt,
      lastTickAt: heartbeat.lastTickAt,
      lastTickSummary: heartbeat.lastTickSummary,
      note: "系统会根据最近心跳和入队情况评估后台调度服务的运行状态",
      clickFarmScheduler: {
        status: clickFarmStatus,
        message: buildSchedulerMessage({
          schedulerName: "补点击调度器",
          heartbeatAt: heartbeat.heartbeatAt,
          overdueTasks: clickFarmMetrics.overdueTasks,
          recentQueuedTasks: clickFarmMetrics.recentQueuedTasks
        }),
        metrics: clickFarmMetrics,
        schedulerProcess: "后台调度服务"
      },
      urlSwapScheduler: {
        status: linkSwapStatus,
        message: buildSchedulerMessage({
          schedulerName: "换链接调度器",
          heartbeatAt: heartbeat.heartbeatAt,
          overdueTasks: linkSwapMetrics.overdueTasks,
          recentQueuedTasks: linkSwapMetrics.recentQueuedTasks
        }),
        metrics: linkSwapMetrics,
        schedulerProcess: "后台调度服务"
      }
    }
  });
}

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const target =
    body.target === "click-farm" || body.target === "url-swap" ? body.target : "all";
  const includeClickFarm = target === "all" || target === "click-farm";
  const includeUrlSwap = target === "all" || target === "url-swap";
  const [clickFarmTasks, urlSwapTasks] = await Promise.all([
    includeClickFarm ? getDueClickFarmTasks() : Promise.resolve([]),
    includeUrlSwap ? getDueLinkSwapTasks() : Promise.resolve([])
  ]);

  const clickFarmResult = {
    due: clickFarmTasks.length,
    inserted: 0,
    duplicate: 0
  };
  const urlSwapResult = {
    due: urlSwapTasks.length,
    inserted: 0,
    duplicate: 0
  };

  for (const task of clickFarmTasks) {
    const result = await ensureQueueTaskEnqueued({
      id: buildClickFarmTriggerQueueTaskId(task.id, task.nextRunAt),
      type: "click-farm-trigger",
      userId: task.userId,
      payload: { clickFarmTaskId: task.id },
      priority: "high",
      maxRetries: 0
    });
    if (result.inserted) {
      clickFarmResult.inserted += 1;
    } else {
      clickFarmResult.duplicate += 1;
    }
  }

  for (const task of urlSwapTasks) {
    const taskId = Number(task.id);
    const taskUserId = Number(task.user_id);
    const result = await ensureQueueTaskEnqueued({
      id: buildLinkSwapQueueTaskId(taskId, task.next_run_at ? String(task.next_run_at) : null),
      type: "url-swap",
      userId: taskUserId,
      payload: { linkSwapTaskId: taskId },
      priority: "high",
      maxRetries: 0
    });
    if (result.inserted) {
      urlSwapResult.inserted += 1;
    } else {
      urlSwapResult.duplicate += 1;
    }
  }

  await logAuditEvent({
    userId: user.id,
    eventType: "configuration_changed",
    ...getRequestMetadata(request),
    details: {
      scope: "queue_scheduler",
      action: "manual_dispatch",
      target,
      clickFarm: clickFarmResult,
      urlSwap: urlSwapResult
    }
  });

  return NextResponse.json({
    success: true,
    mode: "external_scheduler_process",
    message: "已按当前条件补投待调度任务到统一队列",
    data: {
      target,
      clickFarm: clickFarmResult,
      urlSwap: urlSwapResult
    }
  });
}
