import { randomUUID } from "node:crypto";

import {
  claimNextQueueTask,
  completeQueueTask,
  enqueueQueueTask,
  failQueueTask,
  resetStaleRunningQueueTasks,
  retryQueueTask
} from "@autocashback/db";
import type { QueueTaskPriority, QueueTaskRecord, QueueTaskType } from "@autocashback/domain";

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

export class UnifiedTaskQueueManager {
  private readonly workerId = `scheduler-${randomUUID()}`;
  private readonly executors = new Map<QueueTaskType, QueueExecutor>();
  private readonly pollIntervalMs: number;
  private readonly staleTimeoutMs: number;
  private readonly globalConcurrency: number;
  private readonly perTypeConcurrency: Record<QueueTaskType, number>;
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
    this.schedulePump(0);
  }

  async stop() {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
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
          await failQueueTask(task.id, `未注册执行器: ${task.type}`);
          continue;
        }

        this.incrementActive(task.type, task.id);
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
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "队列任务执行失败";
      if (task.retryCount < task.maxRetries) {
        const retryDelayMs = Math.min(60_000, 5_000 * (task.retryCount + 1));
        await retryQueueTask(task.id, message, new Date(Date.now() + retryDelayMs).toISOString());
      } else {
        await failQueueTask(task.id, message);
      }
    } finally {
      this.decrementActive(task.type, task.id);
      this.schedulePump(0);
    }
  }
}
