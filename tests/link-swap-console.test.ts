import { describe, expect, it } from "vitest";

import type { LinkSwapRunRecord, LinkSwapTaskRecord, OfferRecord } from "@autocashback/domain";

import { buildLinkSwapConsole } from "../apps/web/lib/link-swap-console";

describe("buildLinkSwapConsole", () => {
  it("derives stats and status groups from tasks, offers, and runs", () => {
    const tasks: LinkSwapTaskRecord[] = [
      {
        id: 11,
        userId: 7,
        offerId: 101,
        enabled: true,
        intervalMinutes: 30,
        durationDays: 30,
        mode: "script",
        googleCustomerId: null,
        googleCampaignId: null,
        status: "ready",
        consecutiveFailures: 0,
        lastRunAt: "2026-04-16T10:00:00.000Z",
        nextRunAt: "2026-04-16T11:00:00.000Z"
      },
      {
        id: 12,
        userId: 7,
        offerId: 102,
        enabled: false,
        intervalMinutes: 60,
        durationDays: -1,
        mode: "google_ads_api",
        googleCustomerId: "1234567890",
        googleCampaignId: "987654321",
        status: "idle",
        consecutiveFailures: 0,
        lastRunAt: null,
        nextRunAt: null
      },
      {
        id: 13,
        userId: 7,
        offerId: 103,
        enabled: true,
        intervalMinutes: 15,
        durationDays: 14,
        mode: "script",
        googleCustomerId: null,
        googleCampaignId: null,
        status: "warning",
        consecutiveFailures: 2,
        lastRunAt: "2026-04-16T09:00:00.000Z",
        nextRunAt: "2026-04-16T09:15:00.000Z"
      }
    ];

    const offers: OfferRecord[] = [
      {
        id: 101,
        userId: 7,
        platformCode: "topcashback",
        cashbackAccountId: 1,
        promoLink: "https://example.com/offer-a",
        targetCountry: "US",
        brandName: "Alpha",
        campaignLabel: "alpha-us",
        commissionCapUsd: 100,
        manualRecordedCommissionUsd: 20,
        latestResolvedUrl: null,
        latestResolvedSuffix: null,
        lastResolvedAt: null,
        status: "active",
        createdAt: "2026-04-01T00:00:00.000Z"
      },
      {
        id: 102,
        userId: 7,
        platformCode: "rakuten",
        cashbackAccountId: 2,
        promoLink: "https://example.com/offer-b",
        targetCountry: "CA",
        brandName: "Beta",
        campaignLabel: "beta-ca",
        commissionCapUsd: 80,
        manualRecordedCommissionUsd: 10,
        latestResolvedUrl: null,
        latestResolvedSuffix: null,
        lastResolvedAt: null,
        status: "active",
        createdAt: "2026-04-02T00:00:00.000Z"
      }
    ];

    const runs: LinkSwapRunRecord[] = [
      {
        id: 1001,
        taskId: 11,
        offerId: 101,
        rawUrl: "https://example.com/offer-a",
        resolvedUrl: "https://landing.example.com/a",
        resolvedSuffix: "subid=alpha",
        proxyUrl: null,
        status: "success",
        applyStatus: "success",
        applyErrorMessage: null,
        errorMessage: null,
        createdAt: "2026-04-16T10:00:00.000Z"
      },
      {
        id: 1002,
        taskId: 13,
        offerId: 103,
        rawUrl: "https://example.com/offer-c",
        resolvedUrl: null,
        resolvedSuffix: null,
        proxyUrl: null,
        status: "failed",
        applyStatus: "failed",
        applyErrorMessage: null,
        errorMessage: "proxy timeout",
        createdAt: "2026-04-16T09:00:00.000Z"
      }
    ];

    const result = buildLinkSwapConsole(tasks, offers, runs);

    expect(result.stats.totalTasks).toBe(3);
    expect(result.stats.runningTasks).toBe(1);
    expect(result.stats.pausedTasks).toBe(1);
    expect(result.stats.warningTasks).toBe(1);
    expect(result.stats.apiModeTasks).toBe(1);
    expect(result.stats.recentSuccessRate).toBe(50);
    expect(result.rows.find((row) => row.task.id === 11)?.statusGroup).toBe("running");
    expect(result.rows.find((row) => row.task.id === 12)?.statusGroup).toBe("paused");
    expect(result.rows.find((row) => row.task.id === 13)?.statusGroup).toBe("warning");
    expect(result.rows.find((row) => row.task.id === 11)?.offer?.brandName).toBe("Alpha");
    expect(result.rows.find((row) => row.task.id === 13)?.latestRun?.errorMessage).toBe("proxy timeout");
  });
});
