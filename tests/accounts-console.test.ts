import { describe, expect, it } from "vitest";

import type { CashbackAccount, OfferRecord } from "@autocashback/domain";

import { buildAccountsConsole } from "../apps/web/lib/accounts-console";

describe("buildAccountsConsole", () => {
  it("summarizes account readiness and linked offers", () => {
    const accounts: CashbackAccount[] = [
      {
        id: 1,
        userId: 7,
        platformCode: "topcashback",
        accountName: "TCB Main",
        registerEmail: "main@example.com",
        payoutMethod: "paypal",
        notes: "US main operator",
        status: "active",
        createdAt: "2026-04-16T10:00:00.000Z"
      },
      {
        id: 2,
        userId: 7,
        platformCode: "rakuten",
        accountName: "Rakuten Backup",
        registerEmail: "backup@example.com",
        payoutMethod: "ach",
        notes: null,
        status: "paused",
        createdAt: "2026-04-16T11:00:00.000Z"
      }
    ];

    const offers: OfferRecord[] = [
      {
        id: 11,
        userId: 7,
        platformCode: "topcashback",
        cashbackAccountId: 1,
        promoLink: "https://example.com/alpha",
        targetCountry: "US",
        brandName: "Alpha",
        campaignLabel: "Alpha Search",
        commissionCapUsd: 100,
        manualRecordedCommissionUsd: 40,
        latestResolvedUrl: null,
        latestResolvedSuffix: null,
        lastResolvedAt: null,
        status: "active",
        createdAt: "2026-04-16T10:00:00.000Z"
      },
      {
        id: 12,
        userId: 7,
        platformCode: "topcashback",
        cashbackAccountId: 1,
        promoLink: "https://example.com/bravo",
        targetCountry: "CA",
        brandName: "Bravo",
        campaignLabel: "Bravo Search",
        commissionCapUsd: 120,
        manualRecordedCommissionUsd: 50,
        latestResolvedUrl: null,
        latestResolvedSuffix: null,
        lastResolvedAt: null,
        status: "active",
        createdAt: "2026-04-16T11:00:00.000Z"
      }
    ];

    const result = buildAccountsConsole(accounts, offers, {
      search: "",
      platformCode: "all",
      status: "all",
      payoutMethod: "all",
      sort: "linked-offers"
    });

    expect(result.overview.totalAccounts).toBe(2);
    expect(result.overview.activeAccounts).toBe(1);
    expect(result.overview.pausedAccounts).toBe(1);
    expect(result.overview.linkedOfferCount).toBe(2);
    expect(result.overview.platformCount).toBe(2);
    expect(result.overview.payoutMethodCount).toBe(2);
    expect(result.rows[0]?.account.id).toBe(1);
    expect(result.rows[0]?.linkedOfferCount).toBe(2);
    expect(result.rows[0]?.emailDomain).toBe("example.com");
  });

  it("filters by platform, status, payout and search", () => {
    const accounts: CashbackAccount[] = [
      {
        id: 1,
        userId: 7,
        platformCode: "topcashback",
        accountName: "TCB Main",
        registerEmail: "main@example.com",
        payoutMethod: "paypal",
        notes: null,
        status: "active",
        createdAt: "2026-04-16T10:00:00.000Z"
      },
      {
        id: 2,
        userId: 7,
        platformCode: "custom",
        accountName: "Manual Ops",
        registerEmail: "ops@manual.dev",
        payoutMethod: "giftCard",
        notes: "manual only",
        status: "paused",
        createdAt: "2026-04-16T11:00:00.000Z"
      }
    ];

    const result = buildAccountsConsole(accounts, [], {
      search: "manual",
      platformCode: "custom",
      status: "paused",
      payoutMethod: "giftCard",
      sort: "name"
    });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.account.accountName).toBe("Manual Ops");
    expect(result.rows[0]?.hasNotes).toBe(true);
  });
});
