import type {
  QueueStats,
  QueueTaskPriority,
  QueueTaskRecord
} from "@autocashback/domain";

export type SchedulerStatusPayload = {
  mode: string;
  heartbeatAt: string | null;
  lastTickAt: string | null;
  lastTickSummary: Record<string, unknown> | null;
  note: string;
  clickFarmScheduler: {
    status: "healthy" | "warning" | "error";
    message: string;
    schedulerProcess: string;
    metrics: {
      enabledTasks: number;
      overdueTasks: number;
      recentQueuedTasks: number;
      runningTasks?: number;
      lastQueuedAt: string | null;
      checkInterval: string;
    };
  };
  urlSwapScheduler: {
    status: "healthy" | "warning" | "error";
    message: string;
    schedulerProcess: string;
    metrics: {
      enabledTasks: number;
      overdueTasks: number;
      recentQueuedTasks: number;
      runningTasks?: number;
      lastQueuedAt: string | null;
      checkInterval: string;
    };
  };
};

export type QueueConsoleSort = "recent" | "available-at" | "priority" | "failed-first";

export type QueueConsoleFilters = {
  search: string;
  sort: QueueConsoleSort;
};

export type QueueConsoleRow = {
  task: QueueTaskRecord;
  isAvailableNow: boolean;
  isPendingBacklog: boolean;
  payloadPreview: string;
};

export type QueueConsoleOverview = {
  totalTasks: number;
  pendingTasks: number;
  runningTasks: number;
  failedTasks: number;
  activeSchedulerCount: number;
  warningCount: number;
  overduePendingTasks: number;
};

export type QueueConsoleRiskItem = {
  id: string;
  title: string;
  description: string;
  tone: "amber" | "red" | "slate";
};

export type QueueConsoleData = {
  overview: QueueConsoleOverview;
  rows: QueueConsoleRow[];
  risks: QueueConsoleRiskItem[];
};

const priorityRank: Record<QueueTaskPriority, number> = {
  high: 3,
  normal: 2,
  low: 1
};

function safeStringifyPayload(payload: Record<string, unknown>) {
  try {
    const entries = Object.entries(payload || {});
    if (!entries.length) {
      return "{}";
    }

    return entries
      .slice(0, 3)
      .map(([key, value]) => `${key}=${String(value)}`)
      .join(" · ");
  } catch {
    return "{}";
  }
}

function compareNullableTimestamps(
  left: string | null,
  right: string | null,
  direction: "asc" | "desc"
) {
  const leftTs = Date.parse(String(left || ""));
  const rightTs = Date.parse(String(right || ""));
  const leftMissing = !Number.isFinite(leftTs);
  const rightMissing = !Number.isFinite(rightTs);

  if (leftMissing && rightMissing) return 0;
  if (leftMissing) return 1;
  if (rightMissing) return -1;
  return direction === "asc" ? leftTs - rightTs : rightTs - leftTs;
}

export function buildQueueConsole(input: {
  stats: QueueStats;
  tasks: QueueTaskRecord[];
  schedulerStatus: SchedulerStatusPayload | null;
  filters: QueueConsoleFilters;
}): QueueConsoleData {
  const search = input.filters.search.trim().toLowerCase();
  const now = Date.now();

  const rows = input.tasks
    .map<QueueConsoleRow>((task) => {
      const availableAtTs = Date.parse(String(task.availableAt || ""));
      const isAvailableNow = Number.isFinite(availableAtTs) && availableAtTs <= now;
      const isPendingBacklog = task.status === "pending" && isAvailableNow;

      return {
        task,
        isAvailableNow,
        isPendingBacklog,
        payloadPreview: safeStringifyPayload(task.payload)
      };
    })
    .filter((row) => {
      if (!search) {
        return true;
      }

      const searchableText = [
        row.task.id,
        row.task.type,
        row.task.status,
        row.task.priority,
        String(row.task.userId),
        row.task.errorMessage || "",
        row.payloadPreview
      ]
        .join(" ")
        .toLowerCase();

      return searchableText.includes(search);
    });

  rows.sort((left, right) => {
    switch (input.filters.sort) {
      case "available-at":
        return (
          compareNullableTimestamps(left.task.availableAt, right.task.availableAt, "asc") ||
          compareNullableTimestamps(left.task.createdAt, right.task.createdAt, "desc")
        );
      case "priority":
        return (
          priorityRank[right.task.priority] - priorityRank[left.task.priority] ||
          compareNullableTimestamps(left.task.createdAt, right.task.createdAt, "desc")
        );
      case "failed-first": {
        const leftFailed = left.task.status === "failed" ? 1 : 0;
        const rightFailed = right.task.status === "failed" ? 1 : 0;
        return (
          rightFailed - leftFailed ||
          compareNullableTimestamps(left.task.updatedAt, right.task.updatedAt, "desc")
        );
      }
      case "recent":
      default:
        return compareNullableTimestamps(left.task.createdAt, right.task.createdAt, "desc");
    }
  });

  const overduePendingTasks = input.tasks.filter((task) => {
    if (task.status !== "pending") {
      return false;
    }

    const availableAtTs = Date.parse(String(task.availableAt || ""));
    return Number.isFinite(availableAtTs) && availableAtTs <= now;
  }).length;

  const activeSchedulerCount = input.schedulerStatus
    ? [input.schedulerStatus.clickFarmScheduler, input.schedulerStatus.urlSwapScheduler].filter(
        (scheduler) => scheduler.status === "healthy"
      ).length
    : 0;

  const risks: QueueConsoleRiskItem[] = [];
  if (input.stats.failed > 0) {
    risks.push({
      id: "failed-tasks",
      title: "存在失败任务",
      description: `当前有 ${input.stats.failed} 个失败任务，建议优先查看错误信息和最近更新时间。`,
      tone: "red"
    });
  }

  if (overduePendingTasks > 0) {
    risks.push({
      id: "pending-backlog",
      title: "存在待处理积压",
      description: `有 ${overduePendingTasks} 个 pending 任务已经到达可执行时间，建议检查调度器与工作队列。`,
      tone: "amber"
    });
  }

  if (input.schedulerStatus) {
    const schedulers = [
      { id: "click-farm-scheduler", label: "补点击调度器", value: input.schedulerStatus.clickFarmScheduler },
      { id: "url-swap-scheduler", label: "换链接调度器", value: input.schedulerStatus.urlSwapScheduler }
    ];

    for (const scheduler of schedulers) {
      if (scheduler.value.status !== "healthy") {
        risks.push({
          id: scheduler.id,
          title: `${scheduler.label}需要关注`,
          description: scheduler.value.message,
          tone: scheduler.value.status === "error" ? "red" : "amber"
        });
      }
    }
  } else {
    risks.push({
      id: "scheduler-unavailable",
      title: "调度器状态未加载",
      description: "尚未获取到调度器健康信息，建议检查管理员权限或重试刷新。",
      tone: "slate"
    });
  }

  return {
    overview: {
      totalTasks: input.stats.total,
      pendingTasks: input.stats.pending,
      runningTasks: input.stats.running,
      failedTasks: input.stats.failed,
      activeSchedulerCount,
      warningCount: risks.length,
      overduePendingTasks
    },
    rows,
    risks
  };
}
