import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  getGoogleAdsCredentialStatus,
  getLinkSwapTaskById,
  getOfferById,
  getProxyUrls,
  scheduleLinkSwapTaskNow
} = vi.hoisted(() => ({
  getGoogleAdsCredentialStatus: vi.fn(),
  getLinkSwapTaskById: vi.fn(),
  getOfferById: vi.fn(),
  getProxyUrls: vi.fn(),
  scheduleLinkSwapTaskNow: vi.fn()
}));

const { getRequestUser } = vi.hoisted(() => ({
  getRequestUser: vi.fn()
}));

vi.mock("@autocashback/db", () => ({
  getGoogleAdsCredentialStatus,
  getLinkSwapTaskById,
  getOfferById,
  getProxyUrls,
  scheduleLinkSwapTaskNow
}));

vi.mock("@/lib/api-auth", () => ({
  getRequestUser
}));

import { POST } from "../apps/web/app/api/link-swap/tasks/[id]/swap-now/route";

describe("link swap swap-now route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRequestUser.mockResolvedValue({ id: 9 });
    getLinkSwapTaskById.mockResolvedValue({
      id: 5,
      offerId: 21,
      enabled: true,
      status: "ready",
      mode: "script",
      googleCustomerId: null,
      googleCampaignId: null
    });
    getOfferById.mockResolvedValue({ id: 21, targetCountry: "US" });
    getProxyUrls.mockResolvedValue(["http://proxy.example.com:8080"]);
    getGoogleAdsCredentialStatus.mockResolvedValue({
      hasCredentials: true,
      hasRefreshToken: true
    });
    scheduleLinkSwapTaskNow.mockResolvedValue({
      id: 5,
      offerId: 21,
      enabled: true,
      status: "ready",
      nextRunAt: "2026-04-16T03:30:00.000Z"
    });
  });

  it("rejects swap-now when task is idle", async () => {
    getLinkSwapTaskById.mockResolvedValue({
      id: 5,
      offerId: 21,
      enabled: false,
      status: "idle",
      mode: "script",
      googleCustomerId: null,
      googleCampaignId: null
    });

    const response = await POST(
      new NextRequest("https://www.autocashback.dev/api/link-swap/tasks/5/swap-now", {
        method: "POST"
      }),
      { params: { id: "5" } }
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(scheduleLinkSwapTaskNow).not.toHaveBeenCalled();
    expect(payload.error).toBe("任务处于停用状态，请先恢复任务后再立即执行");
  });

  it("rejects swap-now when proxy prerequisites are missing", async () => {
    getProxyUrls.mockResolvedValue([]);

    const response = await POST(
      new NextRequest("https://www.autocashback.dev/api/link-swap/tasks/5/swap-now", {
        method: "POST"
      }),
      { params: { id: "5" } }
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(scheduleLinkSwapTaskNow).not.toHaveBeenCalled();
    expect(payload.error).toContain("未配置 US 国家的代理");
  });

  it("schedules task for immediate execution", async () => {
    const response = await POST(
      new NextRequest("https://www.autocashback.dev/api/link-swap/tasks/5/swap-now", {
        method: "POST"
      }),
      { params: { id: "5" } }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(scheduleLinkSwapTaskNow).toHaveBeenCalledWith(9, 5);
    expect(payload.success).toBe(true);
    expect(payload.message).toBe("任务已加入立即执行队列");
    expect(payload.data.nextRunAt).toBe("2026-04-16T03:30:00.000Z");
  });
});
