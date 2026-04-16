import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { getQueueStats, listQueueTasks } = vi.hoisted(() => ({
  getQueueStats: vi.fn(),
  listQueueTasks: vi.fn()
}));

const { getRequestUser } = vi.hoisted(() => ({
  getRequestUser: vi.fn()
}));

vi.mock("@autocashback/db", () => ({
  getQueueStats,
  listQueueTasks
}));

vi.mock("@/lib/api-auth", () => ({
  getRequestUser
}));

import { GET as GET_STATS } from "../apps/web/app/api/queue/stats/route";
import { GET as GET_TASKS } from "../apps/web/app/api/queue/tasks/route";

describe("queue routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRequestUser.mockResolvedValue({ id: 7, role: "admin" });
  });

  it("returns queue stats", async () => {
    getQueueStats.mockResolvedValue({
      total: 10,
      pending: 2,
      running: 1,
      completed: 6,
      failed: 1,
      byType: {
        "click-farm-trigger": 1,
        "click-farm-batch": 2,
        "click-farm": 5,
        "url-swap": 2
      },
      byTypeRunning: {
        "click-farm-trigger": 0,
        "click-farm-batch": 1,
        "click-farm": 0,
        "url-swap": 0
      }
    });

    const response = await GET_STATS(new NextRequest("https://www.autocashback.dev/api/queue/stats"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.stats.total).toBe(10);
  });

  it("returns queue tasks with filters", async () => {
    listQueueTasks.mockResolvedValue([{ id: "queue-1", type: "url-swap", status: "pending" }]);

    const response = await GET_TASKS(
      new NextRequest("https://www.autocashback.dev/api/queue/tasks?status=pending&type=url-swap&limit=20")
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(listQueueTasks).toHaveBeenCalledWith({
      limit: 20,
      status: "pending",
      type: "url-swap"
    });
    expect(payload.tasks).toHaveLength(1);
  });

  it("rejects non-admin access", async () => {
    getRequestUser.mockResolvedValue({ id: 8, role: "user" });

    const response = await GET_STATS(new NextRequest("https://www.autocashback.dev/api/queue/stats"));
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.error).toBe("Forbidden");
    expect(getQueueStats).not.toHaveBeenCalled();
  });
});
