import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  ensureQueueTaskEnqueued,
  getDueClickFarmTasks,
  getDueLinkSwapTasks,
  getClickFarmSchedulerMetrics,
  getLinkSwapSchedulerMetrics,
  getQueueSchedulerHeartbeat,
  logAuditEvent
} = vi.hoisted(() => ({
  ensureQueueTaskEnqueued: vi.fn(),
  getDueClickFarmTasks: vi.fn(),
  getDueLinkSwapTasks: vi.fn(),
  getClickFarmSchedulerMetrics: vi.fn(),
  getLinkSwapSchedulerMetrics: vi.fn(),
  getQueueSchedulerHeartbeat: vi.fn(),
  logAuditEvent: vi.fn()
}));

const { getRequestUser } = vi.hoisted(() => ({
  getRequestUser: vi.fn()
}));

const { getRequestMetadata } = vi.hoisted(() => ({
  getRequestMetadata: vi.fn()
}));

vi.mock("@autocashback/db", () => ({
  ensureQueueTaskEnqueued,
  getDueClickFarmTasks,
  getDueLinkSwapTasks,
  getClickFarmSchedulerMetrics,
  getLinkSwapSchedulerMetrics,
  getQueueSchedulerHeartbeat,
  logAuditEvent
}));

vi.mock("@autocashback/domain", () => ({
  buildClickFarmTriggerQueueTaskId: vi.fn((taskId: number) => `click-farm-trigger:${taskId}:0`),
  buildLinkSwapQueueTaskId: vi.fn((taskId: number) => `url-swap:${taskId}:0`)
}));

vi.mock("@/lib/api-auth", () => ({
  getRequestUser
}));

vi.mock("@/lib/request-metadata", () => ({
  getRequestMetadata
}));

import { GET, POST } from "../apps/web/app/api/queue/scheduler/route";

describe("queue scheduler route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRequestUser.mockResolvedValue({ id: 7, role: "admin" });
    getRequestMetadata.mockReturnValue({
      ipAddress: "127.0.0.1",
      userAgent: "vitest"
    });
    getQueueSchedulerHeartbeat.mockResolvedValue({
      heartbeatAt: "2026-04-16T04:00:00.000Z",
      lastTickAt: "2026-04-16T04:00:00.000Z",
      lastTickSummary: {
        processed: 3,
        inserted: 2,
        duplicate: 1
      }
    });
    getClickFarmSchedulerMetrics.mockResolvedValue({
      enabledTasks: 4,
      overdueTasks: 1,
      recentQueuedTasks: 2,
      runningTasks: 1,
      lastQueuedAt: "2026-04-16T03:45:00.000Z",
      checkInterval: "每分钟"
    });
    getLinkSwapSchedulerMetrics.mockResolvedValue({
      enabledTasks: 3,
      overdueTasks: 0,
      recentQueuedTasks: 1,
      runningTasks: 0,
      lastQueuedAt: "2026-04-16T03:50:00.000Z",
      checkInterval: "每分钟"
    });
    ensureQueueTaskEnqueued.mockResolvedValue({
      inserted: true,
      task: {
        id: "queue-1"
      }
    });
    getDueClickFarmTasks.mockResolvedValue([]);
    getDueLinkSwapTasks.mockResolvedValue([]);
  });

  it("returns scheduler health status", async () => {
    const response = await GET(new NextRequest("https://www.autocashback.dev/api/queue/scheduler"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.mode).toBe("external_scheduler_process");
    expect(payload.data.clickFarmScheduler.metrics.enabledTasks).toBe(4);
    expect(payload.data.urlSwapScheduler.metrics.recentQueuedTasks).toBe(1);
  });

  it("rejects unauthenticated requests", async () => {
    getRequestUser.mockResolvedValue(null);

    const response = await GET(new NextRequest("https://www.autocashback.dev/api/queue/scheduler"));
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error).toBe("Unauthorized");
  });

  it("rejects non-admin scheduler reads", async () => {
    getRequestUser.mockResolvedValue({ id: 8, role: "user" });

    const response = await GET(new NextRequest("https://www.autocashback.dev/api/queue/scheduler"));
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.error).toBe("Forbidden");
  });

  it("manually re-enqueues due tasks", async () => {
    getDueClickFarmTasks.mockResolvedValue([
      {
        id: 101,
        userId: 21,
        nextRunAt: "2026-04-16T03:58:00.000Z"
      }
    ]);
    getDueLinkSwapTasks.mockResolvedValue([
      {
        id: 202,
        user_id: 22,
        next_run_at: "2026-04-16T03:59:00.000Z"
      }
    ]);

    const response = await POST(
      new NextRequest("https://www.autocashback.dev/api/queue/scheduler", {
        method: "POST",
        body: JSON.stringify({ target: "all" }),
        headers: {
          "Content-Type": "application/json"
        }
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.mode).toBe("external_scheduler_process");
    expect(payload.data.clickFarm.inserted).toBe(1);
    expect(payload.data.urlSwap.inserted).toBe(1);
    expect(ensureQueueTaskEnqueued).toHaveBeenCalledTimes(2);
    expect(logAuditEvent).toHaveBeenCalled();
  });
});
