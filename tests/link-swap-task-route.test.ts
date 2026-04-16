import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { getLinkSwapTaskById } = vi.hoisted(() => ({
  getLinkSwapTaskById: vi.fn()
}));

const { getRequestUser } = vi.hoisted(() => ({
  getRequestUser: vi.fn()
}));

vi.mock("@autocashback/db", () => ({
  getLinkSwapTaskById
}));

vi.mock("@/lib/api-auth", () => ({
  getRequestUser
}));

import { GET } from "../apps/web/app/api/link-swap/tasks/[id]/route";

describe("link swap task detail route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRequestUser.mockResolvedValue({ id: 9 });
  });

  it("returns autobb-compatible task payload", async () => {
    getLinkSwapTaskById.mockResolvedValue({
      id: 5,
      offerId: 21,
      enabled: true,
      status: "ready"
    });

    const response = await GET(
      new NextRequest("https://www.autocashback.dev/api/link-swap/tasks/5"),
      { params: { id: "5" } }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(getLinkSwapTaskById).toHaveBeenCalledWith(9, 5);
    expect(payload.success).toBe(true);
    expect(payload.task.id).toBe(5);
    expect(payload.data.id).toBe(5);
    expect(payload.message).toBe("已找到换链接任务");
  });

  it("returns 404 when task does not exist", async () => {
    getLinkSwapTaskById.mockResolvedValue(null);

    const response = await GET(
      new NextRequest("https://www.autocashback.dev/api/link-swap/tasks/5"),
      { params: { id: "5" } }
    );
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.error).toBe("换链接任务不存在");
  });
});
