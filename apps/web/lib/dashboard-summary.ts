export type DashboardTone = "emerald" | "amber" | "slate";
export type DashboardRiskSeverity = "high" | "medium" | "low";

export type DashboardOverview = {
  activeOffers: number;
  activeTasks: number;
  warningOffers: number;
  successRate: number;
  activeAccounts: number;
  hasGoogleAdsCredentials: boolean;
  recentSuccessfulRuns: number;
  recentFailedRuns: number;
  latestRunAt: string | null;
};

export type DashboardActionItem = {
  id: string;
  title: string;
  description: string;
  href: string;
  tone: DashboardTone;
};

export type DashboardRiskItem = {
  id: string;
  title: string;
  description: string;
  severity: DashboardRiskSeverity;
  href: string;
};

export type DashboardRecentRun = {
  id: number;
  offerId: number;
  status: "success" | "failed";
  createdAt: string;
  resolvedSuffix: string | null;
  errorMessage: string | null;
};

export type DashboardConsoleData = {
  overview: DashboardOverview;
  actions: DashboardActionItem[];
  risks: DashboardRiskItem[];
  recentRuns: DashboardRecentRun[];
};

export function buildDashboardConsoleData(input: DashboardConsoleData): DashboardConsoleData {
  const { overview, recentRuns } = input;
  const actions: DashboardActionItem[] = [];
  const risks: DashboardRiskItem[] = [];

  if (overview.activeAccounts === 0) {
    actions.push({
      id: "setup-accounts",
      title: "补充返利账号",
      description: "先录入返利平台账号，后续 Offer 才能稳定归档到对应账号。",
      href: "/accounts",
      tone: "emerald"
    });
  }

  if (overview.activeOffers === 0) {
    actions.push({
      id: "create-offer",
      title: "创建 Offer",
      description: "先补齐推广链接、国家和佣金上限，才能开始后续换链和投放处理。",
      href: "/offers",
      tone: "emerald"
    });
  }

  if (!overview.hasGoogleAdsCredentials) {
    actions.push({
      id: "connect-google-ads",
      title: "连接 Google Ads",
      description: "完成授权后，脚本换链和广告侧联动能力才能正常使用。",
      href: "/google-ads",
      tone: "slate"
    });
  }

  if (overview.activeOffers > 0 && overview.activeTasks === 0) {
    actions.push({
      id: "enable-link-swap",
      title: "开启换链任务",
      description: "当前已有 Offer 但没有自动换链任务，建议尽快启用调度。",
      href: "/link-swap",
      tone: "emerald"
    });
  }

  if (overview.warningOffers > 0) {
    actions.push({
      id: "review-warning-offers",
      title: "处理佣金预警",
      description: `有 ${overview.warningOffers} 个 Offer 进入预警区间，建议优先复核预算和佣金录入。`,
      href: "/offers",
      tone: "amber"
    });
  }

  if (overview.recentFailedRuns > 0) {
    actions.push({
      id: "review-failed-runs",
      title: "复核失败解析",
      description: `最近 50 条换链记录里有 ${overview.recentFailedRuns} 次失败，需要检查代理、链接跳转或 Google Ads 配置。`,
      href: "/link-swap",
      tone: "amber"
    });
  }

  if (actions.length === 0) {
    actions.push(
      {
        id: "maintain-offers",
        title: "维护 Offer 数据",
        description: "继续更新品牌、国家和佣金信息，保持后续任务和报表准确。",
        href: "/offers",
        tone: "emerald"
      },
      {
        id: "review-settings",
        title: "检查系统设置",
        description: "定期复核代理、密码和系统参数，确保自动任务持续可用。",
        href: "/settings",
        tone: "slate"
      }
    );
  }

  if (overview.warningOffers > 0) {
    risks.push({
      id: "risk-offer-warning",
      title: "佣金阈值预警",
      description: `${overview.warningOffers} 个 Offer 已达到或接近佣金上限，建议立即确认是否暂停或调整预算。`,
      severity: overview.warningOffers >= 3 ? "high" : "medium",
      href: "/offers"
    });
  }

  if (overview.recentFailedRuns > 0) {
    risks.push({
      id: "risk-failed-runs",
      title: "最近换链存在失败",
      description: `最近 50 条记录里有 ${overview.recentFailedRuns} 次失败，自动换链稳定性需要复核。`,
      severity: overview.recentFailedRuns >= 5 ? "high" : "medium",
      href: "/link-swap"
    });
  }

  if (!overview.hasGoogleAdsCredentials) {
    risks.push({
      id: "risk-google-ads",
      title: "Google Ads 未完成授权",
      description: "Google Ads 凭据尚未配置完整，相关联动能力会受到限制。",
      severity: "medium",
      href: "/google-ads"
    });
  }

  if (overview.activeOffers > 0 && overview.activeTasks === 0) {
    risks.push({
      id: "risk-no-link-swap-tasks",
      title: "自动换链未启用",
      description: "已有 Offer 在管理中，但当前没有启用中的换链任务，后续解析不会自动执行。",
      severity: "medium",
      href: "/link-swap"
    });
  }

  if (risks.length === 0) {
    risks.push({
      id: "risk-clear",
      title: "当前没有高优先级风险",
      description: "最近的账号、Offer 和换链指标保持稳定，可以继续推进日常运营动作。",
      severity: "low",
      href: "/dashboard"
    });
  }

  return {
    overview,
    actions: actions.slice(0, 4),
    risks: risks.slice(0, 4),
    recentRuns: recentRuns.slice(0, 5)
  };
}
