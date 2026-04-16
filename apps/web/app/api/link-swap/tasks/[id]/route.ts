import { NextResponse, type NextRequest } from "next/server";

import {
  getLinkSwapTaskById,
  updateLinkSwapTask,
  validateLinkSwapTaskConfig,
  validateLinkSwapTaskPrerequisites
} from "@autocashback/db";

import { getRequestUser } from "@/lib/api-auth";

export async function GET(
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

  return NextResponse.json({
    success: true,
    data: task,
    task,
    message: "已找到换链接任务"
  });
}

export async function PUT(
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

  const existingTask = await getLinkSwapTaskById(user.id, taskId);
  if (!existingTask) {
    return NextResponse.json({ error: "换链接任务不存在" }, { status: 404 });
  }

  try {
    const body = await request.json();

    if (body.offerId !== undefined && Number(body.offerId) !== existingTask.offerId) {
      return NextResponse.json({ error: "不允许修改任务关联的 Offer" }, { status: 400 });
    }

    const mode = body.mode === "google_ads_api" ? "google_ads_api" : "script";
    const intervalMinutes = Number(body.intervalMinutes ?? existingTask.intervalMinutes);
    const durationDays = Number(body.durationDays ?? existingTask.durationDays ?? -1);
    const googleCustomerId =
      body.googleCustomerId !== undefined
        ? body.googleCustomerId
          ? String(body.googleCustomerId).trim()
          : null
        : existingTask.googleCustomerId;
    const googleCampaignId =
      body.googleCampaignId !== undefined
        ? body.googleCampaignId
          ? String(body.googleCampaignId).trim()
          : null
        : existingTask.googleCampaignId;

    if (mode === "google_ads_api" && (!googleCustomerId || !googleCampaignId)) {
      return NextResponse.json(
        { error: "Google Ads API 模式必须填写 Customer ID 和 Campaign ID" },
        { status: 400 }
      );
    }

    const configValidation = validateLinkSwapTaskConfig(intervalMinutes, durationDays);
    if (!configValidation.valid) {
      return NextResponse.json({ error: configValidation.error }, { status: 400 });
    }

    const prerequisiteValidation = await validateLinkSwapTaskPrerequisites({
      userId: user.id,
      offerId: existingTask.offerId,
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

    const task = await updateLinkSwapTask(user.id, existingTask.offerId, {
      enabled: Boolean(body.enabled ?? existingTask.enabled),
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
