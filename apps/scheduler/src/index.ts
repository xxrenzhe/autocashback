import "../../../scripts/load-env";

import cron from "node-cron";

import {
  createServiceLogger,
  ensureDatabaseReady,
  getQueueSystemConfig
} from "@autocashback/db";

import {
  executeClickFarmBatch,
  executeClickFarmClick,
  executeClickFarmTrigger
} from "./click-farm-queue";
import { executeLinkSwapTask } from "./link-swap-queue";
import { runOrchestratorTick, updateSchedulerHeartbeatOnly } from "./orchestrator";
import { UnifiedTaskQueueManager } from "./queue-manager";

const logger = createServiceLogger("autocashback-scheduler");

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

async function applyLatestQueueConfig() {
  const config = await getQueueSystemConfig();
  await queue.updateConfig(config);
  logger.info("scheduler_queue_config_applied", {
    config
  });
}

async function main() {
  await ensureDatabaseReady();
  await applyLatestQueueConfig();
  await queue.start();
  const startupTick = await runOrchestratorTick();
  await updateSchedulerHeartbeatOnly();

  const orchestratorCron = cron.schedule("* * * * *", async () => {
    try {
      await runOrchestratorTick();
    } catch (error) {
      logger.error("scheduler_tick_failed", {}, error);
    }
  });

  const heartbeatCron = cron.schedule("*/1 * * * *", async () => {
    try {
      await Promise.all([updateSchedulerHeartbeatOnly(), applyLatestQueueConfig()]);
    } catch (error) {
      logger.error("scheduler_heartbeat_failed", {}, error);
    }
  });

  logger.info("scheduler_started", {
    startupTick,
    schedule: {
      orchestrator: "* * * * *",
      heartbeat: "*/1 * * * *"
    }
  });

  let shuttingDown = false;
  const shutdown = async (signal: NodeJS.Signals) => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    logger.warn("scheduler_shutdown_signal", {
      signal
    });
    orchestratorCron.stop();
    heartbeatCron.stop();
    await queue.stop();
    logger.info("scheduler_stopped", {
      signal
    });
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
  process.on("uncaughtException", (error) => {
    logger.error("scheduler_uncaught_exception", {}, error);
    process.exit(1);
  });
  process.on("unhandledRejection", (reason) => {
    logger.error("scheduler_unhandled_rejection", {}, reason);
    process.exit(1);
  });
}

main().catch((error) => {
  logger.error("scheduler_startup_failed", {}, error);
  process.exit(1);
});
