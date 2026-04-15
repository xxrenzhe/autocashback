import "../../../scripts/load-env";

import axios from "axios";
import { HttpsProxyAgent } from "https-proxy-agent";
import cron from "node-cron";

import {
  completeClickFarmTask,
  ensureDatabaseReady,
  expireLinkSwapTask,
  getDueClickFarmTasks,
  getDueLinkSwapTasks,
  getProxyUrls,
  recordClickFarmTaskRun,
  saveLinkSwapRun,
  setClickFarmTaskPaused,
  updateGoogleAdsCampaignSuffix
} from "@autocashback/db";
import type { ClickFarmTask } from "@autocashback/domain";

type ResolutionResult = {
  resolvedUrl: string | null;
  resolvedSuffix: string | null;
  errorMessage: string | null;
  proxyUrl: string | null;
};

type DueTask = {
  id: number;
  user_id: number;
  offer_id: number;
  interval_minutes: number;
  duration_days: number;
  mode: "script" | "google_ads_api";
  google_customer_id: string | null;
  google_campaign_id: string | null;
  activation_started_at: string | null;
  created_at: string;
  promo_link: string;
  brand_name: string;
  target_country: string;
};

type ClickFarmDueTask = ClickFarmTask & {
  promoLink: string;
  targetCountry: string;
  brandName: string;
};

const DEFAULT_REFERERS = [
  "https://www.facebook.com/",
  "https://www.instagram.com/",
  "https://www.linkedin.com/",
  "https://www.reddit.com/",
  "https://x.com/",
  "https://www.youtube.com/"
];

async function resolveOfferLink(rawUrl: string, proxyUrl: string | null): Promise<ResolutionResult> {
  const agent = proxyUrl ? new HttpsProxyAgent(proxyUrl) : undefined;

  try {
    const response = await axios.get(rawUrl, {
      maxRedirects: 10,
      timeout: 20_000,
      validateStatus: () => true,
      httpAgent: agent,
      httpsAgent: agent
    });

    const finalUrl = response.request?.res?.responseUrl || response.config.url || rawUrl;
    const parsed = new URL(finalUrl);

    return {
      resolvedUrl: `${parsed.origin}${parsed.pathname}`,
      resolvedSuffix: parsed.search ? parsed.search.slice(1) : null,
      errorMessage: null,
      proxyUrl
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "终链解析失败";
    return {
      resolvedUrl: null,
      resolvedSuffix: null,
      errorMessage: message,
      proxyUrl
    };
  }
}

function randomInt(max: number) {
  return Math.floor(Math.random() * max);
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

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000).toISOString();
}

function isLinkSwapExpired(task: DueTask, now: Date) {
  if (task.duration_days === -1) {
    return false;
  }

  const startedAt = Date.parse(task.activation_started_at || task.created_at);
  if (!Number.isFinite(startedAt)) {
    return false;
  }

  return now.getTime() >= startedAt + task.duration_days * 86_400_000;
}

function resolveReferer(task: ClickFarmDueTask) {
  const config = task.refererConfig;
  if (!config || config.type === "none") {
    return undefined;
  }

  if (config.type === "random") {
    return DEFAULT_REFERERS[randomInt(DEFAULT_REFERERS.length)];
  }

  return config.referer || undefined;
}

function ensureDailyHistory(task: ClickFarmDueTask, localDate: string) {
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

function computeNextClickFarmRunAt(task: ClickFarmDueTask, date: Date, remainingInHour: number) {
  const local = getLocalParts(date, task.timezone);
  const endMinutes = timeToMinutes(task.endTime);
  const nowMinutes = local.hour * 60 + local.minute;

  if (remainingInHour > 0) {
    const remainingMinutes = Math.max(1, 60 - local.minute);
    const stepMinutes = Math.max(1, Math.ceil(remainingMinutes / remainingInHour));
    return addMinutes(date, stepMinutes);
  }

  if (nowMinutes >= endMinutes) {
    return addMinutes(date, 30);
  }

  return addMinutes(date, 15);
}

async function performClickFarmRequest(task: ClickFarmDueTask, proxyUrl: string | null) {
  const agent = proxyUrl ? new HttpsProxyAgent(proxyUrl) : undefined;
  const referer = resolveReferer(task);

  const response = await axios.get(task.promoLink, {
    maxRedirects: 10,
    timeout: 20_000,
    validateStatus: () => true,
    headers: {
      ...(referer ? { Referer: referer } : {}),
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    },
    httpAgent: agent,
    httpsAgent: agent
  });

  return response.status >= 200 && response.status < 500;
}

export async function runDueLinkSwaps() {
  await ensureDatabaseReady();
  const tasks = (await getDueLinkSwapTasks()) as unknown as DueTask[];
  const now = new Date();

  for (const task of tasks) {
    if (isLinkSwapExpired(task, now)) {
      await expireLinkSwapTask(task.id);
      continue;
    }

    const proxies = await getProxyUrls(task.user_id, String(task.target_country || ""));
    const proxyUrl = proxies[0] || null;
    const result = await resolveOfferLink(task.promo_link, proxyUrl);
    let applyStatus: "not_applicable" | "success" | "failed" = "not_applicable";
    let applyErrorMessage: string | null = null;
    let status: "success" | "failed" = result.errorMessage ? "failed" : "success";

    if (!result.errorMessage && result.resolvedSuffix && task.mode === "google_ads_api") {
      if (!task.google_customer_id || !task.google_campaign_id) {
        applyStatus = "failed";
        applyErrorMessage = "缺少 Google Ads Customer ID 或 Campaign ID";
        status = "failed";
      } else {
        try {
          await updateGoogleAdsCampaignSuffix({
            userId: task.user_id,
            customerId: task.google_customer_id,
            campaignId: task.google_campaign_id,
            finalUrlSuffix: result.resolvedSuffix
          });
          applyStatus = "success";
        } catch (error: unknown) {
          applyStatus = "failed";
          applyErrorMessage = error instanceof Error ? error.message : "Google Ads 更新失败";
          status = "failed";
        }
      }
    }

    await saveLinkSwapRun({
      taskId: task.id,
      offerId: task.offer_id,
      rawUrl: task.promo_link,
      resolvedUrl: result.resolvedUrl,
      resolvedSuffix: result.resolvedSuffix,
      proxyUrl: result.proxyUrl,
      status,
      applyStatus,
      applyErrorMessage,
      errorMessage: result.errorMessage || applyErrorMessage,
      intervalMinutes: task.interval_minutes
    });
  }
}

export async function runDueClickFarmTasks() {
  await ensureDatabaseReady();
  const tasks = (await getDueClickFarmTasks()) as unknown as ClickFarmDueTask[];
  const now = new Date();

  for (const task of tasks) {
    const localDate = getLocalDateString(now, task.timezone);
    const local = getLocalParts(now, task.timezone);
    const currentMinutes = local.hour * 60 + local.minute;
    const startMinutes = timeToMinutes(task.startTime);
    const endMinutes = timeToMinutes(task.endTime);
    const elapsedDays = diffDays(localDate, task.scheduledStartDate);

    if (elapsedDays < 0 || (elapsedDays === 0 && currentMinutes < startMinutes)) {
      await recordClickFarmTaskRun(task.id, {
        status: task.status === "running" ? "running" : "pending",
        totalClicks: task.totalClicks,
        successClicks: task.successClicks,
        failedClicks: task.failedClicks,
        progress: task.progress,
        dailyHistory: task.dailyHistory,
        nextRunAt: addMinutes(now, 15),
        startedAt: task.startedAt ?? null,
        completedAt: task.completedAt ?? null
      });
      continue;
    }

    if (task.durationDays !== -1 && elapsedDays >= task.durationDays) {
      await completeClickFarmTask(task.id);
      continue;
    }

    if (currentMinutes < startMinutes || currentMinutes >= endMinutes) {
      await recordClickFarmTaskRun(task.id, {
        status: task.startedAt ? "running" : "pending",
        totalClicks: task.totalClicks,
        successClicks: task.successClicks,
        failedClicks: task.failedClicks,
        progress: task.progress,
        dailyHistory: task.dailyHistory,
        nextRunAt: addMinutes(now, 30),
        startedAt: task.startedAt ?? now.toISOString(),
        completedAt: task.completedAt ?? null
      });
      continue;
    }

    const proxies = await getProxyUrls(task.userId, task.targetCountry);
    const proxyUrl = proxies[0] || null;
    if (!proxyUrl) {
      await setClickFarmTaskPaused(task.id, `缺少 ${task.targetCountry} 或 GLOBAL 代理`);
      continue;
    }

    const dailyHistory = ensureDailyHistory(task, localDate);
    const dayIndex = dailyHistory.findIndex((item) => item.date === localDate);
    const dayEntry = dailyHistory[dayIndex];
    if (!dayEntry) {
      continue;
    }

    const hourlyBreakdown = Array.isArray(dayEntry.hourlyBreakdown)
      ? [...dayEntry.hourlyBreakdown]
      : task.hourlyDistribution.map((target) => ({
          target,
          actual: 0,
          success: 0,
          failed: 0
        }));
    const hourEntry = hourlyBreakdown[local.hour] || {
      target: Number(task.hourlyDistribution[local.hour] || 0),
      actual: 0,
      success: 0,
      failed: 0
    };

    if (hourEntry.target <= hourEntry.actual) {
      hourlyBreakdown[local.hour] = hourEntry;
      dailyHistory[dayIndex] = {
        ...dayEntry,
        hourlyBreakdown
      };

      await recordClickFarmTaskRun(task.id, {
        status: task.startedAt ? "running" : "pending",
        totalClicks: task.totalClicks,
        successClicks: task.successClicks,
        failedClicks: task.failedClicks,
        progress: task.progress,
        dailyHistory,
        nextRunAt: addMinutes(now, 15),
        startedAt: task.startedAt ?? now.toISOString(),
        completedAt: task.completedAt ?? null
      });
      continue;
    }

    const success = await performClickFarmRequest(task, proxyUrl).catch(() => false);
    const nextHourActual = hourEntry.actual + 1;
    const nextHourSuccess = hourEntry.success + (success ? 1 : 0);
    const nextHourFailed = hourEntry.failed + (success ? 0 : 1);

    hourlyBreakdown[local.hour] = {
      ...hourEntry,
      actual: nextHourActual,
      success: nextHourSuccess,
      failed: nextHourFailed
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

    const totalClicks = task.totalClicks + 1;
    const successClicks = task.successClicks + (success ? 1 : 0);
    const failedClicks = task.failedClicks + (success ? 0 : 1);
    const totalTarget =
      task.durationDays === -1
        ? Math.max(task.dailyClickCount, actualForDay)
        : task.dailyClickCount * task.durationDays;
    const progress =
      task.durationDays === -1
        ? Math.min(100, Math.round((actualForDay / Math.max(1, task.dailyClickCount)) * 100))
        : Math.min(100, Math.round((totalClicks / Math.max(1, totalTarget)) * 100));
    const remainingInHour = Math.max(0, hourEntry.target - nextHourActual);
    const nextRunAt = computeNextClickFarmRunAt(task, now, remainingInHour);

    await recordClickFarmTaskRun(task.id, {
      status: "running",
      totalClicks,
      successClicks,
      failedClicks,
      progress,
      dailyHistory,
      nextRunAt,
      pauseReason: null,
      pauseMessage: null,
      pausedAt: null,
      startedAt: task.startedAt ?? now.toISOString(),
      completedAt: task.completedAt ?? null
    });
  }
}

async function main() {
  await ensureDatabaseReady();
  await runDueLinkSwaps();
  await runDueClickFarmTasks();

  cron.schedule("* * * * *", async () => {
    await runDueLinkSwaps();
    await runDueClickFarmTasks();
  });

  console.log("[scheduler] AutoCashBack scheduler started");
}

main().catch((error) => {
  console.error("[scheduler] startup failed", error);
  process.exit(1);
});
