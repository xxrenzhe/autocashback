import { NextResponse, type NextRequest } from "next/server";

import {
  enableLinkSwapTask,
  getGoogleAdsCredentialStatus,
  getLinkSwapTaskById,
  getOfferById,
  getProxyUrls
} from "@autocashback/db";

import { getRequestUser } from "@/lib/api-auth";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const taskId = Number(params.id);
  if (!Number.isFinite(taskId)) {
    return NextResponse.json({ error: "无效的任务 ID" }, { status: 400 });
  }

  const task = await getLinkSwapTaskById(user.id, taskId);
  if (!task) {
    return NextResponse.json({ error: "换链接任务不存在" }, { status: 404 });
  }

  if (task.enabled && task.status === "ready") {
    return NextResponse.json({ error: "任务已经是启用状态" }, { status: 400 });
  }

  const offer = await getOfferById(user.id, task.offerId);
  if (!offer) {
    return NextResponse.json({ error: "Offer 不存在" }, { status: 404 });
  }

  const proxyUrls = await getProxyUrls(user.id, offer.targetCountry);
  if (!proxyUrls.length) {
    return NextResponse.json(
      {
        error: `未配置 ${offer.targetCountry} 国家的代理。请先前往设置页面补齐代理后再启用任务。`
      },
      { status: 400 }
    );
  }

  if (task.mode === "google_ads_api") {
    if (!task.googleCustomerId || !task.googleCampaignId) {
      return NextResponse.json(
        { error: "Google Ads API 模式缺少 Customer ID 或 Campaign ID" },
        { status: 400 }
      );
    }

    const credentials = await getGoogleAdsCredentialStatus(user.id);
    if (!credentials.hasCredentials || !credentials.hasRefreshToken) {
      return NextResponse.json(
        { error: "请先在设置页面完成 Google Ads API 配置并完成 OAuth 授权" },
        { status: 400 }
      );
    }
  }

  const enabledTask = await enableLinkSwapTask(user.id, taskId);

  return NextResponse.json({
    success: true,
    data: enabledTask,
    task: enabledTask,
    message: "任务已启用"
  });
}
