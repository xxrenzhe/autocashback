import { LINK_SWAP_ALLOWED_INTERVALS_MINUTES } from "@autocashback/domain";

import { getOfferById, getProxyUrls } from "./operations";
import { getGoogleAdsCredentialStatus } from "./google-ads";

export function validateLinkSwapTaskConfig(intervalMinutes: number, durationDays: number) {
  if (!LINK_SWAP_ALLOWED_INTERVALS_MINUTES.includes(intervalMinutes)) {
    return {
      valid: false as const,
      error: `换链接间隔必须是以下值之一：${LINK_SWAP_ALLOWED_INTERVALS_MINUTES.join(", ")} 分钟`
    };
  }

  if (durationDays !== -1 && (durationDays < 1 || durationDays > 365)) {
    return {
      valid: false as const,
      error: '任务持续天数必须在 1-365 天之间，或选择"不限期"'
    };
  }

  return { valid: true as const };
}

export async function validateLinkSwapTaskPrerequisites(input: {
  userId: number;
  offerId: number;
  mode: "script" | "google_ads_api";
}) {
  const offer = await getOfferById(input.userId, input.offerId);
  if (!offer) {
    return { valid: false as const, status: 404, error: "Offer 不存在" };
  }

  const proxyUrls = await getProxyUrls(input.userId, offer.targetCountry);
  if (!proxyUrls.length) {
    return {
      valid: false as const,
      status: 400,
      error: `未配置 ${offer.targetCountry} 国家的代理。请先前往设置页面补齐代理后再保存换链接任务。`
    };
  }

  if (input.mode === "google_ads_api") {
    const credentials = await getGoogleAdsCredentialStatus(input.userId);
    if (!credentials.hasCredentials || !credentials.hasRefreshToken) {
      return {
        valid: false as const,
        status: 400,
        error: "请先在设置页面完成 Google Ads API 配置并完成 OAuth 授权"
      };
    }
  }

  return {
    valid: true as const,
    offer,
    proxyUrls
  };
}
