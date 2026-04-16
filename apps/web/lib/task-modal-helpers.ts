type ClickFarmTaskResponse = {
  task?: {
    id?: string | number;
    status?: string;
  } | null;
  data?: {
    id?: string | number;
    status?: string;
  } | null;
};

type LinkSwapTaskResponse = {
  task?: {
    id?: string | number;
    status?: string;
    enabled?: boolean;
  } | null;
  data?: {
    id?: string | number;
    status?: string;
    enabled?: boolean;
  } | null;
};

type TaskResolveResult = {
  infoMessage?: string;
};

const CLICK_FARM_EDITABLE_STATUS = new Set(["pending", "running", "paused", "stopped"]);

function formatClickFarmStatus(status?: string): string {
  switch (status) {
    case "pending":
      return "待开始";
    case "running":
      return "运行中";
    case "paused":
      return "已暂停";
    case "stopped":
      return "已停止";
    case "completed":
      return "已完成";
    default:
      return status || "未知";
  }
}

function formatLinkSwapStatus(status?: string, enabled?: boolean): string {
  if (enabled === false || status === "idle") {
    return "已停用";
  }

  switch (status) {
    case "ready":
      return "运行中";
    case "warning":
      return "预警";
    case "error":
      return "异常";
    default:
      return status || "未知";
  }
}

export async function resolveClickFarmTaskMode(offerId: number): Promise<TaskResolveResult> {
  const response = await fetch(`/api/offers/${offerId}/click-farm-task`);
  if (!response.ok) {
    return {};
  }

  const payload = (await response.json()) as ClickFarmTaskResponse;
  const task = payload.task || payload.data;
  if (!task) {
    return {};
  }

  if (CLICK_FARM_EDITABLE_STATUS.has(task.status || "")) {
    if (task.status === "paused" || task.status === "stopped") {
      return {
        infoMessage: `当前补点击任务状态为 ${formatClickFarmStatus(task.status)}，可在弹窗中恢复或调整后重新启动。`
      };
    }

    return {};
  }

  return {
    infoMessage:
      `当前补点击任务状态为 ${formatClickFarmStatus(task.status)}，已进入创建新任务。` +
      "如需继续当前任务，请前往补点击管理页面。"
  };
}

export async function resolveLinkSwapTaskMode(offerId: number): Promise<TaskResolveResult> {
  const response = await fetch(`/api/offers/${offerId}/link-swap-task`);
  if (!response.ok) {
    return {};
  }

  const payload = (await response.json()) as LinkSwapTaskResponse;
  const task = payload.task || payload.data;
  if (!task) {
    return {};
  }

  if (task.enabled === false || task.status === "idle") {
    return {
      infoMessage: `当前换链接任务状态为 ${formatLinkSwapStatus(task.status, task.enabled)}，可在弹窗中调整配置后重新启用。`
    };
  }

  if (task.status === "warning" || task.status === "error") {
    return {
      infoMessage: `当前换链接任务状态为 ${formatLinkSwapStatus(task.status, task.enabled)}，建议检查配置后保存。`
    };
  }

  return {};
}
