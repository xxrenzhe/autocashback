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
 * 2. 在 Google Ads 中为目标 Campaign 绑定与 Offer 一致的标签
 * 3. 复制到 Google Ads Scripts / MCC 脚本里定时执行，无需额外编辑
 */
const API_BASE_URL = "__APP_URL__";
const SCRIPT_TOKEN = "__SCRIPT_TOKEN__";
const DRY_RUN = false;

function main() {
  Logger.log("[AutoCashBack] script started at " + new Date().toISOString());

  var snapshot = fetchSnapshot();
  var tasks = snapshot.tasks || [];

  if (!tasks.length) {
    Logger.log("[AutoCashBack] no tasks returned from snapshot");
    return;
  }

  var taskMap = buildTaskMap(tasks);
  var taskLabels = Object.keys(taskMap);
  if (!taskLabels.length) {
    Logger.log("[AutoCashBack] no valid tasks with campaignLabel and suffix");
    return;
  }

  var campaigns = AdsApp.campaigns().get();
  var updatedCampaigns = 0;
  var updatedSitelinks = 0;
  var matchedCampaigns = 0;
  var skippedCampaigns = 0;
  var updatedSitelinkIds = {};

  while (campaigns.hasNext()) {
    var campaign = campaigns.next();
    var match = findMatchedTaskForCampaign(campaign, taskMap);

    if (!match) {
      continue;
    }

    if (match.skipReason) {
      skippedCampaigns += 1;
      Logger.log(
        "[AutoCashBack] skip campaign " +
          campaign.getName() +
          ": " +
          match.skipReason
      );
      continue;
    }

    matchedCampaigns += 1;
    if (updateCampaignSuffix(campaign, match.task.finalUrlSuffix, match.labelName)) {
      updatedCampaigns += 1;
    }
    updatedSitelinks += updateCampaignSitelinks(
      campaign,
      match.task.finalUrlSuffix,
      updatedSitelinkIds
    );
  }

  Logger.log(
    "[AutoCashBack] finished. taskLabels=" + taskLabels.length +
      ", matchedCampaigns=" + matchedCampaigns +
      ", updatedCampaigns=" + updatedCampaigns +
      ", updatedSitelinks=" + updatedSitelinks +
      ", skippedCampaigns=" + skippedCampaigns
  );
}

function fetchSnapshot() {
  var response = UrlFetchApp.fetch(API_BASE_URL + "/api/script/link-swap/snapshot", {
    method: "get",
    headers: {
      "X-Script-Token": SCRIPT_TOKEN
    },
    muteHttpExceptions: true
  });

  var code = response.getResponseCode();
  var body = response.getContentText();

  if (code >= 400) {
    throw new Error("[AutoCashBack] snapshot request failed: " + code + " " + body);
  }

  return JSON.parse(body);
}

function buildTaskMap(tasks) {
  var taskMap = {};

  for (var index = 0; index < tasks.length; index += 1) {
    var task = tasks[index];

    if (!task.campaignLabel) {
      Logger.log("[AutoCashBack] skip task without campaignLabel: offerId=" + task.offerId);
      continue;
    }

    if (!task.finalUrlSuffix) {
      Logger.log("[AutoCashBack] skip task without suffix: offerId=" + task.offerId);
      continue;
    }

    if (taskMap[task.campaignLabel]) {
      Logger.log(
        "[AutoCashBack] duplicate campaignLabel from snapshot, keep first: " +
          task.campaignLabel
      );
      continue;
    }

    taskMap[task.campaignLabel] = task;
  }

  return taskMap;
}

function findMatchedTaskForCampaign(campaign, taskMap) {
  var labels = campaign.labels().get();
  var matchedLabels = [];

  while (labels.hasNext()) {
    var labelName = labels.next().getName();
    if (taskMap[labelName]) {
      matchedLabels.push(labelName);
    }
  }

  if (!matchedLabels.length) {
    return null;
  }

  if (matchedLabels.length > 1) {
    return {
      skipReason: "multiple matched labels: " + matchedLabels.join(", ")
    };
  }

  return {
    labelName: matchedLabels[0],
    task: taskMap[matchedLabels[0]]
  };
}

function updateCampaignSuffix(campaign, finalUrlSuffix, labelName) {
  var urls = campaign.urls();
  var current = safeGetFinalUrlSuffix(urls);

  if (current === finalUrlSuffix) {
    return false;
  }

  if (!DRY_RUN) {
    urls.setFinalUrlSuffix(finalUrlSuffix);
  }

  Logger.log(
    "[AutoCashBack] campaign updated: " +
      campaign.getName() +
      " label=" +
      labelName +
      " => " +
      finalUrlSuffix
  );

  return true;
}

function updateCampaignSitelinks(campaign, finalUrlSuffix, updatedSitelinkIds) {
  var updated = 0;

  try {
    var sitelinks = campaign.extensions().sitelinks().get();
    while (sitelinks.hasNext()) {
      var sitelink = sitelinks.next();
      var sitelinkKey = getSitelinkKey(sitelink);
      if (sitelinkKey && updatedSitelinkIds[sitelinkKey]) {
        continue;
      }

      var urls = sitelink.urls();
      var current = safeGetFinalUrlSuffix(urls);

      if (current === finalUrlSuffix) {
        if (sitelinkKey) {
          updatedSitelinkIds[sitelinkKey] = true;
        }
        continue;
      }

      if (!DRY_RUN) {
        urls.setFinalUrlSuffix(finalUrlSuffix);
      }

      updated += 1;
      if (sitelinkKey) {
        updatedSitelinkIds[sitelinkKey] = true;
      }
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

function getSitelinkKey(sitelink) {
  try {
    return "id:" + sitelink.getId();
  } catch (error) {
    Logger.log("[AutoCashBack] unable to read sitelink id: " + error);
    return "";
  }
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
