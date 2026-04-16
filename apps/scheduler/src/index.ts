import "../../../scripts/load-env";

import cron from "node-cron";

import { ensureDatabaseReady } from "@autocashback/db";

import {
  executeClickFarmBatch,
  executeClickFarmClick,
  executeClickFarmTrigger
} from "./click-farm-queue";
import { executeLinkSwapTask } from "./link-swap-queue";
import { runOrchestratorTick, updateSchedulerHeartbeatOnly } from "./orchestrator";
import { UnifiedTaskQueueManager } from "./queue-manager";

const queue = new UnifiedTaskQueueManager({
  globalConcurrency: 12,
  perTypeConcurrency: {
    "click-farm-trigger": 2,
    "click-farm-batch": 2,
    "click-farm": 8,
    "url-swap": 2
  }
});

queue.registerExecutor("click-farm-trigger", executeClickFarmTrigger);
queue.registerExecutor("click-farm-batch", executeClickFarmBatch);
queue.registerExecutor("click-farm", executeClickFarmClick);
queue.registerExecutor("url-swap", executeLinkSwapTask);

async function main() {
  await ensureDatabaseReady();
  await queue.start();
  await runOrchestratorTick();
  await updateSchedulerHeartbeatOnly();

  cron.schedule("* * * * *", async () => {
    await runOrchestratorTick();
  });

  cron.schedule("*/1 * * * *", async () => {
    await updateSchedulerHeartbeatOnly();
  });

  console.log("[scheduler] AutoCashBack unified scheduler started");
}

main().catch((error) => {
  console.error("[scheduler] startup failed", error);
  process.exit(1);
});
