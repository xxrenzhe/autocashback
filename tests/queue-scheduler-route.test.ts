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

const { runOrchestratorTick } = vi.hoisted(() => ({
  runOrchestratorTick: vi.fn()
}));

vi.mock("@autocashback/db", () => ({
  getClickFarmSchedulerMetrics,
  getLinkSwapSchedulerMetrics,
  getQueueSchedulerHeartbeat
}));

vi.mock("@/lib/api-auth", () => ({
  getRequestUser
}));

vi.mock("../apps/scheduler/src/orchestrator", () => ({
  runOrchestratorTick
}));

import { GET, POST } from "../apps/web/app/api/queue/scheduler/route";

describe("queue scheduler route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRequestUser.mockResolvedValue({ id: 7 });
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
      lastQueuedAt: "2026-04-16T03:45:00.000Z",
      checkInterval: "每分钟"
    });
    getLinkSwapSchedulerMetrics.mockResolvedValue({
      enabledTasks: 3,
      overdueTasks: 0,
      recentQueuedTasks: 1,
      lastQueuedAt: "2026-04-16T03:50:00.000Z",
      checkInterval: "每分钟"
    });
    runOrchestratorTick.mockResolvedValue({
      processed: 4,
      inserted: 3,
      duplicate: 1,
      linkSwap: {
        processed: 1,
        inserted: 1,
        duplicate: 0
      },
      clickFarm: {
        processed: 3,
        inserted: 2,
        duplicate: 1
      }
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

  it("runs orchestrator tick on manual trigger", async () => {
    const response = await POST(
      new NextRequest("https://www.autocashback.dev/api/queue/scheduler", {
        method: "POST"
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(runOrchestratorTick).toHaveBeenCalledTimes(1);
    expect(payload.success).toBe(true);
    expect(payload.data.processed).toBe(4);
    expect(payload.message).toContain("处理 4");
  });
});
