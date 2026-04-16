import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  getGoogleAdsCredentialStatus,
  getLinkSwapTaskById,
  getOfferById,
  getProxyUrls,
  updateLinkSwapTask
} = vi.hoisted(() => ({
  getGoogleAdsCredentialStatus: vi.fn(),
  getLinkSwapTaskById: vi.fn(),
  getOfferById: vi.fn(),
  getProxyUrls: vi.fn(),
  updateLinkSwapTask: vi.fn()
}));

const { getRequestUser } = vi.hoisted(() => ({
  getRequestUser: vi.fn()
}));

vi.mock("@autocashback/db", () => ({
  getGoogleAdsCredentialStatus,
  getLinkSwapTaskById,
  getOfferById,
  getProxyUrls,
  updateLinkSwapTask
}));

vi.mock("@/lib/api-auth", () => ({
  getRequestUser
}));

import { GET, PUT } from "../apps/web/app/api/link-swap/tasks/[id]/route";

describe("link swap task detail route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRequestUser.mockResolvedValue({ id: 9 });
    getOfferById.mockResolvedValue({ id: 21, targetCountry: "US" });
    getProxyUrls.mockResolvedValue(["http://proxy.example.com:8080"]);
    getGoogleAdsCredentialStatus.mockResolvedValue({
      hasCredentials: true,
      hasRefreshToken: true
    });
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

  it("rejects changing the linked offer during task update", async () => {
    getLinkSwapTaskById.mockResolvedValue({
      id: 5,
      offerId: 21,
      enabled: true,
      intervalMinutes: 30,
      durationDays: 14,
      mode: "script",
      googleCustomerId: null,
      googleCampaignId: null
    });

    const response = await PUT(
      new NextRequest("https://www.autocashback.dev/api/link-swap/tasks/5", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          offerId: 22,
          intervalMinutes: 30
        })
      }),
      { params: { id: "5" } }
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(updateLinkSwapTask).not.toHaveBeenCalled();
    expect(payload.error).toBe("不允许修改任务关联的 Offer");
  });

  it("rejects invalid duration during task update", async () => {
    getLinkSwapTaskById.mockResolvedValue({
      id: 5,
      offerId: 21,
      enabled: true,
      intervalMinutes: 30,
      durationDays: 14,
      mode: "script",
      googleCustomerId: null,
      googleCampaignId: null
    });

    const response = await PUT(
      new NextRequest("https://www.autocashback.dev/api/link-swap/tasks/5", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          durationDays: 400
        })
      }),
      { params: { id: "5" } }
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(updateLinkSwapTask).not.toHaveBeenCalled();
    expect(payload.error).toContain("任务持续天数必须在 1-365 天之间");
  });

  it("updates existing task through task-level route", async () => {
    getLinkSwapTaskById.mockResolvedValue({
      id: 5,
      offerId: 21,
      enabled: true,
      intervalMinutes: 30,
      durationDays: 14,
      mode: "script",
      googleCustomerId: null,
      googleCampaignId: null
    });
    updateLinkSwapTask.mockResolvedValue({
      id: 5,
      offerId: 21,
      enabled: true,
      intervalMinutes: 60,
      durationDays: 30,
      mode: "script"
    });

    const response = await PUT(
      new NextRequest("https://www.autocashback.dev/api/link-swap/tasks/5", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          intervalMinutes: 60,
          durationDays: 30,
          enabled: true
        })
      }),
      { params: { id: "5" } }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(updateLinkSwapTask).toHaveBeenCalledWith(
      9,
      21,
      expect.objectContaining({
        intervalMinutes: 60,
        durationDays: 30,
        enabled: true
      })
    );
    expect(payload.success).toBe(true);
    expect(payload.task.intervalMinutes).toBe(60);
    expect(payload.message).toBe("换链接任务更新成功");
  });
});
