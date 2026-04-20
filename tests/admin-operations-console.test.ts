import { describe, expect, it } from "vitest";

import {
  buildAdminOperationsConsole,
  type AdminAuditLogRecord,
  type AdminClickFarmStats,
  type AdminClickFarmTaskRow,
  type AdminProxyHealth,
  type AdminUrlSwapHealth,
  type AdminUrlSwapStats
} from "../apps/web/lib/admin-operations-console";

describe("buildAdminOperationsConsole", () => {
  it("summarizes operations health and prioritizes major risks", () => {
    const urlSwapStats: AdminUrlSwapStats = {
      totalTasks: 9,
      enabledTasks: 6,
      googleAdsModeTasks: 5,
      scriptModeTasks: 4,
      erroredTasks: 1,
      dueTasks: 3,
      recentSuccessRate: 78.2
    };

    const urlSwapHealth: AdminUrlSwapHealth = {
      staleRunningTasks: 2,
      highFailureTasks: 1,
      missingResolvedUrlOffers: 4
    };

    const clickFarmStats: AdminClickFarmStats = {
      totalTasks: 7,
      activeTasks: 4,
      pausedTasks: 2,
      totalClicks: 160,
      successClicks: 112,
      failedClicks: 48,
      successRate: 70
    };

    const clickFarmTasks: AdminClickFarmTaskRow[] = [
      {
        id: 101,
        username: "alpha",
        brandName: "NordicTrack",
        status: "running",
        progress: 42,
        totalClicks: 80,
        successClicks: 42,
        failedClicks: 38,
        nextRunAt: "2026-04-16T10:45:00.000Z",
        updatedAt: "2026-04-16T10:40:00.000Z"
      },
      {
        id: 102,
        username: "bravo",
        brandName: "Patagonia",
        status: "paused",
        progress: 27,
        totalClicks: 20,
        successClicks: 18,
        failedClicks: 2,
        nextRunAt: null,
        updatedAt: "2026-04-16T10:35:00.000Z"
      },
      {
        id: 103,
        username: "charlie",
        brandName: "Allbirds",
        status: "running",
        progress: 15,
        totalClicks: 6,
        successClicks: 6,
        failedClicks: 0,
        nextRunAt: null,
        updatedAt: "2026-04-16T10:20:00.000Z"
      }
    ];

    const proxyHealth: AdminProxyHealth = {
      users: [
        {
          userId: 1,
          username: "alpha",
          totalProxies: 3,
          activeProxies: 1,
          countries: ["US", "CA"]
        },
        {
          userId: 2,
          username: "bravo",
          totalProxies: 2,
          activeProxies: 0,
          countries: ["GB"]
        }
      ],
      summary: {
        usersWithProxyConfig: 2,
        totalProxies: 5,
        activeProxies: 1,
        countries: [
          { country: "US", total: 2, active: 1 },
          { country: "CA", total: 1, active: 0 },
          { country: "GB", total: 2, active: 0 }
        ]
      }
    };

    const auditLogs: AdminAuditLogRecord[] = [
      {
        id: 91,
        userId: 12,
        eventType: "unauthorized_access_attempt",
        ipAddress: "192.0.2.10",
        userAgent: "Mozilla/5.0",
        createdAt: "2026-04-16T10:30:00.000Z",
        details: { path: "/api/admin/users", method: "POST" }
      },
      {
        id: 92,
        userId: 8,
        eventType: "configuration_changed",
        ipAddress: "192.0.2.11",
        userAgent: "Mozilla/5.0",
        createdAt: "2026-04-16T10:25:00.000Z",
        details: { category: "proxy", key: "proxy_urls" }
      }
    ];

    const result = buildAdminOperationsConsole({
      urlSwapStats,
      urlSwapHealth,
      clickFarmStats,
      clickFarmTasks,
      proxyHealth,
      auditLogs
    });

    expect(result.overview.monitoredTasks).toBe(16);
    expect(result.overview.activeTasks).toBe(10);
    expect(result.overview.proxyCoverageRate).toBe(20);
    expect(result.overview.suspiciousAuditCount).toBe(2);
    expect(result.overview.attentionTaskCount).toBe(3);
    expect(result.risks.map((risk) => risk.id)).toEqual(
      expect.arrayContaining([
        "url-swap-stale",
        "url-swap-failure",
        "url-swap-offers",
        "click-farm-low-success",
        "proxy-partial",
        "audit-alert"
      ])
    );
    expect(result.watchTasks[0]?.id).toBe(101);
    expect(result.watchTasks[0]?.tone).toBe("red");
    expect(result.proxyUsers[0]?.username).toBe("bravo");
    expect(result.proxyUsers[0]?.tone).toBe("red");
    expect(result.auditHighlights[0]?.title).toBe("未授权访问尝试");
    expect(result.auditHighlights[0]?.tone).toBe("red");
  });

  it("keeps a calm summary when no major alert is present", () => {
    const result = buildAdminOperationsConsole({
      urlSwapStats: {
        totalTasks: 3,
        enabledTasks: 2,
        googleAdsModeTasks: 2,
        scriptModeTasks: 1,
        erroredTasks: 0,
        dueTasks: 0,
        recentSuccessRate: 96
      },
      urlSwapHealth: {
        staleRunningTasks: 0,
        highFailureTasks: 0,
        missingResolvedUrlOffers: 0
      },
      clickFarmStats: {
        totalTasks: 2,
        activeTasks: 2,
        pausedTasks: 0,
        totalClicks: 50,
        successClicks: 48,
        failedClicks: 2,
        successRate: 96
      },
      clickFarmTasks: [
        {
          id: 201,
          username: "delta",
          brandName: "Alo",
          status: "running",
          progress: 60,
          totalClicks: 50,
          successClicks: 48,
          failedClicks: 2,
          nextRunAt: "2026-04-16T11:00:00.000Z",
          updatedAt: "2026-04-16T10:50:00.000Z"
        }
      ],
      proxyHealth: {
        users: [
          {
            userId: 7,
            username: "delta",
            totalProxies: 2,
            activeProxies: 2,
            countries: ["US"]
          }
        ],
        summary: {
          usersWithProxyConfig: 1,
          totalProxies: 2,
          activeProxies: 2,
          countries: [{ country: "US", total: 2, active: 2 }]
        }
      },
      auditLogs: [
        {
          id: 301,
          userId: 7,
          eventType: "login_success",
          ipAddress: "198.51.100.2",
          userAgent: "Mozilla/5.0",
          createdAt: "2026-04-16T10:45:00.000Z",
          details: { channel: "dashboard" }
        }
      ]
    });

    expect(result.overview.riskCount).toBe(0);
    expect(result.overview.attentionTaskCount).toBe(0);
    expect(result.watchTasks[0]?.tone).toBe("slate");
    expect(result.proxyUsers[0]?.tone).toBe("slate");
    expect(result.auditHighlights[0]?.tone).toBe("slate");
    expect(result.clickFarmMetrics.find((item) => item.id === "click-farm-success")?.tone).toBe(
      "emerald"
    );
    expect(result.proxyMetrics.find((item) => item.id === "proxy-coverage")?.value).toBe("100%");
  });
});
