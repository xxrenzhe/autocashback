import type { LinkSwapTaskRecord } from "@autocashback/domain";
import {
  getGoogleAdsCredentialStatus,
  getOfferById,
  getProxyUrls
} from "@autocashback/db";

type RunnableTask = Pick<
  LinkSwapTaskRecord,
  "offerId" | "mode" | "googleCustomerId" | "googleCampaignId"
>;

export async function getLinkSwapTaskRunPrecheckError(
  userId: number,
  task: RunnableTask
) {
  const offer = await getOfferById(userId, task.offerId);
  if (!offer) {
    return "Offer 不存在";
  }

  const proxyUrls = await getProxyUrls(userId, offer.targetCountry);
  if (!proxyUrls.length) {
    return `未配置 ${offer.targetCountry} 国家的代理。请先前往设置页面补齐代理后再执行换链接任务。`;
  }

  if (task.mode === "google_ads_api") {
    if (!task.googleCustomerId || !task.googleCampaignId) {
      return "Google Ads API 模式缺少 Customer ID 或 Campaign ID";
    }

    const credentials = await getGoogleAdsCredentialStatus(userId);
    if (!credentials.hasCredentials || !credentials.hasRefreshToken) {
      return "请先在设置页面完成 Google Ads API 配置并完成 OAuth 授权";
    }
  }

  return null;
}
