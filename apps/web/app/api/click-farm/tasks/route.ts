import { NextResponse, type NextRequest } from "next/server";

import {
  createClickFarmTask,
  listClickFarmTasks,
  updateClickFarmTask
} from "@autocashback/db";
import { getTimezoneForCountry } from "@autocashback/domain";

import { getRequestUser } from "@/lib/api-auth";

function normalizeDistribution(value: unknown, dailyClickCount: number) {
  if (Array.isArray(value) && value.length === 24) {
    return value.map((item) => Number(item || 0));
  }

  const perHour = Math.floor(dailyClickCount / 18);
  const distribution = Array.from({ length: 24 }, (_, hour) => (hour >= 6 ? perHour : 0));
  const remainder = dailyClickCount - distribution.reduce((sum, count) => sum + count, 0);
  distribution[12] += remainder;
  return distribution;
}

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ tasks: await listClickFarmTasks(user.id) });
}

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const dailyClickCount = Number(body.dailyClickCount || 216);
    const task = await createClickFarmTask(user.id, {
      offerId: Number(body.offerId),
      dailyClickCount,
      startTime: String(body.startTime || "06:00"),
      endTime: String(body.endTime || "24:00"),
      durationDays: Number(body.durationDays || 14),
      scheduledStartDate: String(
        body.scheduledStartDate || new Date().toISOString().slice(0, 10)
      ),
      hourlyDistribution: normalizeDistribution(body.hourlyDistribution, dailyClickCount),
      timezone: body.timezone ? String(body.timezone) : getTimezoneForCountry(body.targetCountry || ""),
      refererConfig: body.refererConfig || null
    });

    return NextResponse.json({ task });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "创建补点击任务失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PUT(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const dailyClickCount = Number(body.dailyClickCount || 216);
    const task = await updateClickFarmTask(user.id, Number(body.id), {
      offerId: Number(body.offerId),
      dailyClickCount,
      startTime: String(body.startTime || "06:00"),
      endTime: String(body.endTime || "24:00"),
      durationDays: Number(body.durationDays || 14),
      scheduledStartDate: String(
        body.scheduledStartDate || new Date().toISOString().slice(0, 10)
      ),
      hourlyDistribution: normalizeDistribution(body.hourlyDistribution, dailyClickCount),
      timezone: body.timezone ? String(body.timezone) : getTimezoneForCountry(body.targetCountry || ""),
      refererConfig: body.refererConfig || null
    });

    return NextResponse.json({ task });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "更新补点击任务失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
