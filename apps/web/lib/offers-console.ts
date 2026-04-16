import {
  PLATFORM_OPTIONS,
  type CashbackAccount,
  type OfferRecord
} from "@autocashback/domain";

export type OfferConsoleSort =
  | "recent"
  | "brand"
  | "commission-progress"
  | "remaining-cap";

export type OfferConsoleFilters = {
  search: string;
  platformCode: OfferRecord["platformCode"] | "all";
  status: OfferRecord["status"] | "all";
  targetCountry: string;
  resolution: "all" | "resolved" | "unresolved";
  sort: OfferConsoleSort;
};

export type OfferConsoleRow = {
  offer: OfferRecord;
  accountName: string | null;
  accountStatus: CashbackAccount["status"] | null;
  platformLabel: string;
  progressRatio: number;
  remainingCommissionUsd: number;
  thresholdReached: boolean;
  hasResolvedSuffix: boolean;
};

export type OffersConsoleOverview = {
  totalOffers: number;
  warningOffers: number;
  unresolvedSuffixCount: number;
  coveredCountryCount: number;
  linkedAccountCount: number;
};

export type OffersConsoleData = {
  overview: OffersConsoleOverview;
  rows: OfferConsoleRow[];
  countryOptions: string[];
};

const platformLabelMap = Object.fromEntries(
  PLATFORM_OPTIONS.map((option) => [option.value, option.label])
) as Record<OfferRecord["platformCode"], string>;

export function buildOffersConsole(
  offers: OfferRecord[],
  accounts: CashbackAccount[],
  filters: OfferConsoleFilters
): OffersConsoleData {
  const accountMap = new Map(accounts.map((account) => [account.id, account]));
  const search = filters.search.trim().toLowerCase();

  const rows = offers.map<OfferConsoleRow>((offer) => {
    const account = accountMap.get(offer.cashbackAccountId) || null;
    const progressRatio =
      offer.commissionCapUsd > 0
        ? Math.min(100, (offer.manualRecordedCommissionUsd / offer.commissionCapUsd) * 100)
        : 0;

    return {
      offer,
      accountName: account?.accountName || null,
      accountStatus: account?.status || null,
      platformLabel: platformLabelMap[offer.platformCode] || offer.platformCode,
      progressRatio,
      remainingCommissionUsd: Math.max(
        0,
        Number((offer.commissionCapUsd - offer.manualRecordedCommissionUsd).toFixed(2))
      ),
      thresholdReached:
        offer.status === "warning" || offer.manualRecordedCommissionUsd >= offer.commissionCapUsd,
      hasResolvedSuffix: Boolean(offer.latestResolvedSuffix)
    };
  });

  const filteredRows = rows.filter((row) => {
    if (filters.platformCode !== "all" && row.offer.platformCode !== filters.platformCode) {
      return false;
    }

    if (filters.status !== "all" && row.offer.status !== filters.status) {
      return false;
    }

    if (filters.targetCountry !== "all" && row.offer.targetCountry !== filters.targetCountry) {
      return false;
    }

    if (filters.resolution === "resolved" && !row.hasResolvedSuffix) {
      return false;
    }

    if (filters.resolution === "unresolved" && row.hasResolvedSuffix) {
      return false;
    }

    if (!search) {
      return true;
    }

    const searchableText = [
      row.offer.brandName,
      row.offer.campaignLabel,
      row.offer.targetCountry,
      row.offer.promoLink,
      row.offer.latestResolvedSuffix || "",
      row.accountName || "",
      row.platformLabel
    ]
      .join(" ")
      .toLowerCase();

    return searchableText.includes(search);
  });

  filteredRows.sort((left, right) => {
    switch (filters.sort) {
      case "brand":
        return left.offer.brandName.localeCompare(right.offer.brandName, "zh-CN");
      case "commission-progress":
        return right.progressRatio - left.progressRatio || right.offer.id - left.offer.id;
      case "remaining-cap":
        return left.remainingCommissionUsd - right.remainingCommissionUsd || right.offer.id - left.offer.id;
      case "recent":
      default:
        return (
          Date.parse(right.offer.createdAt) - Date.parse(left.offer.createdAt) || right.offer.id - left.offer.id
        );
    }
  });

  const countryOptions = Array.from(
    new Set(
      offers
        .map((offer) => offer.targetCountry.trim().toUpperCase())
        .filter((value) => value.length > 0)
    )
  ).sort((left, right) => left.localeCompare(right, "en"));

  const linkedAccountCount = new Set(offers.map((offer) => offer.cashbackAccountId)).size;
  const coveredCountryCount = new Set(
    offers
      .map((offer) => offer.targetCountry.trim().toUpperCase())
      .filter((value) => value.length > 0)
  ).size;

  return {
    overview: {
      totalOffers: offers.length,
      warningOffers: rows.filter((row) => row.thresholdReached).length,
      unresolvedSuffixCount: rows.filter((row) => !row.hasResolvedSuffix).length,
      coveredCountryCount,
      linkedAccountCount
    },
    rows: filteredRows,
    countryOptions
  };
}
