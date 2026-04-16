import { NextResponse, type NextRequest } from "next/server";

import {
  getClickFarmSchedulerMetrics,
  getLinkSwapSchedulerMetrics,
  getQueueSchedulerHeartbeat
} from "@autocashback/db";

import { getRequestUser } from "@/lib/api-auth";

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
    return `${params.schedulerName} 心跳超时，请检查独立 scheduler 进程`;
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
      note: "调度器运行在独立 scheduler 进程中，此处通过心跳和最近入队情况推断健康状态",
      clickFarmScheduler: {
        status: clickFarmStatus,
        message: buildSchedulerMessage({
          schedulerName: "补点击调度器",
          heartbeatAt: heartbeat.heartbeatAt,
          overdueTasks: clickFarmMetrics.overdueTasks,
          recentQueuedTasks: clickFarmMetrics.recentQueuedTasks
        }),
        metrics: clickFarmMetrics,
        schedulerProcess: "scheduler 进程"
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
        schedulerProcess: "scheduler 进程"
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

  return NextResponse.json(
    {
      success: false,
      error: "该接口不再支持手动调度；请通过独立 scheduler 进程管理和观测",
      mode: "external_scheduler_process"
    },
    { status: 409 }
  );
}
