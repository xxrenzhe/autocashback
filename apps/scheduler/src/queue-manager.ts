import { randomUUID } from "node:crypto";

import {
  claimNextQueueTask,
  completeQueueTask,
  createServiceLogger,
  enqueueQueueTask,
  failQueueTask,
  resetStaleRunningQueueTasks,
  retryQueueTask
} from "@autocashback/db";
import type {
  QueueSystemConfig,
  QueueTaskPriority,
  QueueTaskRecord,
  QueueTaskType
} from "@autocashback/domain";

type QueueExecutor = (task: QueueTaskRecord) => Promise<void>;

type QueueManagerConfig = {
  pollIntervalMs?: number;
  staleTimeoutMs?: number;
  globalConcurrency?: number;
  perTypeConcurrency?: Partial<Record<QueueTaskType, number>>;
};

const DEFAULT_PER_TYPE_CONCURRENCY: Record<QueueTaskType, number> = {
  "click-farm-trigger": 2,
  "click-farm-batch": 2,
  "click-farm": 8,
  "url-swap": 2
};

const logger = createServiceLogger("autocashback-scheduler");

export class UnifiedTaskQueueManager {
  private readonly workerId = `scheduler-${randomUUID()}`;
  private readonly executors = new Map<QueueTaskType, QueueExecutor>();
  private pollIntervalMs: number;
  private staleTimeoutMs: number;
  private globalConcurrency: number;
  private perTypeConcurrency: Record<QueueTaskType, number>;
  private readonly activeTaskIds = new Set<string>();
  private readonly activeTypeCounts = new Map<QueueTaskType, number>();

  private running = false;
  private pumping = false;
  private timer: NodeJS.Timeout | null = null;

  constructor(config: QueueManagerConfig = {}) {
    this.pollIntervalMs = Math.max(100, config.pollIntervalMs || 250);
    this.staleTimeoutMs = Math.max(60_000, config.staleTimeoutMs || 15 * 60_000);
    this.globalConcurrency = Math.max(1, config.globalConcurrency || 12);
    this.perTypeConcurrency = {
      ...DEFAULT_PER_TYPE_CONCURRENCY,
      ...(config.perTypeConcurrency || {})
    };
  }

  registerExecutor(type: QueueTaskType, executor: QueueExecutor) {
    this.executors.set(type, executor);
  }

  getConfig(): QueueSystemConfig {
    return {
      globalConcurrency: this.globalConcurrency,
      pollIntervalMs: this.pollIntervalMs,
      staleTimeoutMs: this.staleTimeoutMs,
      perTypeConcurrency: {
        ...this.perTypeConcurrency
      }
    };
  }

  async updateConfig(config: QueueManagerConfig) {
    const previousConfig = this.getConfig();
    this.pollIntervalMs = Math.max(100, config.pollIntervalMs || this.pollIntervalMs);
    this.staleTimeoutMs = Math.max(60_000, config.staleTimeoutMs || this.staleTimeoutMs);
    this.globalConcurrency = Math.max(1, config.globalConcurrency || this.globalConcurrency);
    this.perTypeConcurrency = {
      ...DEFAULT_PER_TYPE_CONCURRENCY,
      ...this.perTypeConcurrency,
      ...(config.perTypeConcurrency || {})
    };

    if (this.running) {
      const staleBefore = new Date(Date.now() - this.staleTimeoutMs).toISOString();
      await resetStaleRunningQueueTasks(staleBefore);
      this.schedulePump(0);
    }

    logger.info("queue_config_updated", {
      previous: previousConfig,
      next: this.getConfig()
    });

    return this.getConfig();
  }

  async enqueue(input: {
    id?: string;
    type: QueueTaskType;
    userId: number;
    payload: Record<string, unknown>;
    priority?: QueueTaskPriority;
    availableAt?: string;
    maxRetries?: number;
    parentRequestId?: string | null;
  }) {
    return enqueueQueueTask(input);
  }

  async start() {
    if (this.running) {
      return;
    }

    this.running = true;
    const staleBefore = new Date(Date.now() - this.staleTimeoutMs).toISOString();
    await resetStaleRunningQueueTasks(staleBefore);
    logger.info("queue_manager_started", {
      workerId: this.workerId,
      config: this.getConfig()
    });
    this.schedulePump(0);
  }

  async stop() {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    logger.info("queue_manager_stopped", {
      workerId: this.workerId,
      activeTasks: this.activeTaskIds.size
    });
  }

  private schedulePump(delayMs = this.pollIntervalMs) {
    if (!this.running) {
      return;
    }

    if (this.timer) {
      clearTimeout(this.timer);
    }

    this.timer = setTimeout(() => {
      void this.pump();
    }, delayMs);
  }

  private getActiveCount(type: QueueTaskType) {
    return this.activeTypeCounts.get(type) || 0;
  }

  private incrementActive(type: QueueTaskType, taskId: string) {
    this.activeTaskIds.add(taskId);
    this.activeTypeCounts.set(type, this.getActiveCount(type) + 1);
  }

  private decrementActive(type: QueueTaskType, taskId: string) {
    this.activeTaskIds.delete(taskId);
    this.activeTypeCounts.set(type, Math.max(0, this.getActiveCount(type) - 1));
  }

  private getClaimableTypes() {
    return [...this.executors.keys()].filter(
      (type) => this.getActiveCount(type) < (this.perTypeConcurrency[type] || 1)
    );
  }

  private async pump() {
    if (!this.running || this.pumping) {
      return;
    }

    this.pumping = true;

    try {
      while (this.running && this.activeTaskIds.size < this.globalConcurrency) {
        const claimableTypes = this.getClaimableTypes();
        if (!claimableTypes.length) {
          break;
        }

        const task = await claimNextQueueTask(this.workerId, claimableTypes);
        if (!task) {
          break;
        }

        const executor = this.executors.get(task.type);
        if (!executor) {
          logger.error("queue_executor_missing", {
            taskId: task.id,
            taskType: task.type
          });
          await failQueueTask(task.id, `未注册执行器: ${task.type}`);
          continue;
        }

        this.incrementActive(task.type, task.id);
        logger.debug("queue_task_claimed", {
          taskId: task.id,
          taskType: task.type,
          userId: task.userId
        });
        void this.executeTask(task, executor);
      }
    } finally {
      this.pumping = false;
      this.schedulePump();
    }
  }

  private async executeTask(task: QueueTaskRecord, executor: QueueExecutor) {
    try {
      await executor(task);
      await completeQueueTask(task.id);
      logger.info("queue_task_completed", {
        taskId: task.id,
        taskType: task.type,
        retryCount: task.retryCount
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "队列任务执行失败";
      if (task.retryCount < task.maxRetries) {
        const retryDelayMs = Math.min(60_000, 5_000 * (task.retryCount + 1));
        logger.warn("queue_task_retry_scheduled", {
          taskId: task.id,
          taskType: task.type,
          retryCount: task.retryCount + 1,
          retryDelayMs,
          errorMessage: message
        });
        await retryQueueTask(task.id, message, new Date(Date.now() + retryDelayMs).toISOString());
      } else {
        logger.error(
          "queue_task_failed",
          {
            taskId: task.id,
            taskType: task.type,
            retryCount: task.retryCount,
            errorMessage: message
          },
          error
        );
        await failQueueTask(task.id, message);
      }
    } finally {
      this.decrementActive(task.type, task.id);
      this.schedulePump(0);
    }
  }
}
