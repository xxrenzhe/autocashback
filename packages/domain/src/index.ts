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

export interface ProxySettingEntry {
  label: string;
  country: string;
  url: string;
  active: boolean;
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
 *
 * 使用方式：
 * 1. 保持 API_BASE_URL 和 SCRIPT_TOKEN 为平台生成值
 * 2. 把 CAMPAIGN_LABEL 改成你在 Google Ads 中绑定的标签名
 * 3. 复制到 Google Ads Scripts / MCC 脚本里定时执行
 */
const API_BASE_URL = "__APP_URL__";
const SCRIPT_TOKEN = "__SCRIPT_TOKEN__";
const CAMPAIGN_LABEL = "__CAMPAIGN_LABEL__";
const DRY_RUN = false;

function main() {
  Logger.log("[AutoCashBack] script started at " + new Date().toISOString());

  const snapshot = fetchSnapshot(CAMPAIGN_LABEL);
  const tasks = snapshot.tasks || [];

  if (!tasks.length) {
    Logger.log("[AutoCashBack] no tasks returned from snapshot");
    return;
  }

  let updatedCampaigns = 0;
  let updatedSitelinks = 0;
  let skippedTasks = 0;

  for (let index = 0; index < tasks.length; index += 1) {
    const task = tasks[index];

    if (!task.finalUrlSuffix) {
      skippedTasks += 1;
      Logger.log("[AutoCashBack] skip task without suffix: offerId=" + task.offerId);
      continue;
    }

    const campaigns = AdsApp.campaigns().get();
    let matchedCampaign = false;

    while (campaigns.hasNext()) {
      const campaign = campaigns.next();
      if (!entityHasLabel(campaign, task.campaignLabel)) {
        continue;
      }

      matchedCampaign = true;
      if (updateCampaignSuffix(campaign, task.finalUrlSuffix)) {
        updatedCampaigns += 1;
      }
      updatedSitelinks += updateCampaignSitelinks(campaign, task.finalUrlSuffix);
    }

    if (!matchedCampaign) {
      Logger.log("[AutoCashBack] no campaign matched label: " + task.campaignLabel);
    }
  }

  Logger.log(
    "[AutoCashBack] finished. tasks=" + tasks.length +
      ", updatedCampaigns=" + updatedCampaigns +
      ", updatedSitelinks=" + updatedSitelinks +
      ", skippedTasks=" + skippedTasks
  );
}

function fetchSnapshot(campaignLabel) {
  let endpoint = API_BASE_URL + "/api/script/link-swap/snapshot";
  if (campaignLabel) {
    endpoint += "?campaignLabel=" + encodeURIComponent(campaignLabel);
  }

  const response = UrlFetchApp.fetch(endpoint, {
    method: "get",
    headers: {
      "X-Script-Token": SCRIPT_TOKEN
    },
    muteHttpExceptions: true
  });

  const code = response.getResponseCode();
  const body = response.getContentText();

  if (code >= 400) {
    throw new Error("[AutoCashBack] snapshot request failed: " + code + " " + body);
  }

  return JSON.parse(body);
}

function updateCampaignSuffix(campaign, finalUrlSuffix) {
  const urls = campaign.urls();
  const current = safeGetFinalUrlSuffix(urls);

  if (current === finalUrlSuffix) {
    return false;
  }

  if (!DRY_RUN) {
    urls.setFinalUrlSuffix(finalUrlSuffix);
  }

  Logger.log(
    "[AutoCashBack] campaign updated: " +
      campaign.getName() +
      " => " +
      finalUrlSuffix
  );

  return true;
}

function updateCampaignSitelinks(campaign, finalUrlSuffix) {
  let updated = 0;

  try {
    const sitelinks = campaign.extensions().sitelinks().get();
    while (sitelinks.hasNext()) {
      const sitelink = sitelinks.next();
      const urls = sitelink.urls();
      const current = safeGetFinalUrlSuffix(urls);

      if (current === finalUrlSuffix) {
        continue;
      }

      if (!DRY_RUN) {
        urls.setFinalUrlSuffix(finalUrlSuffix);
      }

      updated += 1;
    }
  } catch (error) {
    Logger.log(
      "[AutoCashBack] sitelink update skipped for campaign " +
        campaign.getName() +
        ": " +
        error
    );
  }

  return updated;
}

function entityHasLabel(entity, labelName) {
  if (!labelName) {
    return true;
  }

  const labels = entity.labels().get();
  while (labels.hasNext()) {
    if (labels.next().getName() === labelName) {
      return true;
    }
  }
  return false;
}

function safeGetFinalUrlSuffix(urls) {
  try {
    return urls.getFinalUrlSuffix();
  } catch (error) {
    Logger.log("[AutoCashBack] unable to read final URL suffix: " + error);
    return "";
  }
}
`;

export function renderScriptTemplate(
  rawTemplate: string,
  input: { appUrl: string; scriptToken: string }
) {
  return rawTemplate
    .replaceAll("__APP_URL__", input.appUrl)
    .replaceAll("__SCRIPT_TOKEN__", input.scriptToken);
}
