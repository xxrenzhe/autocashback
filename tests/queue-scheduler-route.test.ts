import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  getClickFarmSchedulerMetrics,
  getLinkSwapSchedulerMetrics,
  getQueueSchedulerHeartbeat
} = vi.hoisted(() => ({
  getClickFarmSchedulerMetrics: vi.fn(),
  getLinkSwapSchedulerMetrics: vi.fn(),
  getQueueSchedulerHeartbeat: vi.fn()
}));

const { getRequestUser } = vi.hoisted(() => ({
  getRequestUser: vi.fn()
}));

vi.mock("@autocashback/db", () => ({
  getClickFarmSchedulerMetrics,
  getLinkSwapSchedulerMetrics,
  getQueueSchedulerHeartbeat
}));

vi.mock("@/lib/api-auth", () => ({
  getRequestUser
}));

import { GET, POST } from "../apps/web/app/api/queue/scheduler/route";

describe("queue scheduler route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRequestUser.mockResolvedValue({ id: 7, role: "admin" });
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

  it("returns unsupported for manual trigger", async () => {
    const response = await POST(
      new NextRequest("https://www.autocashback.dev/api/queue/scheduler", {
        method: "POST"
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.success).toBe(false);
    expect(payload.mode).toBe("external_scheduler_process");
    expect(payload.error).toContain("不再支持手动调度");
  });
});
