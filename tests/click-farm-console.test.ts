import { describe, expect, it } from "vitest";

import type { ClickFarmTask, OfferRecord } from "@autocashback/domain";

import { buildClickFarmConsole } from "../apps/web/lib/click-farm-console";

describe("buildClickFarmConsole", () => {
  it("summarizes task health and filters rows", () => {
    const offers: OfferRecord[] = [
      {
        id: 10,
        userId: 9,
        platformCode: "topcashback",
        cashbackAccountId: 1,
        promoLink: "https://example.com/alpha",
        targetCountry: "US",
        brandName: "Alpha",
        campaignLabel: "Alpha Search",
        commissionCapUsd: 100,
        manualRecordedCommissionUsd: 30,
        latestResolvedUrl: null,
        latestResolvedSuffix: null,
        lastResolvedAt: null,
        status: "active",
        createdAt: "2026-04-16T10:00:00.000Z"
      },
      {
        id: 11,
        userId: 9,
        platformCode: "rakuten",
        cashbackAccountId: 2,
        promoLink: "https://example.com/bravo",
        targetCountry: "CA",
        brandName: "Bravo",
        campaignLabel: "Bravo Retargeting",
        commissionCapUsd: 200,
        manualRecordedCommissionUsd: 50,
        latestResolvedUrl: null,
        latestResolvedSuffix: null,
        lastResolvedAt: null,
        status: "active",
        createdAt: "2026-04-16T11:00:00.000Z"
      }
    ];

    const tasks: ClickFarmTask[] = [
      {
        id: 100,
        userId: 9,
        offerId: 10,
        dailyClickCount: 120,
        startTime: "06:00",
        endTime: "22:00",
        durationDays: 14,
        scheduledStartDate: "2026-04-16",
        hourlyDistribution: Array.from({ length: 24 }, () => 5),
        timezone: "America/Los_Angeles",
        refererConfig: null,
        status: "running",
        pauseReason: null,
        pauseMessage: null,
        pausedAt: null,
        progress: 42,
        totalClicks: 80,
        successClicks: 72,
        failedClicks: 8,
        dailyHistory: [],
        startedAt: null,
        completedAt: null,
        nextRunAt: "2026-04-16T12:00:00.000Z",
        isDeleted: false,
        deletedAt: null,
        createdAt: "2026-04-16T10:00:00.000Z",
        updatedAt: "2026-04-16T10:00:00.000Z"
      },
      {
        id: 101,
        userId: 9,
        offerId: 11,
        dailyClickCount: 90,
        startTime: "08:00",
        endTime: "20:00",
        durationDays: 14,
        scheduledStartDate: "2026-04-16",
        hourlyDistribution: Array.from({ length: 24 }, () => 4),
        timezone: "America/Toronto",
        refererConfig: null,
        status: "paused",
        pauseReason: "no_proxy",
        pauseMessage: "proxy unavailable",
        pausedAt: "2026-04-16T12:00:00.000Z",
        progress: 25,
        totalClicks: 30,
        successClicks: 12,
        failedClicks: 18,
        dailyHistory: [],
        startedAt: null,
        completedAt: null,
        nextRunAt: null,
        isDeleted: false,
        deletedAt: null,
        createdAt: "2026-04-16T11:00:00.000Z",
        updatedAt: "2026-04-16T11:00:00.000Z"
      }
    ];

    const result = buildClickFarmConsole(tasks, offers, {
      search: "bravo",
      status: "all",
      country: "all",
      sort: "recent"
    });

    expect(result.overview.totalTasks).toBe(2);
    expect(result.overview.activeTasks).toBe(1);
    expect(result.overview.pausedTasks).toBe(1);
    expect(result.overview.warningTasks).toBe(1);
    expect(result.overview.totalClicks).toBe(110);
    expect(result.overview.averageSuccessRate).toBe(65);
    expect(result.countryOptions).toEqual(["CA", "US"]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.brandName).toBe("Bravo");
    expect(result.rows[0]?.needsAttention).toBe(true);
  });

  it("supports status and country filters plus alternate sort order", () => {
    const offers: OfferRecord[] = [
      {
        id: 20,
        userId: 9,
        platformCode: "topcashback",
        cashbackAccountId: 1,
        promoLink: "https://example.com/alpha",
        targetCountry: "US",
        brandName: "Alpha",
        campaignLabel: "Alpha Search",
        commissionCapUsd: 100,
        manualRecordedCommissionUsd: 30,
        latestResolvedUrl: null,
        latestResolvedSuffix: null,
        lastResolvedAt: null,
        status: "active",
        createdAt: "2026-04-16T10:00:00.000Z"
      }
    ];

    const tasks: ClickFarmTask[] = [
      {
        id: 200,
        userId: 9,
        offerId: 20,
        dailyClickCount: 60,
        startTime: "06:00",
        endTime: "22:00",
        durationDays: 14,
        scheduledStartDate: "2026-04-16",
        hourlyDistribution: Array.from({ length: 24 }, () => 2),
        timezone: "America/Los_Angeles",
        refererConfig: null,
        status: "pending",
        pauseReason: null,
        pauseMessage: null,
        pausedAt: null,
        progress: 10,
        totalClicks: 0,
        successClicks: 0,
        failedClicks: 0,
        dailyHistory: [],
        startedAt: null,
        completedAt: null,
        nextRunAt: null,
        isDeleted: false,
        deletedAt: null,
        createdAt: "2026-04-16T12:00:00.000Z",
        updatedAt: "2026-04-16T12:00:00.000Z"
      },
      {
        id: 201,
        userId: 9,
        offerId: 20,
        dailyClickCount: 180,
        startTime: "06:00",
        endTime: "22:00",
        durationDays: 14,
        scheduledStartDate: "2026-04-16",
        hourlyDistribution: Array.from({ length: 24 }, () => 8),
        timezone: "America/Los_Angeles",
        refererConfig: null,
        status: "running",
        pauseReason: null,
        pauseMessage: null,
        pausedAt: null,
        progress: 70,
        totalClicks: 100,
        successClicks: 96,
        failedClicks: 4,
        dailyHistory: [],
        startedAt: null,
        completedAt: null,
        nextRunAt: "2026-04-16T13:00:00.000Z",
        isDeleted: false,
        deletedAt: null,
        createdAt: "2026-04-16T13:00:00.000Z",
        updatedAt: "2026-04-16T13:00:00.000Z"
      }
    ];

    const result = buildClickFarmConsole(tasks, offers, {
      search: "",
      status: "running",
      country: "US",
      sort: "daily-clicks"
    });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.task.id).toBe(201);
    expect(result.rows[0]?.successRate).toBe(0.96);
    expect(result.rows[0]?.needsAttention).toBe(false);
  });
});
