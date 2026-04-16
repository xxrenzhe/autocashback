import axios from "axios";
import { HttpsProxyAgent } from "https-proxy-agent";

import {
  completeClickFarmTask,
  createServiceLogger,
  enqueueQueueTask,
  getClickFarmTaskExecutionContext,
  getProxyUrls,
  recordClickFarmTaskRun,
  setClickFarmTaskPaused
} from "@autocashback/db";
import {
  buildClickFarmTriggerQueueTaskId,
  type ClickFarmTask,
  type QueueTaskRecord
} from "@autocashback/domain";

const DEFAULT_REFERERS = [
  "https://www.facebook.com/",
  "https://www.instagram.com/",
  "https://www.linkedin.com/",
  "https://www.reddit.com/",
  "https://x.com/",
  "https://www.youtube.com/"
];

const CLICK_FARM_BATCH_SIZE = (() => {
  const parsed = parseInt(process.env.CLICK_FARM_BATCH_SIZE || "10", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 10;
})();

const logger = createServiceLogger("autocashback-scheduler");

type ClickFarmTriggerPayload = {
  clickFarmTaskId: number;
};

type ClickFarmBatchPayload = {
  clickFarmTaskId: number;
  offerId: number;
  url: string;
  proxyUrl: string;
  timezone: string;
  targetDate: string;
  targetHour: number;
  totalClicks: number;
  dispatchedClicks: number;
  batchSize: number;
  refererConfig?: ClickFarmTask["refererConfig"];
};

type ClickFarmClickPayload = {
  clickFarmTaskId: number;
  offerId: number;
  url: string;
  proxyUrl: string;
  timezone: string;
  scheduledAt: string;
  refererConfig?: ClickFarmTask["refererConfig"];
};

function randomInt(max: number) {
  return Math.floor(Math.random() * max);
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000).toISOString();
}

function getFormatter(timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

function getLocalParts(date: Date, timeZone: string) {
  const parts = getFormatter(timeZone).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(values.year || 0),
    month: Number(values.month || 0),
    day: Number(values.day || 0),
    hour: Number(values.hour || 0),
    minute: Number(values.minute || 0)
  };
}

function getLocalDateString(date: Date, timeZone: string) {
  const parts = getLocalParts(date, timeZone);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map((item) => Number(item || 0));
  return hours * 60 + minutes;
}

function parseDateString(value: string) {
  const [year, month, day] = value.split("-").map((item) => Number(item || 0));
  return new Date(Date.UTC(year, month - 1, day));
}

function diffDays(left: string, right: string) {
  const leftDate = parseDateString(left);
  const rightDate = parseDateString(right);
  return Math.floor((leftDate.getTime() - rightDate.getTime()) / 86_400_000);
}

function ensureDailyHistory(task: ClickFarmTask, localDate: string) {
  const existing = [...task.dailyHistory];
  const found = existing.find((item) => item.date === localDate);
  if (found) {
    return existing;
  }

  return [
    ...existing,
    {
      date: localDate,
      target: task.dailyClickCount,
      actual: 0,
      success: 0,
      failed: 0,
      hourlyBreakdown: task.hourlyDistribution.map((target) => ({
        target,
        actual: 0,
        success: 0,
        failed: 0
      }))
    }
  ];
}

function resolveReferer(task: ClickFarmTask, override?: ClickFarmTask["refererConfig"]) {
  const config = override || task.refererConfig;
  if (!config || config.type === "none") {
    return undefined;
  }

  if (config.type === "random") {
    return DEFAULT_REFERERS[randomInt(DEFAULT_REFERERS.length)];
  }

  return config.referer || undefined;
}

async function performClickFarmRequest(input: {
  promoLink: string;
  proxyUrl: string | null;
  referer?: string;
}) {
  const agent = input.proxyUrl ? new HttpsProxyAgent(input.proxyUrl) : undefined;

  const response = await axios.get(input.promoLink, {
    maxRedirects: 10,
    timeout: 20_000,
    validateStatus: () => true,
    headers: {
      ...(input.referer ? { Referer: input.referer } : {}),
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    },
    httpAgent: agent,
    httpsAgent: agent
  });

  return response.status >= 200 && response.status < 500;
}

function buildBatchQueueTaskId(input: ClickFarmBatchPayload) {
  return [
    "click-farm-batch",
    input.clickFarmTaskId,
    input.targetDate,
    String(input.targetHour).padStart(2, "0"),
    input.dispatchedClicks
  ].join(":");
}

function createScheduledAtWithinCurrentHour(now: Date) {
  const remainingMs = Math.max(1_000, (60 - now.getMinutes()) * 60_000 - now.getSeconds() * 1_000);
  return new Date(now.getTime() + randomInt(remainingMs)).toISOString();
}

function computeProgress(task: ClickFarmTask, nextTotalClicks: number, actualForDay: number) {
  const totalTarget =
    task.durationDays === -1
      ? Math.max(task.dailyClickCount, actualForDay)
      : task.dailyClickCount * task.durationDays;

  return task.durationDays === -1
    ? Math.min(100, Math.round((actualForDay / Math.max(1, task.dailyClickCount)) * 100))
    : Math.min(100, Math.round((nextTotalClicks / Math.max(1, totalTarget)) * 100));
}

export async function orchestrateClickFarmTriggerTask(input: {
  userId: number;
  taskId: number;
  nextRunAt: string | null;
}) {
  return {
    id: buildClickFarmTriggerQueueTaskId(input.taskId, input.nextRunAt),
    type: "click-farm-trigger",
    userId: input.userId,
    payload: { clickFarmTaskId: input.taskId } satisfies ClickFarmTriggerPayload,
    priority: "high",
    maxRetries: 0
  } as const;
}

export async function executeClickFarmTrigger(task: QueueTaskRecord) {
  const payload = task.payload as ClickFarmTriggerPayload;
  const clickFarmTaskId = Number(payload.clickFarmTaskId);
  if (!Number.isFinite(clickFarmTaskId)) {
    logger.warn("click_farm_trigger_invalid_payload", {
      taskId: task.id,
      payload: task.payload
    });
    return;
  }

  const clickTask = await getClickFarmTaskExecutionContext(task.userId, clickFarmTaskId);
  if (!clickTask || clickTask.isDeleted) {
    logger.warn("click_farm_trigger_task_missing", {
      queueTaskId: task.id,
      clickFarmTaskId
    });
    return;
  }

  if (clickTask.status !== "pending" && clickTask.status !== "running") {
    return;
  }

  const now = new Date();
  const localDate = getLocalDateString(now, clickTask.timezone);
  const local = getLocalParts(now, clickTask.timezone);
  const currentMinutes = local.hour * 60 + local.minute;
  const startMinutes = timeToMinutes(clickTask.startTime);
  const endMinutes = timeToMinutes(clickTask.endTime);
  const elapsedDays = diffDays(localDate, clickTask.scheduledStartDate);

  if (elapsedDays < 0 || (elapsedDays === 0 && currentMinutes < startMinutes)) {
    await recordClickFarmTaskRun(clickFarmTaskId, {
      status: clickTask.status === "running" ? "running" : "pending",
      totalClicks: clickTask.totalClicks,
      successClicks: clickTask.successClicks,
      failedClicks: clickTask.failedClicks,
      progress: clickTask.progress,
      dailyHistory: clickTask.dailyHistory,
      nextRunAt: addMinutes(now, 15),
      startedAt: clickTask.startedAt ?? null,
      completedAt: clickTask.completedAt ?? null
    });
    return;
  }

  if (clickTask.durationDays !== -1 && elapsedDays >= clickTask.durationDays) {
    await completeClickFarmTask(clickFarmTaskId);
    return;
  }

  if (currentMinutes < startMinutes || currentMinutes >= endMinutes) {
    await recordClickFarmTaskRun(clickFarmTaskId, {
      status: clickTask.startedAt ? "running" : "pending",
      totalClicks: clickTask.totalClicks,
      successClicks: clickTask.successClicks,
      failedClicks: clickTask.failedClicks,
      progress: clickTask.progress,
      dailyHistory: clickTask.dailyHistory,
      nextRunAt: addMinutes(now, 30),
      startedAt: clickTask.startedAt ?? now.toISOString(),
      completedAt: clickTask.completedAt ?? null
    });
    return;
  }

  const proxies = await getProxyUrls(task.userId, clickTask.targetCountry);
  const proxyUrl = proxies[0] || null;
  if (!proxyUrl) {
    await setClickFarmTaskPaused(clickFarmTaskId, `缺少 ${clickTask.targetCountry} 或 GLOBAL 代理`);
    logger.warn("click_farm_task_paused_no_proxy", {
      clickFarmTaskId,
      targetCountry: clickTask.targetCountry
    });
    return;
  }

  const dailyHistory = ensureDailyHistory(clickTask, localDate);
  const dayIndex = dailyHistory.findIndex((item) => item.date === localDate);
  const dayEntry = dailyHistory[dayIndex];
  if (!dayEntry) {
    return;
  }

  const hourlyBreakdown = Array.isArray(dayEntry.hourlyBreakdown)
    ? [...dayEntry.hourlyBreakdown]
    : clickTask.hourlyDistribution.map((target) => ({
        target,
        actual: 0,
        success: 0,
        failed: 0
      }));
  const hourEntry = hourlyBreakdown[local.hour] || {
    target: Number(clickTask.hourlyDistribution[local.hour] || 0),
    actual: 0,
    success: 0,
    failed: 0
  };

  const remainingClicks = Math.max(0, Number(hourEntry.target || 0) - Number(hourEntry.actual || 0));
  if (remainingClicks <= 0) {
    hourlyBreakdown[local.hour] = hourEntry;
    dailyHistory[dayIndex] = {
      ...dayEntry,
      hourlyBreakdown
    };

    await recordClickFarmTaskRun(clickFarmTaskId, {
      status: clickTask.startedAt ? "running" : "pending",
      totalClicks: clickTask.totalClicks,
      successClicks: clickTask.successClicks,
      failedClicks: clickTask.failedClicks,
      progress: clickTask.progress,
      dailyHistory,
      nextRunAt: addMinutes(now, 15),
      startedAt: clickTask.startedAt ?? now.toISOString(),
      completedAt: clickTask.completedAt ?? null
    });
    return;
  }

  const batchPayload: ClickFarmBatchPayload = {
    clickFarmTaskId,
    offerId: clickTask.offerId,
    url: clickTask.promoLink,
    proxyUrl,
    timezone: clickTask.timezone,
    targetDate: localDate,
    targetHour: local.hour,
    totalClicks: remainingClicks,
    dispatchedClicks: 0,
    batchSize: CLICK_FARM_BATCH_SIZE,
    refererConfig: clickTask.refererConfig
  };

  await enqueueQueueTask({
    id: buildBatchQueueTaskId(batchPayload),
    type: "click-farm-batch",
    userId: task.userId,
    payload: batchPayload,
    priority: "normal",
    maxRetries: 0,
    availableAt: addMinutes(now, 0)
  });

  const nextHourRunAt = addMinutes(now, Math.max(1, 60 - local.minute));
  await recordClickFarmTaskRun(clickFarmTaskId, {
    status: "running",
    totalClicks: clickTask.totalClicks,
    successClicks: clickTask.successClicks,
    failedClicks: clickTask.failedClicks,
    progress: clickTask.progress,
    dailyHistory,
    nextRunAt: nextHourRunAt,
    pauseReason: null,
    pauseMessage: null,
    pausedAt: null,
    startedAt: clickTask.startedAt ?? now.toISOString(),
    completedAt: clickTask.completedAt ?? null
  });
}

export async function executeClickFarmBatch(task: QueueTaskRecord) {
  const payload = task.payload as ClickFarmBatchPayload;
  const clickFarmTaskId = Number(payload.clickFarmTaskId);
  if (!Number.isFinite(clickFarmTaskId)) {
    logger.warn("click_farm_batch_invalid_payload", {
      taskId: task.id,
      payload: task.payload
    });
    return;
  }

  const clickTask = await getClickFarmTaskExecutionContext(task.userId, clickFarmTaskId);
  if (!clickTask || clickTask.isDeleted) {
    logger.warn("click_farm_batch_task_missing", {
      queueTaskId: task.id,
      clickFarmTaskId
    });
    return;
  }

  if (clickTask.status !== "pending" && clickTask.status !== "running") {
    return;
  }

  const totalClicks = Math.max(0, Number(payload.totalClicks || 0));
  const dispatchedClicks = Math.max(0, Number(payload.dispatchedClicks || 0));
  const remaining = Math.max(0, totalClicks - dispatchedClicks);
  if (remaining <= 0) {
    return;
  }

  const chunkSize = Math.min(remaining, Math.max(1, Number(payload.batchSize || CLICK_FARM_BATCH_SIZE)));
  const now = new Date();

  for (let index = 0; index < chunkSize; index += 1) {
    const clickPayload: ClickFarmClickPayload = {
      clickFarmTaskId,
      offerId: Number(payload.offerId),
      url: String(payload.url),
      proxyUrl: String(payload.proxyUrl),
      timezone: String(payload.timezone || clickTask.timezone),
      scheduledAt: createScheduledAtWithinCurrentHour(now),
      refererConfig: payload.refererConfig
    };

    await enqueueQueueTask({
      type: "click-farm",
      userId: task.userId,
      payload: clickPayload,
      priority: "low",
      maxRetries: 0,
      availableAt: clickPayload.scheduledAt
    });
  }

  const nextDispatched = dispatchedClicks + chunkSize;
  const nextRemaining = Math.max(0, totalClicks - nextDispatched);
  if (nextRemaining > 0) {
    const nextBatchPayload: ClickFarmBatchPayload = {
      ...payload,
      dispatchedClicks: nextDispatched
    };

    await enqueueQueueTask({
      id: buildBatchQueueTaskId(nextBatchPayload),
      type: "click-farm-batch",
      userId: task.userId,
      payload: nextBatchPayload,
      priority: "low",
      maxRetries: 0,
      availableAt: new Date(Date.now() + 500).toISOString()
    });
  }
}

export async function executeClickFarmClick(task: QueueTaskRecord) {
  const payload = task.payload as ClickFarmClickPayload;
  const clickFarmTaskId = Number(payload.clickFarmTaskId);
  if (!Number.isFinite(clickFarmTaskId)) {
    logger.warn("click_farm_click_invalid_payload", {
      taskId: task.id,
      payload: task.payload
    });
    return;
  }

  const clickTask = await getClickFarmTaskExecutionContext(task.userId, clickFarmTaskId);
  if (!clickTask || clickTask.isDeleted) {
    logger.warn("click_farm_click_task_missing", {
      queueTaskId: task.id,
      clickFarmTaskId
    });
    return;
  }

  if (clickTask.status !== "pending" && clickTask.status !== "running") {
    return;
  }

  const scheduledAt = payload.scheduledAt ? new Date(String(payload.scheduledAt)) : new Date();
  const historyDate = getLocalDateString(scheduledAt, payload.timezone || clickTask.timezone);
  const historyHour = getLocalParts(scheduledAt, payload.timezone || clickTask.timezone).hour;
  const success = await performClickFarmRequest({
    promoLink: String(payload.url || clickTask.promoLink),
    proxyUrl: payload.proxyUrl || null,
    referer: resolveReferer(clickTask, payload.refererConfig)
  }).catch(() => false);

  const dailyHistory = ensureDailyHistory(clickTask, historyDate);
  const dayIndex = dailyHistory.findIndex((item) => item.date === historyDate);
  const dayEntry = dailyHistory[dayIndex];
  if (!dayEntry) {
    return;
  }

  const hourlyBreakdown = Array.isArray(dayEntry.hourlyBreakdown)
    ? [...dayEntry.hourlyBreakdown]
    : clickTask.hourlyDistribution.map((target) => ({
        target,
        actual: 0,
        success: 0,
        failed: 0
      }));
  const hourEntry = hourlyBreakdown[historyHour] || {
    target: Number(clickTask.hourlyDistribution[historyHour] || 0),
    actual: 0,
    success: 0,
    failed: 0
  };

  hourlyBreakdown[historyHour] = {
    ...hourEntry,
    actual: Number(hourEntry.actual || 0) + 1,
    success: Number(hourEntry.success || 0) + (success ? 1 : 0),
    failed: Number(hourEntry.failed || 0) + (success ? 0 : 1)
  };

  const actualForDay = hourlyBreakdown.reduce((sum, item) => sum + item.actual, 0);
  const successForDay = hourlyBreakdown.reduce((sum, item) => sum + item.success, 0);
  const failedForDay = hourlyBreakdown.reduce((sum, item) => sum + item.failed, 0);

  dailyHistory[dayIndex] = {
    ...dayEntry,
    actual: actualForDay,
    success: successForDay,
    failed: failedForDay,
    hourlyBreakdown
  };

  const totalClicks = clickTask.totalClicks + 1;
  const successClicks = clickTask.successClicks + (success ? 1 : 0);
  const failedClicks = clickTask.failedClicks + (success ? 0 : 1);
  const progress = computeProgress(clickTask, totalClicks, actualForDay);

  await recordClickFarmTaskRun(clickFarmTaskId, {
    status: "running",
    totalClicks,
    successClicks,
    failedClicks,
    progress,
    dailyHistory,
    nextRunAt: clickTask.nextRunAt,
    pauseReason: clickTask.pauseReason,
    pauseMessage: clickTask.pauseMessage,
    pausedAt: clickTask.pausedAt,
    startedAt: clickTask.startedAt ?? new Date().toISOString(),
    completedAt: clickTask.completedAt ?? null
  });
}
