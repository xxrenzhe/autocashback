import { NextResponse, type NextRequest } from "next/server";

import { listLinkSwapTasks, updateLinkSwapTask } from "@autocashback/db";

import { getRequestUser } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ tasks: await listLinkSwapTasks(user.id) });
}

export async function PUT(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const mode = body.mode === "google_ads_api" ? "google_ads_api" : "script";
    const googleCustomerId = body.googleCustomerId ? String(body.googleCustomerId).trim() : null;
    const googleCampaignId = body.googleCampaignId ? String(body.googleCampaignId).trim() : null;

    if (mode === "google_ads_api" && (!googleCustomerId || !googleCampaignId)) {
      return NextResponse.json(
        { error: "Google Ads API 模式必须填写 Customer ID 和 Campaign ID" },
        { status: 400 }
      );
    }

    const task = await updateLinkSwapTask(user.id, Number(body.offerId), {
      enabled: Boolean(body.enabled),
      intervalMinutes: Math.max(1, Number(body.intervalMinutes || 60)),
      durationDays: Number(body.durationDays ?? -1),
      mode,
      googleCustomerId,
      googleCampaignId
    });

    return NextResponse.json({ task });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "换链接任务更新失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
