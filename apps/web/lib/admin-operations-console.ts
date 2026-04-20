type Tone = "red" | "amber" | "emerald" | "slate";

export type AdminUrlSwapStats = {
  totalTasks: number;
  enabledTasks: number;
  googleAdsModeTasks: number;
  scriptModeTasks: number;
  erroredTasks: number;
  dueTasks: number;
  recentSuccessRate: number;
};

export type AdminUrlSwapHealth = {
  staleRunningTasks: number;
  highFailureTasks: number;
  missingResolvedUrlOffers: number;
};

export type AdminClickFarmStats = {
  totalTasks: number;
  activeTasks: number;
  pausedTasks: number;
  totalClicks: number;
  successClicks: number;
  failedClicks: number;
  successRate: number;
};

export type AdminClickFarmTaskRow = {
  id: number;
  username: string;
  brandName: string;
  status: string;
  progress: number;
  totalClicks: number;
  successClicks: number;
  failedClicks: number;
  nextRunAt: string | null;
  updatedAt: string;
};

export type AdminProxyHealth = {
  users: Array<{
    userId: number;
    username: string;
    totalProxies: number;
    activeProxies: number;
    countries: string[];
  }>;
  summary: {
    usersWithProxyConfig: number;
    totalProxies: number;
    activeProxies: number;
    countries: Array<{
      country: string;
      total: number;
      active: number;
    }>;
  };
};

export type AdminAuditLogRecord = {
  id: number;
  userId: number;
  eventType:
    | "login_success"
    | "login_failed"
    | "account_locked"
    | "configuration_changed"
    | "unauthorized_access_attempt";
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  details: Record<string, unknown> | null;
};

type AdminOperationsInput = {
  urlSwapStats: AdminUrlSwapStats;
  urlSwapHealth: AdminUrlSwapHealth;
  clickFarmStats: AdminClickFarmStats;
  clickFarmTasks: AdminClickFarmTaskRow[];
  proxyHealth: AdminProxyHealth;
  auditLogs: AdminAuditLogRecord[];
};

type AdminRiskItem = {
  id: string;
  title: string;
  tone: Tone;
};

type AdminWatchTask = AdminClickFarmTaskRow & {
  tone: Tone;
};

type AdminProxyUser = AdminProxyHealth["users"][number] & {
  tone: Tone;
};

type AdminAuditHighlight = {
  id: number;
  title: string;
  tone: Tone;
};

type AdminMetric = {
  id: string;
  label: string;
  value: string;
  tone: Tone;
};

export function buildAdminOperationsConsole(input: AdminOperationsInput) {
  const suspiciousAuditLogs = input.auditLogs.filter((record) =>
    record.eventType === "unauthorized_access_attempt" || record.eventType === "configuration_changed"
  );

  const riskItems: AdminRiskItem[] = [];

  if (input.urlSwapHealth.staleRunningTasks > 0) {
    riskItems.push({ id: "url-swap-stale", title: "换链任务陈旧", tone: "red" });
  }
  if (input.urlSwapHealth.highFailureTasks > 0) {
    riskItems.push({ id: "url-swap-failure", title: "换链失败率过高", tone: "red" });
  }
  if (input.urlSwapHealth.missingResolvedUrlOffers > 0) {
    riskItems.push({ id: "url-swap-offers", title: "Offer 缺少终链", tone: "amber" });
  }
  if (input.clickFarmStats.successRate < 85) {
    riskItems.push({ id: "click-farm-low-success", title: "补点击成功率偏低", tone: "red" });
  }

  const proxyCoverageRate =
    input.proxyHealth.summary.totalProxies > 0
      ? Math.round((input.proxyHealth.summary.activeProxies / input.proxyHealth.summary.totalProxies) * 100)
      : 0;

  if (proxyCoverageRate < 100 && input.proxyHealth.summary.totalProxies > 0) {
    riskItems.push({ id: "proxy-partial", title: "代理覆盖不完整", tone: proxyCoverageRate === 0 ? "red" : "amber" });
  }

  if (suspiciousAuditLogs.length > 0) {
    riskItems.push({ id: "audit-alert", title: "审计日志存在告警", tone: "red" });
  }

  const watchTasks: AdminWatchTask[] = input.clickFarmTasks
    .map<AdminWatchTask>((task) => {
      const successRate = task.totalClicks > 0 ? task.successClicks / task.totalClicks : 1;
      let tone: Tone = "slate";

      if (successRate < 0.7 || task.failedClicks >= Math.max(10, task.successClicks)) {
        tone = "red";
      } else if (task.status === "paused" || task.progress < 20 || task.nextRunAt === null) {
        tone = "amber";
      }

      return {
        ...task,
        tone
      };
    })
    .sort((left, right) => toneWeight(right.tone) - toneWeight(left.tone) || right.updatedAt.localeCompare(left.updatedAt));

  const proxyUsers: AdminProxyUser[] = [...input.proxyHealth.users]
    .map<AdminProxyUser>((user) => {
      const tone: Tone =
        user.totalProxies === 0 || user.activeProxies === 0
          ? "red"
          : user.activeProxies < user.totalProxies
            ? "amber"
            : "slate";

      return {
        ...user,
        tone
      };
    })
    .sort((left, right) => toneWeight(right.tone) - toneWeight(left.tone) || left.username.localeCompare(right.username));

  const auditHighlights: AdminAuditHighlight[] = [...input.auditLogs]
    .map<AdminAuditHighlight>((record) => {
      const tone: Tone =
        record.eventType === "unauthorized_access_attempt"
          ? "red"
          : record.eventType === "configuration_changed"
            ? "amber"
            : "slate";

      return {
        id: record.id,
        title: getAuditTitle(record.eventType),
        tone
      };
    })
    .sort((left, right) => toneWeight(right.tone) - toneWeight(left.tone) || right.id - left.id);

  const clickFarmMetrics: AdminMetric[] = [
    {
      id: "click-farm-success",
      label: "补点击成功率",
      value: `${Math.round(input.clickFarmStats.successRate)}%`,
      tone:
        input.clickFarmStats.successRate >= 90
          ? "emerald"
          : input.clickFarmStats.successRate >= 75
            ? "amber"
            : "red"
    },
    {
      id: "click-farm-active",
      label: "活跃任务",
      value: String(input.clickFarmStats.activeTasks),
      tone: input.clickFarmStats.activeTasks > 0 ? "slate" : "amber"
    }
  ];

  const proxyMetrics: AdminMetric[] = [
    {
      id: "proxy-coverage",
      label: "代理可用率",
      value: `${proxyCoverageRate}%`,
      tone: proxyCoverageRate >= 100 ? "emerald" : proxyCoverageRate > 0 ? "amber" : "red"
    }
  ];

  return {
    overview: {
      monitoredTasks: input.urlSwapStats.totalTasks + input.clickFarmStats.totalTasks,
      activeTasks: input.urlSwapStats.enabledTasks + input.clickFarmStats.activeTasks,
      proxyCoverageRate,
      suspiciousAuditCount: suspiciousAuditLogs.length,
      attentionTaskCount: watchTasks.filter((task) => task.tone !== "slate").length,
      riskCount: riskItems.length
    },
    risks: riskItems,
    watchTasks,
    proxyUsers,
    auditHighlights,
    clickFarmMetrics,
    proxyMetrics
  };
}

function toneWeight(tone: Tone) {
  if (tone === "red") {
    return 3;
  }
  if (tone === "amber") {
    return 2;
  }
  if (tone === "emerald") {
    return 1;
  }
  return 0;
}

function getAuditTitle(eventType: AdminAuditLogRecord["eventType"]) {
  if (eventType === "unauthorized_access_attempt") {
    return "未授权访问尝试";
  }
  if (eventType === "configuration_changed") {
    return "配置已变更";
  }
  if (eventType === "login_success") {
    return "登录成功";
  }
  if (eventType === "login_failed") {
    return "登录失败";
  }
  return "账号已锁定";
}
