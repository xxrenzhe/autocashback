import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { getLinkSwapTaskById, listLinkSwapRunsByTaskId } = vi.hoisted(() => ({
  getLinkSwapTaskById: vi.fn(),
  listLinkSwapRunsByTaskId: vi.fn()
}));

const { getRequestUser } = vi.hoisted(() => ({
  getRequestUser: vi.fn()
}));

vi.mock("@autocashback/db", () => ({
  getLinkSwapTaskById,
  listLinkSwapRunsByTaskId
}));

vi.mock("@/lib/api-auth", () => ({
  getRequestUser
}));

import { GET } from "../apps/web/app/api/link-swap/tasks/[id]/history/route";

describe("link swap task history route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRequestUser.mockResolvedValue({ id: 9 });
  });

  it("returns autobb-compatible history payload", async () => {
    getLinkSwapTaskById.mockResolvedValue({ id: 5 });
    listLinkSwapRunsByTaskId.mockResolvedValue([
      {
        id: 1,
        taskId: 5,
        offerId: 21,
        status: "success",
        applyStatus: "success",
        applyErrorMessage: null,
        errorMessage: null,
        resolvedSuffix: "utm_source=test",
        createdAt: "2026-04-16T00:00:00.000Z"
      }
    ]);

    const response = await GET(
      new NextRequest("https://www.autocashback.dev/api/link-swap/tasks/5/history"),
      { params: { id: "5" } }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(listLinkSwapRunsByTaskId).toHaveBeenCalledWith(9, 5);
    expect(payload.success).toBe(true);
    expect(payload.taskId).toBe(5);
    expect(payload.history).toHaveLength(1);
    expect(payload.data.total).toBe(1);
  });

  it("returns 404 when task does not exist", async () => {
    getLinkSwapTaskById.mockResolvedValue(null);

    const response = await GET(
      new NextRequest("https://www.autocashback.dev/api/link-swap/tasks/5/history"),
      { params: { id: "5" } }
    );
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.error).toBe("换链接任务不存在");
  });
});
