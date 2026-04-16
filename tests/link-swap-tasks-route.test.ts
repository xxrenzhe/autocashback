import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { getGoogleAdsCredentialStatus, getOfferById, getProxyUrls, listLinkSwapTasks, updateLinkSwapTask } =
  vi.hoisted(() => ({
    getGoogleAdsCredentialStatus: vi.fn(),
    getOfferById: vi.fn(),
    getProxyUrls: vi.fn(),
    listLinkSwapTasks: vi.fn(),
    updateLinkSwapTask: vi.fn()
  }));

const { getRequestUser } = vi.hoisted(() => ({
  getRequestUser: vi.fn()
}));

vi.mock("@autocashback/db", () => ({
  getGoogleAdsCredentialStatus,
  getOfferById,
  getProxyUrls,
  listLinkSwapTasks,
  updateLinkSwapTask
}));

vi.mock("@/lib/api-auth", () => ({
  getRequestUser
}));

import { GET, PUT } from "../apps/web/app/api/link-swap/tasks/route";

describe("link swap tasks route", () => {
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

  it("rejects intervals outside the reused autobb allowlist", async () => {
    const request = new NextRequest("https://www.autocashback.dev/api/link-swap/tasks", {
      method: "PUT",
      body: JSON.stringify({
        offerId: 21,
        enabled: true,
        intervalMinutes: 17,
        durationDays: 14,
        mode: "script"
      }),
      headers: {
        "Content-Type": "application/json"
      }
    });

    const response = await PUT(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(updateLinkSwapTask).not.toHaveBeenCalled();
    expect(payload.error).toContain("换链接间隔必须是以下值之一");
  });

  it("accepts allowlisted intervals and passes them through unchanged", async () => {
    updateLinkSwapTask.mockResolvedValue({ id: 5, intervalMinutes: 30 });

    const request = new NextRequest("https://www.autocashback.dev/api/link-swap/tasks", {
      method: "PUT",
      body: JSON.stringify({
        offerId: 21,
        enabled: true,
        intervalMinutes: 30,
        durationDays: 14,
        mode: "script"
      }),
      headers: {
        "Content-Type": "application/json"
      }
    });

    const response = await PUT(request);

    expect(response.status).toBe(200);
    expect(updateLinkSwapTask).toHaveBeenCalledWith(
      9,
      21,
      expect.objectContaining({
        intervalMinutes: 30,
        mode: "script"
      })
    );
  });

  it("returns autobb-compatible list payload with pagination metadata", async () => {
    listLinkSwapTasks.mockResolvedValue([{ id: 5, offerId: 21, intervalMinutes: 30 }]);

    const response = await GET(
      new NextRequest("https://www.autocashback.dev/api/link-swap/tasks")
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.tasks).toHaveLength(1);
    expect(payload.data.tasks).toHaveLength(1);
    expect(payload.pagination.total).toBe(1);
    expect(payload.data.pagination.totalPages).toBe(1);
  });

  it("rejects saving when the offer country has no proxy configured", async () => {
    getProxyUrls.mockResolvedValue([]);

    const request = new NextRequest("https://www.autocashback.dev/api/link-swap/tasks", {
      method: "PUT",
      body: JSON.stringify({
        offerId: 21,
        enabled: true,
        intervalMinutes: 30,
        durationDays: 14,
        mode: "script"
      }),
      headers: {
        "Content-Type": "application/json"
      }
    });

    const response = await PUT(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(updateLinkSwapTask).not.toHaveBeenCalled();
    expect(payload.error).toContain("未配置 US 国家的代理");
  });

  it("rejects google ads api mode when oauth authorization is missing", async () => {
    getGoogleAdsCredentialStatus.mockResolvedValue({
      hasCredentials: true,
      hasRefreshToken: false
    });

    const request = new NextRequest("https://www.autocashback.dev/api/link-swap/tasks", {
      method: "PUT",
      body: JSON.stringify({
        offerId: 21,
        enabled: true,
        intervalMinutes: 30,
        durationDays: 14,
        mode: "google_ads_api",
        googleCustomerId: "1234567890",
        googleCampaignId: "987654321"
      }),
      headers: {
        "Content-Type": "application/json"
      }
    });

    const response = await PUT(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(updateLinkSwapTask).not.toHaveBeenCalled();
    expect(payload.error).toContain("完成 Google Ads API 配置并完成 OAuth 授权");
  });
});
