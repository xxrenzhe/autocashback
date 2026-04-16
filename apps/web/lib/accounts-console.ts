import {
  PAYOUT_OPTIONS,
  PLATFORM_OPTIONS,
  type CashbackAccount,
  type OfferRecord
} from "@autocashback/domain";

export type AccountsConsoleSort = "recent" | "name" | "platform" | "linked-offers";

export type AccountsConsoleFilters = {
  search: string;
  platformCode: CashbackAccount["platformCode"] | "all";
  status: CashbackAccount["status"] | "all";
  payoutMethod: CashbackAccount["payoutMethod"] | "all";
  sort: AccountsConsoleSort;
};

export type AccountConsoleRow = {
  account: CashbackAccount;
  platformLabel: string;
  payoutLabel: string;
  linkedOfferCount: number;
  hasNotes: boolean;
  emailDomain: string;
};

export type AccountsConsoleOverview = {
  totalAccounts: number;
  activeAccounts: number;
  pausedAccounts: number;
  linkedOfferCount: number;
  platformCount: number;
  payoutMethodCount: number;
};

export type AccountsConsoleData = {
  overview: AccountsConsoleOverview;
  rows: AccountConsoleRow[];
};

const payoutLabelMap = Object.fromEntries(
  PAYOUT_OPTIONS.map((option) => [option.value, option.label])
) as Record<CashbackAccount["payoutMethod"], string>;

const platformLabelMap = Object.fromEntries(
  PLATFORM_OPTIONS.map((option) => [option.value, option.label])
) as Record<CashbackAccount["platformCode"], string>;

function getEmailDomain(email: string) {
  const domain = email.split("@")[1] || "";
  return domain.trim().toLowerCase();
}

export function buildAccountsConsole(
  accounts: CashbackAccount[],
  offers: OfferRecord[],
  filters: AccountsConsoleFilters
): AccountsConsoleData {
  const linkedOffersByAccount = new Map<number, number>();
  for (const offer of offers) {
    linkedOffersByAccount.set(
      offer.cashbackAccountId,
      (linkedOffersByAccount.get(offer.cashbackAccountId) || 0) + 1
    );
  }

  const rows = accounts.map<AccountConsoleRow>((account) => ({
    account,
    platformLabel: platformLabelMap[account.platformCode] || account.platformCode,
    payoutLabel: payoutLabelMap[account.payoutMethod] || account.payoutMethod,
    linkedOfferCount: linkedOffersByAccount.get(account.id) || 0,
    hasNotes: Boolean(account.notes?.trim()),
    emailDomain: getEmailDomain(account.registerEmail)
  }));

  const search = filters.search.trim().toLowerCase();
  const filteredRows = rows.filter((row) => {
    if (filters.platformCode !== "all" && row.account.platformCode !== filters.platformCode) {
      return false;
    }

    if (filters.status !== "all" && row.account.status !== filters.status) {
      return false;
    }

    if (filters.payoutMethod !== "all" && row.account.payoutMethod !== filters.payoutMethod) {
      return false;
    }

    if (!search) {
      return true;
    }

    const searchableText = [
      row.account.accountName,
      row.account.registerEmail,
      row.account.notes || "",
      row.platformLabel,
      row.payoutLabel,
      row.emailDomain
    ]
      .join(" ")
      .toLowerCase();

    return searchableText.includes(search);
  });

  filteredRows.sort((left, right) => {
    switch (filters.sort) {
      case "name":
        return left.account.accountName.localeCompare(right.account.accountName, "zh-CN");
      case "platform":
        return (
          left.platformLabel.localeCompare(right.platformLabel, "zh-CN") ||
          left.account.accountName.localeCompare(right.account.accountName, "zh-CN")
        );
      case "linked-offers":
        return (
          right.linkedOfferCount - left.linkedOfferCount ||
          right.account.id - left.account.id
        );
      case "recent":
      default:
        return (
          Date.parse(right.account.createdAt) - Date.parse(left.account.createdAt) ||
          right.account.id - left.account.id
        );
    }
  });

  return {
    overview: {
      totalAccounts: accounts.length,
      activeAccounts: rows.filter((row) => row.account.status === "active").length,
      pausedAccounts: rows.filter((row) => row.account.status === "paused").length,
      linkedOfferCount: offers.length,
      platformCount: new Set(accounts.map((account) => account.platformCode)).size,
      payoutMethodCount: new Set(accounts.map((account) => account.payoutMethod)).size
    },
    rows: filteredRows
  };
}
