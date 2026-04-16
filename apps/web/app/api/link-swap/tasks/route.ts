import { NextResponse, type NextRequest } from "next/server";

import { LINK_SWAP_ALLOWED_INTERVALS_MINUTES } from "@autocashback/domain";
import {
  getGoogleAdsCredentialStatus,
  getOfferById,
  getProxyUrls,
  listLinkSwapTasks,
  updateLinkSwapTask
} from "@autocashback/db";

import { getRequestUser } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tasks = await listLinkSwapTasks(user.id);
  const payload = {
    tasks,
    pagination: {
      page: 1,
      limit: tasks.length || 20,
      total: tasks.length,
      totalPages: 1
    }
  };

  return NextResponse.json({
    ...payload,
    success: true,
    data: payload
  });
}

export async function PUT(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const mode = body.mode === "google_ads_api" ? "google_ads_api" : "script";
    const offerId = Number(body.offerId);
    const intervalMinutes = Number(body.intervalMinutes || 60);
    const googleCustomerId = body.googleCustomerId ? String(body.googleCustomerId).trim() : null;
    const googleCampaignId = body.googleCampaignId ? String(body.googleCampaignId).trim() : null;

    if (!Number.isFinite(offerId)) {
      return NextResponse.json({ error: "无效的 Offer ID" }, { status: 400 });
    }

    if (mode === "google_ads_api" && (!googleCustomerId || !googleCampaignId)) {
      return NextResponse.json(
        { error: "Google Ads API 模式必须填写 Customer ID 和 Campaign ID" },
        { status: 400 }
      );
    }

    if (!LINK_SWAP_ALLOWED_INTERVALS_MINUTES.includes(intervalMinutes)) {
      return NextResponse.json(
        {
          error: `换链接间隔必须是以下值之一：${LINK_SWAP_ALLOWED_INTERVALS_MINUTES.join(", ")} 分钟`
        },
        { status: 400 }
      );
    }

    const offer = await getOfferById(user.id, offerId);
    if (!offer) {
      return NextResponse.json({ error: "Offer 不存在" }, { status: 404 });
    }

    const proxyUrls = await getProxyUrls(user.id, offer.targetCountry);
    if (!proxyUrls.length) {
      return NextResponse.json(
        {
          error: `未配置 ${offer.targetCountry} 国家的代理。请先前往设置页面补齐代理后再保存换链接任务。`
        },
        { status: 400 }
      );
    }

    if (mode === "google_ads_api") {
      const credentials = await getGoogleAdsCredentialStatus(user.id);
      if (!credentials.hasCredentials || !credentials.hasRefreshToken) {
        return NextResponse.json(
          {
            error: "请先在设置页面完成 Google Ads API 配置并完成 OAuth 授权"
          },
          { status: 400 }
        );
      }
    }

    const task = await updateLinkSwapTask(user.id, offerId, {
      enabled: Boolean(body.enabled),
      intervalMinutes,
      durationDays: Number(body.durationDays ?? -1),
      mode,
      googleCustomerId,
      googleCampaignId
    });

    return NextResponse.json({
      success: true,
      data: task,
      task,
      message: "换链接任务更新成功"
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "换链接任务更新失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
