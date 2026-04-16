import "../../../scripts/load-env";

import cron from "node-cron";

import {
  ensureDatabaseReady,
  getDueClickFarmTasks,
  getDueLinkSwapTasks
} from "@autocashback/db";

import {
  executeClickFarmBatch,
  executeClickFarmClick,
  executeClickFarmTrigger,
  orchestrateClickFarmTriggerTask
} from "./click-farm-queue";
import { executeLinkSwapTask, orchestrateLinkSwapQueueTask } from "./link-swap-queue";
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

export async function orchestrateDueLinkSwaps() {
  await ensureDatabaseReady();
  const tasks = await getDueLinkSwapTasks();

  for (const task of tasks as Array<Record<string, unknown>>) {
    await queue.enqueue(
      orchestrateLinkSwapQueueTask({
        userId: Number(task.user_id),
        taskId: Number(task.id),
        nextRunAt: task.next_run_at ? String(task.next_run_at) : null
      })
    );
  }
}

export async function orchestrateDueClickFarmTasks() {
  await ensureDatabaseReady();
  const tasks = await getDueClickFarmTasks();

  for (const task of tasks) {
    await queue.enqueue(
      await orchestrateClickFarmTriggerTask({
        userId: task.userId,
        taskId: task.id,
        nextRunAt: task.nextRunAt
      })
    );
  }
}

async function runOrchestratorTick() {
  await orchestrateDueLinkSwaps();
  await orchestrateDueClickFarmTasks();
}

async function main() {
  await ensureDatabaseReady();
  await queue.start();
  await runOrchestratorTick();

  cron.schedule("* * * * *", async () => {
    await runOrchestratorTick();
  });

  console.log("[scheduler] AutoCashBack unified scheduler started");
}

main().catch((error) => {
  console.error("[scheduler] startup failed", error);
  process.exit(1);
});
