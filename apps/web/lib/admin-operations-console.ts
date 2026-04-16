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
    countries: Array<{ country: string; total: number; active: number }>;
  };
};

export type AdminAuditLogRecord = {
  id: number;
  userId: number | null;
  eventType: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  details: Record<string, unknown> | null;
};

export type AdminOperationsMetric = {
  id: string;
  label: string;
  value: string;
  note: string;
  tone: "emerald" | "amber" | "red" | "slate";
};

export type AdminOperationsRiskItem = {
  id: string;
  title: string;
  description: string;
  tone: "amber" | "red" | "slate";
  href: string;
};

export type AdminOperationsWatchTask = AdminClickFarmTaskRow & {
  successRate: number | null;
  tone: "amber" | "red" | "slate";
  reason: string;
  isPaused: boolean;
  nextRunMissing: boolean;
};

export type AdminOperationsProxyRow = {
  userId: number;
  username: string;
  totalProxies: number;
  activeProxies: number;
  inactiveProxies: number;
  coverageRate: number | null;
  countries: string[];
  tone: "amber" | "red" | "slate";
  note: string;
};

export type AdminOperationsAuditHighlight = {
  id: number;
  title: string;
  description: string;
  createdAt: string;
  userId: number | null;
  ipAddress: string | null;
  tone: "amber" | "red" | "slate";
};

export type AdminOperationsConsoleData = {
  overview: {
    monitoredTasks: number;
    activeTasks: number;
    riskCount: number;
    proxyCoverageRate: number | null;
    suspiciousAuditCount: number;
    attentionTaskCount: number;
  };
  urlSwapMetrics: AdminOperationsMetric[];
  clickFarmMetrics: AdminOperationsMetric[];
  proxyMetrics: AdminOperationsMetric[];
  risks: AdminOperationsRiskItem[];
  watchTasks: AdminOperationsWatchTask[];
  proxyUsers: AdminOperationsProxyRow[];
  topCountries: Array<{
    country: string;
    active: number;
    total: number;
    tone: "amber" | "emerald" | "slate";
  }>;
  auditHighlights: AdminOperationsAuditHighlight[];
};

function roundPercent(value: number) {
  return Number.isFinite(value) ? Number(value.toFixed(1)) : 0;
}

function formatPercent(value: number | null) {
  if (value === null) {
    return "--";
  }

  return `${roundPercent(value)}%`;
}

function mapAuditTone(eventType: string) {
  if (eventType === "unauthorized_access_attempt" || eventType === "sensitive_data_access") {
    return "red" as const;
  }

  if (eventType === "login_failed" || eventType === "configuration_changed") {
    return "amber" as const;
  }

  return "slate" as const;
}

function describeAuditEvent(eventType: string) {
  switch (eventType) {
    case "login_success":
      return "登录成功";
    case "login_failed":
      return "登录失败";
    case "logout":
      return "退出登录";
    case "password_changed":
      return "修改密码";
    case "user_created":
      return "创建用户";
    case "user_updated":
      return "更新用户";
    case "user_deleted":
      return "删除用户";
    case "user_password_reset":
      return "重置密码";
    case "configuration_changed":
      return "修改配置";
    case "sensitive_data_access":
      return "访问敏感数据";
    case "unauthorized_access_attempt":
      return "未授权访问尝试";
    default:
      return eventType;
  }
}

function summarizeAuditDetails(details: Record<string, unknown> | null) {
  if (!details) {
    return "未记录额外上下文";
  }

  const entries = Object.entries(details)
    .filter(([, value]) => value !== null && value !== undefined && String(value).trim().length > 0)
    .slice(0, 2);

  if (!entries.length) {
    return "未记录额外上下文";
  }

  return entries.map(([key, value]) => `${key}=${String(value)}`).join(" · ");
}

function buildWatchTask(task: AdminClickFarmTaskRow): AdminOperationsWatchTask {
  const successRate =
    task.totalClicks > 0 ? (task.successClicks / task.totalClicks) * 100 : null;
  const isPaused = task.status === "paused" || task.status === "stopped";
  const nextRunMissing = (task.status === "pending" || task.status === "running") && !task.nextRunAt;
  const lowSuccess = successRate !== null && task.totalClicks >= 20 && successRate < 80;
  const failureLeading = task.totalClicks >= 10 && task.failedClicks > task.successClicks;

  if (lowSuccess || failureLeading) {
    return {
      ...task,
      successRate,
      tone: "red",
      reason:
        lowSuccess && failureLeading
          ? "成功率偏低，且失败点击已高于成功点击。"
          : lowSuccess
            ? "成功率低于 80%，建议检查代理、素材和节奏。"
            : "失败点击已高于成功点击，建议暂停排查。",
      isPaused,
      nextRunMissing
    };
  }

  if (isPaused) {
    return {
      ...task,
      successRate,
      tone: "amber",
      reason: "任务已暂停，建议确认暂停原因与恢复窗口。",
      isPaused,
      nextRunMissing
    };
  }

  if (nextRunMissing) {
    return {
      ...task,
      successRate,
      tone: "amber",
      reason: "任务处于活跃状态，但尚未安排下次执行时间。",
      isPaused,
      nextRunMissing
    };
  }

  return {
    ...task,
    successRate,
    tone: "slate",
    reason: "当前节奏正常，可继续观察转化质量。",
    isPaused,
    nextRunMissing
  };
}

export function buildAdminOperationsConsole(input: {
  urlSwapStats: AdminUrlSwapStats | null;
  urlSwapHealth: AdminUrlSwapHealth | null;
  clickFarmStats: AdminClickFarmStats | null;
  clickFarmTasks: AdminClickFarmTaskRow[];
  proxyHealth: AdminProxyHealth | null;
  auditLogs: AdminAuditLogRecord[];
}): AdminOperationsConsoleData {
  const urlSwapStats = input.urlSwapStats;
  const urlSwapHealth = input.urlSwapHealth;
  const clickFarmStats = input.clickFarmStats;
  const proxyHealth = input.proxyHealth;

  const watchTasks = input.clickFarmTasks
    .map(buildWatchTask)
    .sort((left, right) => {
      const toneRank = { red: 3, amber: 2, slate: 1 };
      return (
        toneRank[right.tone] - toneRank[left.tone] ||
        Date.parse(right.updatedAt) - Date.parse(left.updatedAt)
      );
    });

  const proxyUsers = (proxyHealth?.users || [])
    .map<AdminOperationsProxyRow>((user) => {
      const coverageRate =
        user.totalProxies > 0 ? (user.activeProxies / user.totalProxies) * 100 : null;
      if (user.totalProxies === 0 || user.activeProxies === 0) {
        return {
          ...user,
          inactiveProxies: Math.max(0, user.totalProxies - user.activeProxies),
          coverageRate,
          tone: "red",
          note: "当前没有可用代理，建议立即补齐线路。"
        };
      }

      if (user.activeProxies < user.totalProxies) {
        return {
          ...user,
          inactiveProxies: Math.max(0, user.totalProxies - user.activeProxies),
          coverageRate,
          tone: "amber",
          note: "存在停用代理，建议补充健康线路。"
        };
      }

      return {
        ...user,
        inactiveProxies: Math.max(0, user.totalProxies - user.activeProxies),
        coverageRate,
        tone: "slate",
        note: "代理配置完整。"
      };
    })
    .sort((left, right) => {
      const toneRank = { red: 3, amber: 2, slate: 1 };
      return toneRank[right.tone] - toneRank[left.tone] || left.username.localeCompare(right.username, "en");
    });

  const auditHighlights = input.auditLogs
    .map<AdminOperationsAuditHighlight>((log) => ({
      id: log.id,
      title: describeAuditEvent(log.eventType),
      description: summarizeAuditDetails(log.details),
      createdAt: log.createdAt,
      userId: log.userId,
      ipAddress: log.ipAddress,
      tone: mapAuditTone(log.eventType)
    }))
    .sort((left, right) => {
      const toneRank = { red: 3, amber: 2, slate: 1 };
      return toneRank[right.tone] - toneRank[left.tone] || Date.parse(right.createdAt) - Date.parse(left.createdAt);
    });

  const suspiciousAuditCount = auditHighlights.filter((item) => item.tone !== "slate").length;
  const attentionTaskCount = watchTasks.filter((task) => task.tone !== "slate").length;
  const proxyCoverageRate =
    proxyHealth && proxyHealth.summary.totalProxies > 0
      ? (proxyHealth.summary.activeProxies / proxyHealth.summary.totalProxies) * 100
      : null;

  const urlSwapMetrics: AdminOperationsMetric[] = [
    {
      id: "url-swap-enabled",
      label: "启用任务",
      value: String(urlSwapStats?.enabledTasks || 0),
      note: "正在参与轮询与调度的换链接任务。",
      tone: (urlSwapStats?.enabledTasks || 0) > 0 ? "emerald" : "slate"
    },
    {
      id: "url-swap-due",
      label: "待调度",
      value: String(urlSwapStats?.dueTasks || 0),
      note: "已到执行时间、等待被调度器处理的任务。",
      tone: (urlSwapStats?.dueTasks || 0) > 0 ? "amber" : "emerald"
    },
    {
      id: "url-swap-success",
      label: "24h 成功率",
      value: `${roundPercent(urlSwapStats?.recentSuccessRate || 0)}%`,
      note: "最近 24 小时的换链接执行成功率。",
      tone:
        (urlSwapStats?.recentSuccessRate || 0) >= 90
          ? "emerald"
          : (urlSwapStats?.recentSuccessRate || 0) >= 75
            ? "amber"
            : "red"
    },
    {
      id: "url-swap-missing",
      label: "待补终链",
      value: String(urlSwapHealth?.missingResolvedUrlOffers || 0),
      note: "仍缺少最新终链的 Offer，会影响后续换链接任务。",
      tone: (urlSwapHealth?.missingResolvedUrlOffers || 0) > 0 ? "amber" : "emerald"
    }
  ];

  const clickFarmMetrics: AdminOperationsMetric[] = [
    {
      id: "click-farm-active",
      label: "运行任务",
      value: String(clickFarmStats?.activeTasks || 0),
      note: "当前处于 pending 或 running 的补点击任务。",
      tone: (clickFarmStats?.activeTasks || 0) > 0 ? "emerald" : "slate"
    },
    {
      id: "click-farm-paused",
      label: "暂停任务",
      value: String(clickFarmStats?.pausedTasks || 0),
      note: "暂停任务过多时，建议复查代理、素材和预算。",
      tone: (clickFarmStats?.pausedTasks || 0) > 0 ? "amber" : "emerald"
    },
    {
      id: "click-farm-success",
      label: "整体成功率",
      value: `${roundPercent(clickFarmStats?.successRate || 0)}%`,
      note: "所有补点击任务的累计点击成功率。",
      tone:
        (clickFarmStats?.successRate || 0) >= 90
          ? "emerald"
          : (clickFarmStats?.successRate || 0) >= 75
            ? "amber"
            : "red"
    },
    {
      id: "click-farm-attention",
      label: "观察名单",
      value: String(attentionTaskCount),
      note: "成功率偏低、暂停或未排下次执行的任务数量。",
      tone: attentionTaskCount > 0 ? "amber" : "emerald"
    }
  ];

  const proxyMetrics: AdminOperationsMetric[] = [
    {
      id: "proxy-users",
      label: "覆盖用户",
      value: String(proxyHealth?.summary.usersWithProxyConfig || 0),
      note: "已配置代理池的账号数量。",
      tone: (proxyHealth?.summary.usersWithProxyConfig || 0) > 0 ? "emerald" : "red"
    },
    {
      id: "proxy-total",
      label: "总代理",
      value: String(proxyHealth?.summary.totalProxies || 0),
      note: "系统内登记的代理线路总数。",
      tone: (proxyHealth?.summary.totalProxies || 0) > 0 ? "emerald" : "red"
    },
    {
      id: "proxy-active",
      label: "可用代理",
      value: String(proxyHealth?.summary.activeProxies || 0),
      note: "当前标记为 active 的代理数量。",
      tone:
        (proxyHealth?.summary.activeProxies || 0) > 0
          ? (proxyHealth?.summary.activeProxies || 0) < (proxyHealth?.summary.totalProxies || 0)
            ? "amber"
            : "emerald"
          : "red"
    },
    {
      id: "proxy-coverage",
      label: "可用率",
      value: formatPercent(proxyCoverageRate),
      note: "活跃代理占全部代理的比例。",
      tone:
        proxyCoverageRate === null
          ? "slate"
          : proxyCoverageRate >= 90
            ? "emerald"
            : proxyCoverageRate >= 70
              ? "amber"
              : "red"
    }
  ];

  const risks: AdminOperationsRiskItem[] = [];
  if ((urlSwapHealth?.staleRunningTasks || 0) > 0) {
    risks.push({
      id: "url-swap-stale",
      title: "换链接任务存在长时间未更新记录",
      description: `当前有 ${urlSwapHealth?.staleRunningTasks || 0} 个任务超过 2 小时未完成最新执行。`,
      tone: "red",
      href: "/link-swap"
    });
  }

  if ((urlSwapHealth?.highFailureTasks || 0) > 0) {
    risks.push({
      id: "url-swap-failure",
      title: "换链接任务连续失败次数过高",
      description: `共有 ${urlSwapHealth?.highFailureTasks || 0} 个任务连续失败至少 3 次，建议检查脚本和代理。`,
      tone: "red",
      href: "/link-swap"
    });
  }

  if ((urlSwapHealth?.missingResolvedUrlOffers || 0) > 0) {
    risks.push({
      id: "url-swap-offers",
      title: "部分 Offer 还没有可用终链",
      description: `有 ${urlSwapHealth?.missingResolvedUrlOffers || 0} 个 Offer 缺少终链，可能影响后续换链接执行。`,
      tone: "amber",
      href: "/offers"
    });
  }

  if ((clickFarmStats?.pausedTasks || 0) > 0) {
    risks.push({
      id: "click-farm-paused",
      title: "补点击任务存在暂停积压",
      description: `当前有 ${clickFarmStats?.pausedTasks || 0} 个暂停任务，建议检查恢复窗口和暂停原因。`,
      tone: "amber",
      href: "/click-farm"
    });
  }

  const redWatchCount = watchTasks.filter((task) => task.tone === "red").length;
  if (redWatchCount > 0) {
    risks.push({
      id: "click-farm-low-success",
      title: "补点击任务成功率下滑",
      description: `${redWatchCount} 个任务出现成功率偏低或失败点击占优，需要优先排查。`,
      tone: "red",
      href: "/click-farm"
    });
  }

  if (proxyHealth && proxyHealth.summary.totalProxies === 0) {
    risks.push({
      id: "proxy-empty",
      title: "系统尚未配置代理池",
      description: "当前没有可用代理线路，换链接和补点击都会受到影响。",
      tone: "red",
      href: "/settings#proxy-settings"
    });
  } else if (
    proxyHealth &&
    proxyHealth.summary.activeProxies < proxyHealth.summary.totalProxies
  ) {
    risks.push({
      id: "proxy-partial",
      title: "代理池存在不可用线路",
      description: `可用代理 ${proxyHealth.summary.activeProxies} / ${proxyHealth.summary.totalProxies}，建议补充或替换失效节点。`,
      tone: "amber",
      href: "/settings#proxy-settings"
    });
  }

  if (suspiciousAuditCount > 0) {
    risks.push({
      id: "audit-alert",
      title: "最近存在需要复核的安全或配置操作",
      description: `最近日志中有 ${suspiciousAuditCount} 条高优先级记录，建议复核来源 IP 和操作上下文。`,
      tone: auditHighlights.some((item) => item.tone === "red") ? "red" : "amber",
      href: "/settings"
    });
  }

  const topCountries = (proxyHealth?.summary.countries || [])
    .slice()
    .sort((left, right) => right.active - left.active || left.country.localeCompare(right.country, "en"))
    .slice(0, 8)
    .map((country) => ({
      country: country.country,
      active: country.active,
      total: country.total,
      tone:
        country.total === 0
          ? ("slate" as const)
          : country.active === country.total
            ? ("emerald" as const)
            : ("amber" as const)
    }));

  return {
    overview: {
      monitoredTasks: (urlSwapStats?.totalTasks || 0) + (clickFarmStats?.totalTasks || 0),
      activeTasks: (urlSwapStats?.enabledTasks || 0) + (clickFarmStats?.activeTasks || 0),
      riskCount: risks.length,
      proxyCoverageRate,
      suspiciousAuditCount,
      attentionTaskCount
    },
    urlSwapMetrics,
    clickFarmMetrics,
    proxyMetrics,
    risks,
    watchTasks,
    proxyUsers,
    topCountries,
    auditHighlights
  };
}
