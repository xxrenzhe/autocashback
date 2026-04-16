import { NextResponse, type NextRequest } from "next/server";

import { listLinkSwapTasks, updateLinkSwapTask } from "@autocashback/db";

import { getRequestUser } from "@/lib/api-auth";
import {
  validateLinkSwapTaskConfig,
  validateLinkSwapTaskPrerequisites
} from "@autocashback/db";

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

    const durationDays = Number(body.durationDays ?? -1);
    const configValidation = validateLinkSwapTaskConfig(intervalMinutes, durationDays);
    if (!configValidation.valid) {
      return NextResponse.json({ error: configValidation.error }, { status: 400 });
    }

    const prerequisiteValidation = await validateLinkSwapTaskPrerequisites({
      userId: user.id,
      offerId,
      mode
    });
    if (!prerequisiteValidation.valid) {
      return NextResponse.json(
        {
          error: prerequisiteValidation.error
        },
        { status: prerequisiteValidation.status }
      );
    }

    const task = await updateLinkSwapTask(user.id, offerId, {
      enabled: Boolean(body.enabled),
      intervalMinutes,
      durationDays,
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
