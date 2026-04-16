import { describe, expect, it } from "vitest";

import type { CashbackAccount, OfferRecord } from "@autocashback/domain";

import { buildOffersConsole } from "../apps/web/lib/offers-console";

describe("buildOffersConsole", () => {
  it("summarizes offers and returns filtered rows", () => {
    const accounts: CashbackAccount[] = [
      {
        id: 1,
        userId: 7,
        platformCode: "topcashback",
        accountName: "TCB Main",
        registerEmail: "ops@example.com",
        payoutMethod: "paypal",
        notes: null,
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
        createdAt: "2026-04-16T10:00:00.000Z"
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
        platformCode: "rakuten",
        cashbackAccountId: 2,
        promoLink: "https://example.com/bravo",
        targetCountry: "CA",
        brandName: "Bravo",
        campaignLabel: "Bravo Retargeting",
        commissionCapUsd: 120,
        manualRecordedCommissionUsd: 120,
        latestResolvedUrl: "https://resolved.example.com/bravo",
        latestResolvedSuffix: "utm_source=ads",
        lastResolvedAt: "2026-04-16T11:00:00.000Z",
        status: "warning",
        createdAt: "2026-04-16T11:00:00.000Z"
      }
    ];

    const result = buildOffersConsole(offers, accounts, {
      search: "bravo",
      platformCode: "all",
      status: "all",
      targetCountry: "all",
      resolution: "all",
      sort: "recent"
    });

    expect(result.overview.totalOffers).toBe(2);
    expect(result.overview.warningOffers).toBe(1);
    expect(result.overview.unresolvedSuffixCount).toBe(1);
    expect(result.overview.coveredCountryCount).toBe(2);
    expect(result.overview.linkedAccountCount).toBe(2);
    expect(result.countryOptions).toEqual(["CA", "US"]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.offer.id).toBe(12);
    expect(result.rows[0]?.accountName).toBe("Rakuten Backup");
    expect(result.rows[0]?.platformLabel).toBe("Rakuten");
    expect(result.rows[0]?.thresholdReached).toBe(true);
  });

  it("supports status and country filters plus alternate sort orders", () => {
    const accounts: CashbackAccount[] = [
      {
        id: 1,
        userId: 7,
        platformCode: "topcashback",
        accountName: "TCB Main",
        registerEmail: "ops@example.com",
        payoutMethod: "paypal",
        notes: null,
        status: "active",
        createdAt: "2026-04-16T10:00:00.000Z"
      }
    ];

    const offers: OfferRecord[] = [
      {
        id: 21,
        userId: 7,
        platformCode: "topcashback",
        cashbackAccountId: 1,
        promoLink: "https://example.com/zeta",
        targetCountry: "US",
        brandName: "Zeta",
        campaignLabel: "Zeta Prospecting",
        commissionCapUsd: 200,
        manualRecordedCommissionUsd: 20,
        latestResolvedUrl: null,
        latestResolvedSuffix: null,
        lastResolvedAt: null,
        status: "active",
        createdAt: "2026-04-16T10:00:00.000Z"
      },
      {
        id: 22,
        userId: 7,
        platformCode: "topcashback",
        cashbackAccountId: 1,
        promoLink: "https://example.com/alpha",
        targetCountry: "US",
        brandName: "Alpha",
        campaignLabel: "Alpha Search",
        commissionCapUsd: 100,
        manualRecordedCommissionUsd: 90,
        latestResolvedUrl: "https://resolved.example.com/alpha",
        latestResolvedSuffix: "utm_campaign=alpha",
        lastResolvedAt: "2026-04-16T11:00:00.000Z",
        status: "warning",
        createdAt: "2026-04-16T11:00:00.000Z"
      }
    ];

    const result = buildOffersConsole(offers, accounts, {
      search: "",
      platformCode: "topcashback",
      status: "warning",
      targetCountry: "US",
      resolution: "resolved",
      sort: "brand"
    });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.offer.brandName).toBe("Alpha");
    expect(result.rows[0]?.hasResolvedSuffix).toBe(true);
    expect(result.rows[0]?.remainingCommissionUsd).toBe(10);
  });
});
