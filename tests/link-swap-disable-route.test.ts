import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { disableLinkSwapTask, getLinkSwapTaskById } = vi.hoisted(() => ({
  disableLinkSwapTask: vi.fn(),
  getLinkSwapTaskById: vi.fn()
}));

const { getRequestUser } = vi.hoisted(() => ({
  getRequestUser: vi.fn()
}));

vi.mock("@autocashback/db", () => ({
  disableLinkSwapTask,
  getLinkSwapTaskById
}));

vi.mock("@/lib/api-auth", () => ({
  getRequestUser
}));

import { POST } from "../apps/web/app/api/link-swap/tasks/[id]/disable/route";

describe("link swap disable route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRequestUser.mockResolvedValue({ id: 9 });
    getLinkSwapTaskById.mockResolvedValue({
      id: 5,
      offerId: 21,
      enabled: true,
      status: "ready"
    });
    disableLinkSwapTask.mockResolvedValue({
      id: 5,
      offerId: 21,
      enabled: false,
      status: "idle"
    });
  });

  it("rejects disabling when task is already idle", async () => {
    getLinkSwapTaskById.mockResolvedValue({
      id: 5,
      offerId: 21,
      enabled: false,
      status: "idle"
    });

    const response = await POST(
      new NextRequest("https://www.autocashback.dev/api/link-swap/tasks/5/disable", {
        method: "POST"
      }),
      { params: { id: "5" } }
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(disableLinkSwapTask).not.toHaveBeenCalled();
    expect(payload.error).toBe("任务已经是停用状态");
  });

  it("disables task through explicit disable route", async () => {
    const response = await POST(
      new NextRequest("https://www.autocashback.dev/api/link-swap/tasks/5/disable", {
        method: "POST"
      }),
      { params: { id: "5" } }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(disableLinkSwapTask).toHaveBeenCalledWith(9, 5);
    expect(payload.success).toBe(true);
    expect(payload.message).toBe("任务已停用");
    expect(payload.data.status).toBe("idle");
  });
});
