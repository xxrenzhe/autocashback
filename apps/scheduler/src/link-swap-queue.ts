import axios from "axios";
import { HttpsProxyAgent } from "https-proxy-agent";

import {
  buildLinkSwapQueueTaskId,
  type QueueTaskRecord
} from "@autocashback/domain";
import {
  createServiceLogger,
  expireLinkSwapTask,
  getLinkSwapTaskExecutionContext,
  getProxyUrls,
  saveLinkSwapRun,
  updateGoogleAdsCampaignSuffix
} from "@autocashback/db";

const logger = createServiceLogger("autocashback-scheduler");

type ResolutionResult = {
  resolvedUrl: string | null;
  resolvedSuffix: string | null;
  errorMessage: string | null;
  proxyUrl: string | null;
};

type LinkSwapQueuePayload = {
  linkSwapTaskId: number;
};

function isLinkSwapExpired(task: {
  durationDays: number;
  activationStartedAt: string | null;
}) {
  if (task.durationDays === -1) {
    return false;
  }

  const startedAt = Date.parse(task.activationStartedAt || "");
  if (!Number.isFinite(startedAt)) {
    return false;
  }

  return Date.now() >= startedAt + task.durationDays * 86_400_000;
}

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

export function orchestrateLinkSwapQueueTask(input: {
  userId: number;
  taskId: number;
  nextRunAt: string | null;
}) {
  return {
    id: buildLinkSwapQueueTaskId(input.taskId, input.nextRunAt),
    type: "url-swap" as const,
    userId: input.userId,
    payload: { linkSwapTaskId: input.taskId } satisfies LinkSwapQueuePayload,
    priority: "normal" as const,
    maxRetries: 0
  };
}

export async function executeLinkSwapTask(task: QueueTaskRecord) {
  const payload = task.payload as LinkSwapQueuePayload;
  const linkSwapTaskId = Number(payload.linkSwapTaskId);
  if (!Number.isFinite(linkSwapTaskId)) {
    logger.warn("link_swap_invalid_payload", {
      taskId: task.id,
      payload: task.payload
    });
    return;
  }

  const linkTask = await getLinkSwapTaskExecutionContext(task.userId, linkSwapTaskId);
  if (!linkTask) {
    logger.warn("link_swap_task_missing", {
      queueTaskId: task.id,
      linkSwapTaskId
    });
    return;
  }

  if (!linkTask.enabled || linkTask.status === "idle") {
    return;
  }

  if (isLinkSwapExpired(linkTask)) {
    logger.info("link_swap_task_expired", {
      linkSwapTaskId
    });
    await expireLinkSwapTask(linkSwapTaskId);
    return;
  }

  const proxies = await getProxyUrls(task.userId, String(linkTask.targetCountry || ""));
  const proxyUrl = proxies[0] || null;

  if (!proxyUrl) {
    logger.warn("link_swap_missing_proxy", {
      linkSwapTaskId,
      targetCountry: linkTask.targetCountry
    });
    await saveLinkSwapRun({
      taskId: linkSwapTaskId,
      offerId: linkTask.offerId,
      rawUrl: linkTask.promoLink,
      resolvedUrl: null,
      resolvedSuffix: null,
      proxyUrl: null,
      status: "failed",
      applyStatus: "not_applicable",
      applyErrorMessage: null,
      errorMessage: `缺少 ${linkTask.targetCountry} 或 GLOBAL 代理`,
      intervalMinutes: linkTask.intervalMinutes
    });
    return;
  }

  const result = await resolveOfferLink(linkTask.promoLink, proxyUrl);
  let applyStatus: "not_applicable" | "success" | "failed" = "not_applicable";
  let applyErrorMessage: string | null = null;
  let status: "success" | "failed" = result.errorMessage ? "failed" : "success";

  if (!result.errorMessage && result.resolvedSuffix && linkTask.mode === "google_ads_api") {
    if (!linkTask.googleCustomerId || !linkTask.googleCampaignId) {
      applyStatus = "failed";
      applyErrorMessage = "缺少 Google Ads Customer ID 或 Campaign ID";
      status = "failed";
    } else {
      try {
        await updateGoogleAdsCampaignSuffix({
          userId: task.userId,
          customerId: linkTask.googleCustomerId,
          campaignId: linkTask.googleCampaignId,
          finalUrlSuffix: result.resolvedSuffix
        });
        applyStatus = "success";
      } catch (error: unknown) {
        logger.error(
          "link_swap_google_ads_update_failed",
          {
            linkSwapTaskId,
            customerId: linkTask.googleCustomerId,
            campaignId: linkTask.googleCampaignId
          },
          error
        );
        applyStatus = "failed";
        applyErrorMessage = error instanceof Error ? error.message : "Google Ads 更新失败";
        status = "failed";
      }
    }
  }

  await saveLinkSwapRun({
    taskId: linkSwapTaskId,
    offerId: linkTask.offerId,
    rawUrl: linkTask.promoLink,
    resolvedUrl: result.resolvedUrl,
    resolvedSuffix: result.resolvedSuffix,
    proxyUrl: result.proxyUrl,
    status,
    applyStatus,
    applyErrorMessage,
    errorMessage: result.errorMessage || applyErrorMessage,
    intervalMinutes: linkTask.intervalMinutes
  });
}
