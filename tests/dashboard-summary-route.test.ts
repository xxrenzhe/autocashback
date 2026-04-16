import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  getDashboardSummary,
  getGoogleAdsCredentialStatus,
  listAccounts,
  listLinkSwapRuns
} = vi.hoisted(() => ({
  getDashboardSummary: vi.fn(),
  getGoogleAdsCredentialStatus: vi.fn(),
  listAccounts: vi.fn(),
  listLinkSwapRuns: vi.fn()
}));

const { getRequestUser } = vi.hoisted(() => ({
  getRequestUser: vi.fn()
}));

vi.mock("@autocashback/db", () => ({
  getDashboardSummary,
  getGoogleAdsCredentialStatus,
  listAccounts,
  listLinkSwapRuns
}));

vi.mock("@/lib/api-auth", () => ({
  getRequestUser
}));

import { GET } from "../apps/web/app/api/dashboard/summary/route";

describe("dashboard summary route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRequestUser.mockResolvedValue({ id: 9, role: "user" });
    getDashboardSummary.mockResolvedValue({
      activeOffers: 3,
      activeTasks: 0,
      successRate: 75,
      warningOffers: 2
    });
    listAccounts.mockResolvedValue([
      {
        id: 1,
        userId: 9,
        platformCode: "topcashback",
        accountName: "main",
        registerEmail: "main@example.com",
        payoutMethod: "paypal",
        notes: null,
        status: "active",
        createdAt: "2026-04-16T12:00:00.000Z"
      }
    ]);
    listLinkSwapRuns.mockResolvedValue([
      {
        id: 31,
        taskId: 5,
        offerId: 18,
        rawUrl: "https://example.com",
        resolvedUrl: "https://landing.example.com",
        resolvedSuffix: "aff_id=ok",
        proxyUrl: null,
        status: "success",
        applyStatus: "success",
        applyErrorMessage: null,
        errorMessage: null,
        createdAt: "2026-04-16T12:30:00.000Z"
      },
      {
        id: 32,
        taskId: 6,
        offerId: 19,
        rawUrl: "https://example.com/2",
        resolvedUrl: null,
        resolvedSuffix: null,
        proxyUrl: null,
        status: "failed",
        applyStatus: "failed",
        applyErrorMessage: null,
        errorMessage: "proxy timeout",
        createdAt: "2026-04-16T12:10:00.000Z"
      }
    ]);
    getGoogleAdsCredentialStatus.mockResolvedValue({
      hasCredentials: false,
      hasClientId: false,
      hasClientSecret: false,
      hasDeveloperToken: false,
      hasRefreshToken: false,
      loginCustomerId: null,
      tokenExpiresAt: null,
      lastVerifiedAt: null
    });
  });

  it("returns aggregated dashboard summary with derived actions and risks", async () => {
    const response = await GET(new NextRequest("https://www.autocashback.dev/api/dashboard/summary"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.overview.activeAccounts).toBe(1);
    expect(payload.overview.recentSuccessfulRuns).toBe(1);
    expect(payload.overview.recentFailedRuns).toBe(1);
    expect(payload.actions.map((item: { id: string }) => item.id)).toEqual(
      expect.arrayContaining(["connect-google-ads", "enable-link-swap", "review-warning-offers"])
    );
    expect(payload.risks.map((item: { id: string }) => item.id)).toEqual(
      expect.arrayContaining(["risk-offer-warning", "risk-failed-runs", "risk-google-ads"])
    );
    expect(payload.recentRuns).toHaveLength(2);
  });

  it("returns 401 when the request is unauthenticated", async () => {
    getRequestUser.mockResolvedValueOnce(null);

    const response = await GET(new NextRequest("https://www.autocashback.dev/api/dashboard/summary"));
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error).toBe("Unauthorized");
  });
});
