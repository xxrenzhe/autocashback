import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  enqueueQueueTask,
  enableLinkSwapTask,
  getGoogleAdsCredentialStatus,
  getLinkSwapTaskById,
  getOfferById,
  getProxyUrls
} = vi.hoisted(() => ({
  enqueueQueueTask: vi.fn(),
  enableLinkSwapTask: vi.fn(),
  getGoogleAdsCredentialStatus: vi.fn(),
  getLinkSwapTaskById: vi.fn(),
  getOfferById: vi.fn(),
  getProxyUrls: vi.fn()
}));

const { getRequestUser } = vi.hoisted(() => ({
  getRequestUser: vi.fn()
}));

vi.mock("@autocashback/db", () => ({
  enqueueQueueTask,
  enableLinkSwapTask,
  getGoogleAdsCredentialStatus,
  getLinkSwapTaskById,
  getOfferById,
  getProxyUrls
}));

vi.mock("@/lib/api-auth", () => ({
  getRequestUser
}));

import { POST } from "../apps/web/app/api/link-swap/tasks/[id]/enable/route";

describe("link swap enable route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRequestUser.mockResolvedValue({ id: 9 });
    getLinkSwapTaskById.mockResolvedValue({
      id: 5,
      offerId: 21,
      enabled: false,
      status: "idle",
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
    enableLinkSwapTask.mockResolvedValue({
      id: 5,
      offerId: 21,
      enabled: true,
      status: "ready",
      nextRunAt: "2026-04-16T04:00:00.000Z"
    });
  });

  it("rejects enabling when the offer has no proxy configured", async () => {
    getProxyUrls.mockResolvedValue([]);

    const response = await POST(
      new NextRequest("https://www.autocashback.dev/api/link-swap/tasks/5/enable", {
        method: "POST"
      }),
      { params: { id: "5" } }
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(enableLinkSwapTask).not.toHaveBeenCalled();
    expect(payload.error).toContain("未配置 US 国家的代理");
  });

  it("rejects google ads api mode when oauth authorization is missing", async () => {
    getLinkSwapTaskById.mockResolvedValue({
      id: 5,
      offerId: 21,
      enabled: false,
      status: "idle",
      mode: "google_ads_api",
      googleCustomerId: "1234567890",
      googleCampaignId: "987654321"
    });
    getGoogleAdsCredentialStatus.mockResolvedValue({
      hasCredentials: true,
      hasRefreshToken: false
    });

    const response = await POST(
      new NextRequest("https://www.autocashback.dev/api/link-swap/tasks/5/enable", {
        method: "POST"
      }),
      { params: { id: "5" } }
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(enableLinkSwapTask).not.toHaveBeenCalled();
    expect(payload.error).toContain("完成 Google Ads API 配置并完成 OAuth 授权");
  });

  it("enables task through explicit resume route", async () => {
    const response = await POST(
      new NextRequest("https://www.autocashback.dev/api/link-swap/tasks/5/enable", {
        method: "POST"
      }),
      { params: { id: "5" } }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(enableLinkSwapTask).toHaveBeenCalledWith(9, 5);
    expect(enqueueQueueTask).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "url-swap",
        userId: 9,
        payload: { linkSwapTaskId: 5 }
      })
    );
    expect(payload.success).toBe(true);
    expect(payload.message).toBe("任务已启用");
    expect(payload.data.status).toBe("ready");
  });
});
