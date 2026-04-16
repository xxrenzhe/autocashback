"use client";

import { useEffect, useState } from "react";

import { fetchJson } from "@/lib/api-error-handler";

type UrlSwapStats = {
  totalTasks: number;
  enabledTasks: number;
  googleAdsModeTasks: number;
  scriptModeTasks: number;
  erroredTasks: number;
  dueTasks: number;
  recentSuccessRate: number;
};

type UrlSwapHealth = {
  staleRunningTasks: number;
  highFailureTasks: number;
  missingResolvedUrlOffers: number;
};

type ClickFarmStats = {
  totalTasks: number;
  activeTasks: number;
  pausedTasks: number;
  totalClicks: number;
  successClicks: number;
  failedClicks: number;
  successRate: number;
};

type ClickFarmTaskRow = {
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

type ProxyHealth = {
  summary: {
    usersWithProxyConfig: number;
    totalProxies: number;
    activeProxies: number;
    countries: Array<{ country: string; total: number; active: number }>;
  };
};

type AuditLogRecord = {
  id: number;
  userId: number | null;
  eventType: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  details: Record<string, unknown> | null;
};

function formatDateTime(value: string | null) {
  if (!value) {
    return "--";
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toLocaleString("zh-CN") : value;
}

export function AdminOperationsMonitor() {
  const [urlSwapStats, setUrlSwapStats] = useState<UrlSwapStats | null>(null);
  const [urlSwapHealth, setUrlSwapHealth] = useState<UrlSwapHealth | null>(null);
  const [clickFarmStats, setClickFarmStats] = useState<ClickFarmStats | null>(null);
  const [clickFarmTasks, setClickFarmTasks] = useState<ClickFarmTaskRow[]>([]);
  const [proxyHealth, setProxyHealth] = useState<ProxyHealth | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadAll() {
    setLoading(true);
    const [urlSwapStatsResult, urlSwapHealthResult, clickFarmStatsResult, clickFarmTasksResult, proxyHealthResult, auditLogsResult] =
      await Promise.all([
        fetchJson<{ data: UrlSwapStats }>("/api/admin/url-swap/stats"),
        fetchJson<{ data: UrlSwapHealth }>("/api/admin/url-swap/health"),
        fetchJson<{ data: ClickFarmStats }>("/api/admin/click-farm/stats"),
        fetchJson<{ data: { tasks: ClickFarmTaskRow[] } }>("/api/admin/click-farm/tasks?limit=8"),
        fetchJson<{ data: ProxyHealth }>("/api/admin/proxy-health"),
        fetchJson<{ logs: AuditLogRecord[] }>("/api/admin/audit-logs?limit=12")
      ]);

    const firstError = [
      urlSwapStatsResult,
      urlSwapHealthResult,
      clickFarmStatsResult,
      clickFarmTasksResult,
      proxyHealthResult,
      auditLogsResult
    ].find((item) => !item.success);
    if (firstError && !firstError.success) {
      setMessage(firstError.userMessage);
      setLoading(false);
      return;
    }

    setUrlSwapStats(urlSwapStatsResult.success ? urlSwapStatsResult.data.data : null);
    setUrlSwapHealth(urlSwapHealthResult.success ? urlSwapHealthResult.data.data : null);
    setClickFarmStats(clickFarmStatsResult.success ? clickFarmStatsResult.data.data : null);
    setClickFarmTasks(clickFarmTasksResult.success ? clickFarmTasksResult.data.data.tasks || [] : []);
    setProxyHealth(proxyHealthResult.success ? proxyHealthResult.data.data : null);
    setAuditLogs(auditLogsResult.success ? auditLogsResult.data.logs || [] : []);
    setMessage("");
    setLoading(false);
  }

  useEffect(() => {
    void loadAll();
  }, []);

  return (
    <section className="surface-panel p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="eyebrow">业务监控</p>
          <h3 className="mt-2 text-2xl font-semibold text-slate-900">管理员运维视图</h3>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            在一个视图里查看换链接、补点击、代理池和审计日志，便于管理员快速掌握系统运行情况。
          </p>
        </div>
        <button
          className="rounded-2xl border border-brand-line bg-white px-5 py-3 text-sm font-semibold text-slate-700"
          onClick={loadAll}
          type="button"
        >
          刷新业务监控
        </button>
      </div>

      {message ? <p className="mt-4 text-sm text-red-700">{message}</p> : null}
      {loading ? (
        <p className="mt-4 rounded-2xl bg-stone-50 px-4 py-5 text-sm text-slate-500">正在加载业务监控...</p>
      ) : null}

      {!loading ? (
        <div className="mt-6 space-y-6">
          <div className="grid gap-4 xl:grid-cols-3">
            <Card title="换链接总览">
              <p>总任务：{urlSwapStats?.totalTasks || 0}</p>
              <p>启用任务：{urlSwapStats?.enabledTasks || 0}</p>
              <p>待调度：{urlSwapStats?.dueTasks || 0}</p>
              <p>24h 成功率：{urlSwapStats?.recentSuccessRate || 0}%</p>
            </Card>
            <Card title="换链接健康">
              <p>卡住任务：{urlSwapHealth?.staleRunningTasks || 0}</p>
              <p>高失败任务：{urlSwapHealth?.highFailureTasks || 0}</p>
              <p>缺少终链 Offer：{urlSwapHealth?.missingResolvedUrlOffers || 0}</p>
            </Card>
            <Card title="补点击总览">
              <p>总任务：{clickFarmStats?.totalTasks || 0}</p>
              <p>活跃任务：{clickFarmStats?.activeTasks || 0}</p>
              <p>暂停任务：{clickFarmStats?.pausedTasks || 0}</p>
              <p>成功率：{clickFarmStats?.successRate || 0}%</p>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
            <div className="rounded-[28px] border border-brand-line bg-stone-50 p-5">
              <p className="text-sm font-semibold text-slate-900">补点击任务明细</p>
              <div className="mt-4 grid gap-3">
                {clickFarmTasks.length ? (
                  clickFarmTasks.map((task) => (
                    <div className="rounded-2xl border border-brand-line bg-white p-4" key={task.id}>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            {task.brandName || `Task #${task.id}`}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {task.username} · {task.status} · progress {task.progress}%
                          </p>
                        </div>
                        <div className="text-right text-xs text-slate-500">
                          <p>总点击：{task.totalClicks}</p>
                          <p>成功 / 失败：{task.successClicks} / {task.failedClicks}</p>
                        </div>
                      </div>
                      <p className="mt-3 text-xs text-slate-500">
                        下次运行：{formatDateTime(task.nextRunAt)} · 更新时间：{formatDateTime(task.updatedAt)}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="rounded-2xl bg-white px-4 py-5 text-sm text-slate-500">暂无任务数据。</p>
                )}
              </div>
            </div>

            <div className="rounded-[28px] border border-brand-line bg-stone-50 p-5">
              <p className="text-sm font-semibold text-slate-900">代理池覆盖</p>
              <div className="mt-4 space-y-2 text-sm text-slate-600">
                <p>配置用户数：{proxyHealth?.summary.usersWithProxyConfig || 0}</p>
                <p>总代理数：{proxyHealth?.summary.totalProxies || 0}</p>
                <p>激活代理：{proxyHealth?.summary.activeProxies || 0}</p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {(proxyHealth?.summary.countries || []).slice(0, 10).map((country) => (
                  <span
                    className="rounded-full border border-brand-line bg-white px-3 py-1 text-xs text-slate-600"
                    key={country.country}
                  >
                    {country.country} {country.active}/{country.total}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-brand-line bg-stone-50 p-5">
            <p className="text-sm font-semibold text-slate-900">最近审计日志</p>
            <div className="mt-4 grid gap-3">
              {auditLogs.length ? (
                auditLogs.map((log) => (
                  <div className="rounded-2xl border border-brand-line bg-white p-4" key={log.id}>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{log.eventType}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          user #{log.userId || 0} · {log.ipAddress || "unknown ip"}
                        </p>
                      </div>
                      <p className="text-xs text-slate-500">{formatDateTime(log.createdAt)}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="rounded-2xl bg-white px-4 py-5 text-sm text-slate-500">暂无审计日志。</p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function Card(props: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[28px] border border-brand-line bg-stone-50 p-5 text-sm text-slate-600">
      <p className="font-semibold text-slate-900">{props.title}</p>
      <div className="mt-3 space-y-2">{props.children}</div>
    </div>
  );
}
