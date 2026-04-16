import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { enqueueQueueTask, restartClickFarmTask } = vi.hoisted(() => ({
  enqueueQueueTask: vi.fn(),
  restartClickFarmTask: vi.fn()
}));

const { getRequestUser } = vi.hoisted(() => ({
  getRequestUser: vi.fn()
}));

vi.mock("@autocashback/db", () => ({
  enqueueQueueTask,
  restartClickFarmTask
}));

vi.mock("@/lib/api-auth", () => ({
  getRequestUser
}));

import { POST } from "../apps/web/app/api/click-farm/tasks/[id]/restart/route";

describe("click farm restart route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRequestUser.mockResolvedValue({ id: 9 });
    restartClickFarmTask.mockResolvedValue({
      id: 5,
      status: "pending",
      nextRunAt: "2026-04-16T04:30:00.000Z"
    });
  });

  it("restarts task and enqueues trigger task", async () => {
    const response = await POST(
      new NextRequest("https://www.autocashback.dev/api/click-farm/tasks/5/restart", {
        method: "POST"
      }),
      { params: { id: "5" } }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(restartClickFarmTask).toHaveBeenCalledWith(9, 5);
    expect(enqueueQueueTask).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "click-farm-trigger",
        userId: 9,
        payload: { clickFarmTaskId: 5 }
      })
    );
    expect(payload.task.status).toBe("pending");
  });
});
