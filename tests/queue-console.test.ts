import { describe, expect, it } from "vitest";

import type { QueueStats, QueueTaskRecord } from "@autocashback/domain";

import { buildQueueConsole, type SchedulerStatusPayload } from "../apps/web/lib/queue-console";

describe("buildQueueConsole", () => {
  it("summarizes queue health and identifies risks", () => {
    const stats: QueueStats = {
      total: 6,
      pending: 2,
      running: 2,
      completed: 1,
      failed: 1,
      byType: {
        "click-farm-trigger": 1,
        "click-farm-batch": 1,
        "click-farm": 2,
        "url-swap": 2
      },
      byTypeRunning: {
        "click-farm-trigger": 0,
        "click-farm-batch": 0,
        "click-farm": 1,
        "url-swap": 1
      }
    };

    const tasks: QueueTaskRecord[] = [
      {
        id: "queue-1",
        type: "click-farm",
        userId: 7,
        payload: { clickFarmTaskId: 33 },
        parentRequestId: null,
        priority: "high",
        status: "pending",
        availableAt: "2026-04-16T12:00:00.000Z",
        startedAt: null,
        completedAt: null,
        errorMessage: null,
        retryCount: 0,
        maxRetries: 0,
        workerId: null,
        createdAt: "2026-04-16T12:00:00.000Z",
        updatedAt: "2026-04-16T12:00:00.000Z"
      },
      {
        id: "queue-2",
        type: "url-swap",
        userId: 8,
        payload: { linkSwapTaskId: 44 },
        parentRequestId: null,
        priority: "normal",
        status: "failed",
        availableAt: "2026-04-16T13:00:00.000Z",
        startedAt: "2026-04-16T13:01:00.000Z",
        completedAt: "2026-04-16T13:02:00.000Z",
        errorMessage: "proxy unavailable",
        retryCount: 2,
        maxRetries: 3,
        workerId: "worker-1",
        createdAt: "2026-04-16T13:00:00.000Z",
        updatedAt: "2026-04-16T13:02:00.000Z"
      }
    ];

    const schedulerStatus: SchedulerStatusPayload = {
      mode: "external_scheduler_process",
      heartbeatAt: "2026-04-16T13:00:00.000Z",
      lastTickAt: "2026-04-16T13:00:00.000Z",
      lastTickSummary: { processed: 2, inserted: 1 },
      note: "scheduler note",
      clickFarmScheduler: {
        status: "healthy",
        message: "补点击调度器运行正常",
        schedulerProcess: "后台调度服务",
        metrics: {
          enabledTasks: 5,
          overdueTasks: 0,
          recentQueuedTasks: 2,
          runningTasks: 1,
          lastQueuedAt: "2026-04-16T13:00:00.000Z",
          checkInterval: "1m"
        }
      },
      urlSwapScheduler: {
        status: "warning",
        message: "换链接调度器存在待调度任务，但最近 1 小时没有新的入队记录",
        schedulerProcess: "后台调度服务",
        metrics: {
          enabledTasks: 3,
          overdueTasks: 2,
          recentQueuedTasks: 0,
          runningTasks: 1,
          lastQueuedAt: null,
          checkInterval: "1m"
        }
      }
    };

    const result = buildQueueConsole({
      stats,
      tasks,
      schedulerStatus,
      filters: {
        search: "",
        sort: "failed-first"
      }
    });

    expect(result.overview.totalTasks).toBe(6);
    expect(result.overview.failedTasks).toBe(1);
    expect(result.overview.activeSchedulerCount).toBe(1);
    expect(result.overview.warningCount).toBeGreaterThanOrEqual(2);
    expect(result.rows[0]?.task.id).toBe("queue-2");
    expect(result.risks.map((risk) => risk.id)).toEqual(
      expect.arrayContaining(["failed-tasks", "url-swap-scheduler"])
    );
  });

  it("filters tasks by search and sorts by priority", () => {
    const stats: QueueStats = {
      total: 2,
      pending: 1,
      running: 1,
      completed: 0,
      failed: 0,
      byType: {
        "click-farm-trigger": 0,
        "click-farm-batch": 0,
        "click-farm": 1,
        "url-swap": 1
      },
      byTypeRunning: {
        "click-farm-trigger": 0,
        "click-farm-batch": 0,
        "click-farm": 1,
        "url-swap": 0
      }
    };

    const tasks: QueueTaskRecord[] = [
      {
        id: "queue-a",
        type: "click-farm",
        userId: 7,
        payload: { clickFarmTaskId: 11 },
        parentRequestId: null,
        priority: "normal",
        status: "running",
        availableAt: "2026-04-16T12:00:00.000Z",
        startedAt: "2026-04-16T12:01:00.000Z",
        completedAt: null,
        errorMessage: null,
        retryCount: 0,
        maxRetries: 0,
        workerId: "worker-a",
        createdAt: "2026-04-16T12:00:00.000Z",
        updatedAt: "2026-04-16T12:01:00.000Z"
      },
      {
        id: "queue-b",
        type: "url-swap",
        userId: 9,
        payload: { linkSwapTaskId: 99 },
        parentRequestId: null,
        priority: "high",
        status: "pending",
        availableAt: "2026-04-16T12:05:00.000Z",
        startedAt: null,
        completedAt: null,
        errorMessage: null,
        retryCount: 0,
        maxRetries: 0,
        workerId: null,
        createdAt: "2026-04-16T12:05:00.000Z",
        updatedAt: "2026-04-16T12:05:00.000Z"
      }
    ];

    const result = buildQueueConsole({
      stats,
      tasks,
      schedulerStatus: null,
      filters: {
        search: "linkSwapTaskId=99",
        sort: "priority"
      }
    });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.task.id).toBe("queue-b");
    expect(result.rows[0]?.payloadPreview).toContain("linkSwapTaskId=99");
  });
});
