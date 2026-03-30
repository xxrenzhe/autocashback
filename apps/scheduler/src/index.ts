import axios from "axios";
import { HttpsProxyAgent } from "https-proxy-agent";
import cron from "node-cron";

import {
  ensureDatabaseReady,
  getDueLinkSwapTasks,
  getProxyUrls,
  saveLinkSwapRun
} from "@autocashback/db";

type ResolutionResult = {
  resolvedUrl: string | null;
  resolvedSuffix: string | null;
  errorMessage: string | null;
  proxyUrl: string | null;
};

async function resolveOfferLink(rawUrl: string, proxyUrl: string | null): Promise<ResolutionResult> {
  try {
    const response = await axios.get(rawUrl, {
      maxRedirects: 10,
      timeout: 20_000,
      validateStatus: () => true,
      httpsAgent: proxyUrl ? new HttpsProxyAgent(proxyUrl) : undefined
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

export async function runDueLinkSwaps() {
  await ensureDatabaseReady();
  const tasks = await getDueLinkSwapTasks();

  for (const task of tasks) {
    const proxies = await getProxyUrls(task.user_id);
    const proxyUrl = proxies[0] || null;
    const result = await resolveOfferLink(task.promo_link, proxyUrl);
    await saveLinkSwapRun({
      taskId: task.id,
      offerId: task.offer_id,
      rawUrl: task.promo_link,
      resolvedUrl: result.resolvedUrl,
      resolvedSuffix: result.resolvedSuffix,
      proxyUrl: result.proxyUrl,
      status: result.errorMessage ? "failed" : "success",
      errorMessage: result.errorMessage,
      intervalMinutes: task.interval_minutes
    });
  }
}

async function main() {
  await ensureDatabaseReady();
  await runDueLinkSwaps();

  cron.schedule("* * * * *", async () => {
    await runDueLinkSwaps();
  });

  console.log("[scheduler] AutoCashBack scheduler started");
}

main().catch((error) => {
  console.error("[scheduler] startup failed", error);
  process.exit(1);
});
