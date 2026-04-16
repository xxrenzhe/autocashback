import {
  createServiceLogger,
  ensureQueueTaskEnqueued,
  getDueClickFarmTasks,
  getDueLinkSwapTasks,
  saveQueueSchedulerHeartbeat
} from "@autocashback/db";

import { orchestrateClickFarmTriggerTask } from "./click-farm-queue";
import { orchestrateLinkSwapQueueTask } from "./link-swap-queue";

const logger = createServiceLogger("autocashback-scheduler");

export type OrchestratorTickResult = {
  processed: number;
  inserted: number;
  duplicate: number;
  linkSwap: {
    processed: number;
    inserted: number;
    duplicate: number;
  };
  clickFarm: {
    processed: number;
    inserted: number;
    duplicate: number;
  };
};

async function orchestrateDueLinkSwaps() {
  const tasks = await getDueLinkSwapTasks();
  let inserted = 0;
  let duplicate = 0;

  for (const task of tasks as Array<Record<string, unknown>>) {
    const result = await ensureQueueTaskEnqueued(
      orchestrateLinkSwapQueueTask({
        userId: Number(task.user_id),
        taskId: Number(task.id),
        nextRunAt: task.next_run_at ? String(task.next_run_at) : null
      })
    );

    if (result.inserted) {
      inserted += 1;
    } else {
      duplicate += 1;
    }
  }

  return {
    processed: tasks.length,
    inserted,
    duplicate
  };
}

async function orchestrateDueClickFarmTasks() {
  const tasks = await getDueClickFarmTasks();
  let inserted = 0;
  let duplicate = 0;

  for (const task of tasks) {
    const result = await ensureQueueTaskEnqueued(
      await orchestrateClickFarmTriggerTask({
        userId: task.userId,
        taskId: task.id,
        nextRunAt: task.nextRunAt
      })
    );

    if (result.inserted) {
      inserted += 1;
    } else {
      duplicate += 1;
    }
  }

  return {
    processed: tasks.length,
    inserted,
    duplicate
  };
}

export async function runOrchestratorTick(): Promise<OrchestratorTickResult> {
  const [linkSwap, clickFarm] = await Promise.all([
    orchestrateDueLinkSwaps(),
    orchestrateDueClickFarmTasks()
  ]);

  const summary: OrchestratorTickResult = {
    processed: linkSwap.processed + clickFarm.processed,
    inserted: linkSwap.inserted + clickFarm.inserted,
    duplicate: linkSwap.duplicate + clickFarm.duplicate,
    linkSwap,
    clickFarm
  };

  const now = new Date().toISOString();
  await saveQueueSchedulerHeartbeat({
    heartbeatAt: now,
    lastTickAt: now,
    lastTickSummary: summary
  });

  logger.info("scheduler_orchestrator_tick", summary);

  return summary;
}

export async function updateSchedulerHeartbeatOnly() {
  await saveQueueSchedulerHeartbeat({
    heartbeatAt: new Date().toISOString()
  });
  logger.debug("scheduler_heartbeat_updated");
}
