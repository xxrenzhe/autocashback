import { NextResponse, type NextRequest } from "next/server";

import {
  createClickFarmTask,
  enqueueQueueTask,
  listClickFarmTasks,
  updateClickFarmTask
} from "@autocashback/db";
import { buildClickFarmTriggerQueueTaskId, getTimezoneForCountry } from "@autocashback/domain";

import { getRequestUser } from "@/lib/api-auth";

function normalizePositiveNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeDurationDays(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 14;
  }

  return parsed === -1 ? -1 : parsed > 0 ? parsed : 14;
}

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

function shouldEnqueueImmediately(nextRunAt: string | null | undefined) {
  const parsed = Date.parse(String(nextRunAt || ""));
  return Number.isFinite(parsed) && parsed <= Date.now();
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
    const dailyClickCount = normalizePositiveNumber(body.dailyClickCount, 216);
    const task = await createClickFarmTask(user.id, {
      offerId: Number(body.offerId),
      dailyClickCount,
      startTime: String(body.startTime || "06:00"),
      endTime: String(body.endTime || "24:00"),
      durationDays: normalizeDurationDays(body.durationDays),
      scheduledStartDate: String(
        body.scheduledStartDate || new Date().toISOString().slice(0, 10)
      ),
      hourlyDistribution: normalizeDistribution(body.hourlyDistribution, dailyClickCount),
      timezone: body.timezone ? String(body.timezone) : getTimezoneForCountry(body.targetCountry || ""),
      refererConfig: body.refererConfig || null
    });

    if (shouldEnqueueImmediately(task.nextRunAt)) {
      await enqueueQueueTask({
        id: buildClickFarmTriggerQueueTaskId(task.id, task.nextRunAt),
        type: "click-farm-trigger",
        userId: user.id,
        payload: { clickFarmTaskId: task.id },
        priority: "high",
        maxRetries: 0
      });
    }

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
    const dailyClickCount = normalizePositiveNumber(body.dailyClickCount, 216);
    const task = await updateClickFarmTask(user.id, Number(body.id), {
      offerId: Number(body.offerId),
      dailyClickCount,
      startTime: String(body.startTime || "06:00"),
      endTime: String(body.endTime || "24:00"),
      durationDays: normalizeDurationDays(body.durationDays),
      scheduledStartDate: String(
        body.scheduledStartDate || new Date().toISOString().slice(0, 10)
      ),
      hourlyDistribution: normalizeDistribution(body.hourlyDistribution, dailyClickCount),
      timezone: body.timezone ? String(body.timezone) : getTimezoneForCountry(body.targetCountry || ""),
      refererConfig: body.refererConfig || null
    });

    if (shouldEnqueueImmediately(task.nextRunAt)) {
      await enqueueQueueTask({
        id: buildClickFarmTriggerQueueTaskId(task.id, task.nextRunAt),
        type: "click-farm-trigger",
        userId: user.id,
        payload: { clickFarmTaskId: task.id },
        priority: "high",
        maxRetries: 0
      });
    }

    return NextResponse.json({ task });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "更新补点击任务失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
