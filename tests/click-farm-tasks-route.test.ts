import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { createClickFarmTask, enqueueQueueTask, updateClickFarmTask } = vi.hoisted(() => ({
  createClickFarmTask: vi.fn(),
  enqueueQueueTask: vi.fn(),
  updateClickFarmTask: vi.fn()
}));

const { getRequestUser } = vi.hoisted(() => ({
  getRequestUser: vi.fn()
}));

vi.mock("@autocashback/db", () => ({
  createClickFarmTask,
  enqueueQueueTask,
  listClickFarmTasks: vi.fn(),
  updateClickFarmTask
}));

vi.mock("@/lib/api-auth", () => ({
  getRequestUser
}));

import { POST, PUT } from "../apps/web/app/api/click-farm/tasks/route";

describe("click farm tasks route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRequestUser.mockResolvedValue({ id: 7 });
  });

  it("preserves -1 duration days when creating an unlimited task", async () => {
    createClickFarmTask.mockResolvedValue({
      id: 1,
      durationDays: -1,
      nextRunAt: "2026-04-16T04:10:00.000Z"
    });
    const request = new NextRequest("https://www.autocashback.dev/api/click-farm/tasks", {
      method: "POST",
      body: JSON.stringify({
        offerId: 12,
        targetCountry: "US",
        dailyClickCount: 80,
        durationDays: -1
      }),
      headers: {
        "Content-Type": "application/json"
      }
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(createClickFarmTask).toHaveBeenCalledWith(
      7,
      expect.objectContaining({
        offerId: 12,
        dailyClickCount: 80,
        durationDays: -1
      })
    );
    expect(enqueueQueueTask).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "click-farm-trigger",
        userId: 7,
        payload: { clickFarmTaskId: 1 }
      })
    );
  });

  it("preserves -1 duration days when updating an unlimited task", async () => {
    updateClickFarmTask.mockResolvedValue({
      id: 5,
      durationDays: -1,
      nextRunAt: "2026-04-16T04:20:00.000Z"
    });
    const request = new NextRequest("https://www.autocashback.dev/api/click-farm/tasks", {
      method: "PUT",
      body: JSON.stringify({
        id: 5,
        offerId: 12,
        targetCountry: "US",
        dailyClickCount: 120,
        durationDays: -1
      }),
      headers: {
        "Content-Type": "application/json"
      }
    });

    const response = await PUT(request);

    expect(response.status).toBe(200);
    expect(updateClickFarmTask).toHaveBeenCalledWith(
      7,
      5,
      expect.objectContaining({
        offerId: 12,
        dailyClickCount: 120,
        durationDays: -1
      })
    );
    expect(enqueueQueueTask).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "click-farm-trigger",
        userId: 7,
        payload: { clickFarmTaskId: 5 }
      })
    );
  });
});
