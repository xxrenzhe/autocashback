export type UserRole = "admin" | "user";

export type PlatformCode = "topcashback" | "rakuten" | "custom";

export type PayoutMethod = "paypal" | "ach" | "giftCard";

export type LinkSwapStatus = "idle" | "ready" | "warning" | "error";

export interface CurrentUser {
  id: number;
  username: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

export interface DashboardSummary {
  activeOffers: number;
  activeTasks: number;
  successRate: number;
  warningOffers: number;
}

export interface CashbackAccount {
  id: number;
  userId: number;
  platformCode: PlatformCode;
  accountName: string;
  registerEmail: string;
  payoutMethod: PayoutMethod;
  notes: string | null;
  status: "active" | "paused";
  createdAt: string;
}

export interface OfferRecord {
  id: number;
  userId: number;
  platformCode: PlatformCode;
  cashbackAccountId: number;
  promoLink: string;
  targetCountry: string;
  brandName: string;
  campaignLabel: string;
  commissionCapUsd: number;
  manualRecordedCommissionUsd: number;
  latestResolvedUrl: string | null;
  latestResolvedSuffix: string | null;
  lastResolvedAt: string | null;
  status: "draft" | "active" | "warning";
  createdAt: string;
}

export interface LinkSwapTaskRecord {
  id: number;
  userId: number;
  offerId: number;
  enabled: boolean;
  intervalMinutes: number;
  status: LinkSwapStatus;
  consecutiveFailures: number;
  lastRunAt: string | null;
  nextRunAt: string | null;
}

export interface LinkSwapRunRecord {
  id: number;
  taskId: number;
  offerId: number;
  rawUrl: string;
  resolvedUrl: string | null;
  resolvedSuffix: string | null;
  proxyUrl: string | null;
  status: "success" | "failed";
  errorMessage: string | null;
  createdAt: string;
}

export const PLATFORM_OPTIONS: Array<{ value: PlatformCode; label: string; note: string }> = [
  { value: "topcashback", label: "TopCashback", note: "手工模式，无公开 API" },
  { value: "rakuten", label: "Rakuten", note: "手工模式，无公开 API" },
  { value: "custom", label: "Custom", note: "自定义返利网平台" }
];

export const PAYOUT_OPTIONS: Array<{ value: PayoutMethod; label: string }> = [
  { value: "paypal", label: "PayPal" },
  { value: "ach", label: "银行转账 (ACH)" },
  { value: "giftCard", label: "礼品卡兑换" }
];

export const DEFAULT_SCRIPT_TEMPLATE = `/**
 * AutoCashBack MCC Link Swap Script
 * 1. 替换 API_BASE_URL / SCRIPT_TOKEN / CAMPAIGN_LABEL
 * 2. 在 Google Ads MCC 中按定时任务执行
 */
const API_BASE_URL = "https://www.autocashback.dev";
const SCRIPT_TOKEN = "replace-me";
const CAMPAIGN_LABEL = "replace-me";
`;
