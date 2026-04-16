import { describe, expect, it } from "vitest";

import type { GoogleAdsAccountRecord, GoogleAdsCredentialStatus } from "@autocashback/domain";

import { buildGoogleAdsOverview } from "../apps/web/lib/google-ads-overview";

describe("buildGoogleAdsOverview", () => {
  it("summarizes google ads connectivity and account composition", () => {
    const credentials: GoogleAdsCredentialStatus = {
      hasCredentials: true,
      hasClientId: true,
      hasClientSecret: true,
      hasDeveloperToken: true,
      hasRefreshToken: false,
      loginCustomerId: "1234567890",
      tokenExpiresAt: null,
      lastVerifiedAt: null
    };

    const accounts: GoogleAdsAccountRecord[] = [
      {
        id: 1,
        userId: 9,
        customerId: "1000000001",
        descriptiveName: "Main MCC",
        currencyCode: "USD",
        timeZone: "America/Los_Angeles",
        manager: true,
        testAccount: false,
        status: "ENABLED",
        lastSyncAt: "2026-04-16T10:00:00.000Z",
        createdAt: "2026-04-16T10:00:00.000Z",
        updatedAt: "2026-04-16T10:00:00.000Z"
      },
      {
        id: 2,
        userId: 9,
        customerId: "1000000002",
        descriptiveName: "Test Account",
        currencyCode: "USD",
        timeZone: "America/New_York",
        manager: false,
        testAccount: true,
        status: "ENABLED",
        lastSyncAt: "2026-04-16T10:00:00.000Z",
        createdAt: "2026-04-16T10:00:00.000Z",
        updatedAt: "2026-04-16T10:00:00.000Z"
      }
    ];

    const overview = buildGoogleAdsOverview(credentials, accounts);

    expect(overview.hasBaseConfig).toBe(true);
    expect(overview.fullyConnected).toBe(false);
    expect(overview.needsOAuth).toBe(true);
    expect(overview.accountCount).toBe(2);
    expect(overview.managerCount).toBe(1);
    expect(overview.testAccountCount).toBe(1);
    expect(overview.activeAccountCount).toBe(2);
  });
});
