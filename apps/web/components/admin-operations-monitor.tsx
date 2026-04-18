"use client";

import { formatDateTime } from "@/lib/format";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Globe2,
  RefreshCcw,
  ShieldAlert,
  ShieldCheck,
  Target,
  Workflow,
  Wrench
} from "lucide-react";

import { cn } from "@autocashback/ui";

import { fetchJson } from "@/lib/api-error-handler";
import {
  buildAdminOperationsConsole,
  type AdminAuditLogRecord,
  type AdminClickFarmStats,
  type AdminClickFarmTaskRow,
  type AdminOperationsMetric,
  type AdminProxyHealth,
  type AdminUrlSwapHealth,
  type AdminUrlSwapStats
} from "@/lib/admin-operations-console";

function formatPercent(value: number | null) {
  if (value === null) {
    return "--";
  }

  const normalized = Number(value.toFixed(1));
  return `${Number.isInteger(normalized) ? normalized.toFixed(0) : normalized}%`;
}

function toneStyles(tone: "emerald" | "amber" | "red" | "slate") {
  if (tone === "emerald") {
    return {
      badge: "bg-primary/10 text-primary",
      icon: "bg-primary/10 text-primary",
      value: "text-primary"
    };
  }

  if (tone === "amber") {
    return {
      badge: "bg-amber-500/10 text-amber-600",
      icon: "bg-amber-500/10 text-amber-600",
      value: "text-amber-600"
    };
  }

  if (tone === "red") {
    return {
      badge: "bg-destructive/10 text-destructive",
      icon: "bg-destructive/10 text-destructive",
      value: "text-destructive"
    };
  }

  return {
    badge: "bg-slate-100 text-foreground",
    icon: "bg-slate-100 text-foreground",
    value: "text-foreground"
  };
}

function OverviewCard({
  icon: Icon,
  label,
  note,
  tone,
  value
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  note: string;
  tone: "emerald" | "amber" | "red" | "slate";
  value: string;
}) {
  const styles = toneStyles(tone);

  return (
    <div className="bg-card text-card-foreground rounded-xl border shadow-sm p-5">
      <div className="flex items-start justify-between gap-4">
        <span className={cn("inline-flex rounded-full px-3 py-1 text-xs font-semibold", styles.badge)}>
          {label}
        </span>
        <span className={cn("flex h-10 w-10 items-center justify-center rounded-lg", styles.icon)}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className={cn("mt-5 font-mono tabular-nums text-4xl font-semibold", styles.value)}>{value}</p>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{note}</p>
    </div>
  );
}

function ShortcutCard({
  description,
  href,
  icon: Icon,
  title
}: {
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
}) {
  return (
    <Link
      className="group rounded-xl border border-border bg-background/90 p-4 transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md motion-reduce:transform-none"
      href={href}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </span>
        <ArrowRight className="h-4 w-4 text-muted-foreground/80 transition group-hover:text-primary" />
      </div>
      <p className="mt-4 text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
    </Link>
  );
}

function MetricGroup({
  description,
  metrics,
  title
}: {
  description: string;
  metrics: AdminOperationsMetric[];
  title: string;
}) {
  return (
    <section className="bg-card text-card-foreground rounded-xl border shadow-sm p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-primary">{title}</p>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {metrics.map((metric) => {
          const styles = toneStyles(metric.tone);
          return (
            <div className="rounded-xl border border-border bg-background p-4" key={metric.id}>
              <span className={cn("inline-flex rounded-full px-3 py-1 text-xs font-semibold", styles.badge)}>
                {metric.label}
              </span>
              <p className={cn("mt-4 font-mono tabular-nums text-xl font-semibold tracking-tight", styles.value)}>{metric.value}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{metric.note}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function taskStatusMeta(status: string) {
  if (status === "running") {
    return { label: "运行中", className: "bg-primary/10 text-primary" };
  }

  if (status === "pending") {
    return { label: "待执行", className: "bg-slate-100 text-foreground" };
  }

  if (status === "paused" || status === "stopped") {
    return { label: "已暂停", className: "bg-amber-500/10 text-amber-600" };
  }

  if (status === "completed") {
    return { label: "已完成", className: "bg-slate-100 text-foreground" };
  }

  return { label: status || "未知状态", className: "bg-slate-100 text-foreground" };
}

export function AdminOperationsMonitor() {
  const [urlSwapStats, setUrlSwapStats] = useState<AdminUrlSwapStats | null>(null);
  const [urlSwapHealth, setUrlSwapHealth] = useState<AdminUrlSwapHealth | null>(null);
  const [clickFarmStats, setClickFarmStats] = useState<AdminClickFarmStats | null>(null);
  const [clickFarmTasks, setClickFarmTasks] = useState<AdminClickFarmTaskRow[]>([]);
  const [proxyHealth, setProxyHealth] = useState<AdminProxyHealth | null>(null);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLogRecord[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const consoleData = useMemo(
    () =>
      buildAdminOperationsConsole({
        urlSwapStats,
        urlSwapHealth,
        clickFarmStats,
        clickFarmTasks,
        proxyHealth,
        auditLogs
      }),
    [auditLogs, clickFarmStats, clickFarmTasks, proxyHealth, urlSwapHealth, urlSwapStats]
  );

  const loadAll = useCallback(async (options?: { background?: boolean }) => {
    if (options?.background) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const [
        urlSwapStatsResult,
        urlSwapHealthResult,
        clickFarmStatsResult,
        clickFarmTasksResult,
        proxyHealthResult,
        auditLogsResult
      ] = await Promise.all([
        fetchJson<{ data: AdminUrlSwapStats }>("/api/admin/url-swap/stats", { cache: "no-store" }),
        fetchJson<{ data: AdminUrlSwapHealth }>("/api/admin/url-swap/health", { cache: "no-store" }),
        fetchJson<{ data: AdminClickFarmStats }>("/api/admin/click-farm/stats", {
          cache: "no-store"
        }),
        fetchJson<{ data: { tasks: AdminClickFarmTaskRow[] } }>("/api/admin/click-farm/tasks?limit=8", {
          cache: "no-store"
        }),
        fetchJson<{ data: AdminProxyHealth }>("/api/admin/proxy-health", { cache: "no-store" }),
        fetchJson<{ logs: AdminAuditLogRecord[] }>("/api/admin/audit-logs?limit=12", {
          cache: "no-store"
        })
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
        return;
      }

      setUrlSwapStats(urlSwapStatsResult.success ? urlSwapStatsResult.data.data : null);
      setUrlSwapHealth(urlSwapHealthResult.success ? urlSwapHealthResult.data.data : null);
      setClickFarmStats(clickFarmStatsResult.success ? clickFarmStatsResult.data.data : null);
      setClickFarmTasks(clickFarmTasksResult.success ? clickFarmTasksResult.data.data.tasks || [] : []);
      setProxyHealth(proxyHealthResult.success ? proxyHealthResult.data.data : null);
      setAuditLogs(auditLogsResult.success ? auditLogsResult.data.logs || [] : []);
      setMessage("");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "加载业务监控失败");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  return (
    <div className="space-y-6">
      <section className="bg-card text-card-foreground rounded-xl border shadow-sm overflow-hidden p-0">
        <div className="grid gap-0 xl:grid-cols-[1.1fr,0.9fr]">
          <div className="bg-[radial-gradient(circle_at_top_left,rgba(5,150,105,0.16),transparent_48%),linear-gradient(180deg,rgba(236,253,245,0.95)_0%,rgba(255,255,255,0.98)_100%)] px-6 py-7 sm:px-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">Admin Ops</p>
                <h3 className="mt-3 text-xl font-semibold tracking-tight text-foreground">业务运营控制台</h3>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">
                  先看整体负载和风险，再跳转到换链接、补点击、代理或 Offer 页面做针对性处理。
                </p>
              </div>

              <button
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-background/90 px-3 py-2 text-sm font-semibold text-foreground transition hover:border-emerald-200 hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
                disabled={loading || refreshing}
                onClick={() => void loadAll({ background: !loading })}
                type="button"
              >
                <RefreshCcw className={cn("h-4 w-4", refreshing ? "animate-spin" : "")} />
                {refreshing ? "刷新中…" : "刷新监控"}
              </button>
            </div>

            {message ? (
              <p className="mt-4 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {message}
              </p>
            ) : null}

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <ShortcutCard
                description="查看到点待执行、连续失败和终链缺失任务。"
                href="/link-swap"
                icon={Workflow}
                title="处理换链接任务"
              />
              <ShortcutCard
                description="优先恢复暂停任务，复查成功率下滑的补点击计划。"
                href="/click-farm"
                icon={Target}
                title="处理补点击任务"
              />
              <ShortcutCard
                description="维护代理国家覆盖和失效线路，避免批量任务被拖慢。"
                href="/settings#proxy-settings"
                icon={Globe2}
                title="维护代理池"
              />
              <ShortcutCard
                description="补齐终链和品牌信息，减少换链接任务空跑。"
                href="/offers"
                icon={ShieldCheck}
                title="复核 Offer 准备度"
              />
            </div>
          </div>

          <div className="bg-background px-6 py-7 sm:px-8">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">Overview</p>
            <h4 className="mt-3 text-xl font-semibold tracking-tight text-foreground">先看这四个总览指标</h4>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              用任务量、活跃量、风险数和代理可用率判断当前是否适合继续放量。
            </p>

            {loading ? (
              <p className="mt-6 rounded-xl bg-muted/40 px-4 py-5 text-sm text-muted-foreground">正在加载业务监控...</p>
            ) : (
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <OverviewCard
                  icon={Workflow}
                  label="受监控任务"
                  note="换链接与补点击任务合计，便于快速评估总负载。"
                  tone="slate"
                  value={String(consoleData.overview.monitoredTasks)}
                />
                <OverviewCard
                  icon={Target}
                  label="当前活跃"
                  note="启用或正在执行的任务量，反映现阶段系统压力。"
                  tone={consoleData.overview.activeTasks > 0 ? "emerald" : "slate"}
                  value={String(consoleData.overview.activeTasks)}
                />
                <OverviewCard
                  icon={ShieldAlert}
                  label="风险信号"
                  note={`包含 ${consoleData.overview.suspiciousAuditCount} 条需要复核的安全或配置日志。`}
                  tone={consoleData.overview.riskCount > 0 ? "red" : "emerald"}
                  value={String(consoleData.overview.riskCount)}
                />
                <OverviewCard
                  icon={Globe2}
                  label="代理可用率"
                  note="建议保持高于 90%，避免调度器可运行但任务实际落空。"
                  tone={
                    consoleData.overview.proxyCoverageRate === null
                      ? "slate"
                      : consoleData.overview.proxyCoverageRate >= 90
                        ? "emerald"
                        : consoleData.overview.proxyCoverageRate >= 70
                          ? "amber"
                          : "red"
                  }
                  value={formatPercent(consoleData.overview.proxyCoverageRate)}
                />
              </div>
            )}
          </div>
        </div>
      </section>

      {!loading ? (
        <>
          <div className="grid gap-5 xl:grid-cols-[1.05fr,0.95fr]">
            <section className="bg-card text-card-foreground rounded-xl border shadow-sm p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">Risks</p>
              <h4 className="mt-3 text-xl font-semibold tracking-tight text-foreground">先处理这些风险</h4>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                这些信号会直接影响换链接命中率、补点击成功率或账号安全。
              </p>

              <div className="mt-5 space-y-4">
                {consoleData.risks.length ? (
                  consoleData.risks.map((risk) => (
                    <Link
                      className="group block rounded-xl border border-border bg-background p-4 transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md motion-reduce:transform-none"
                      href={risk.href}
                      key={risk.id}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={cn(
                            "mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg",
                            risk.tone === "red"
                              ? "bg-destructive/10 text-destructive"
                              : risk.tone === "amber"
                                ? "bg-amber-500/10 text-amber-600"
                                : "bg-slate-100 text-foreground"
                          )}
                        >
                          {risk.tone === "slate" ? (
                            <Wrench className="h-4 w-4" />
                          ) : (
                            <AlertTriangle className="h-4 w-4" />
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-sm font-semibold text-foreground">{risk.title}</p>
                            <ArrowRight className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground/80 transition group-hover:text-primary" />
                          </div>
                          <p className="mt-2 text-sm leading-6 text-muted-foreground">{risk.description}</p>
                        </div>
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="rounded-xl border border-border bg-primary/10/60 px-4 py-5">
                    <p className="text-sm font-semibold text-primary">当前没有明显风险</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      调度器、代理和最近审计日志都处于稳定区间，可以继续按计划推进任务。
                    </p>
                  </div>
                )}
              </div>
            </section>

            <div className="space-y-6">
              <MetricGroup
                description="重点关注待调度任务、24 小时成功率，以及仍缺终链的 Offer。"
                metrics={consoleData.urlSwapMetrics}
                title="换链接脉冲"
              />

              <section className="bg-card text-card-foreground rounded-xl border shadow-sm p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">Proxy</p>
                <h4 className="mt-3 text-xl font-semibold tracking-tight text-foreground">代理池覆盖</h4>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  代理池不仅影响换链接，也直接决定补点击任务的恢复速度和国家覆盖能力。
                </p>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {consoleData.proxyMetrics.map((metric) => {
                    const styles = toneStyles(metric.tone);
                    return (
                      <div className="rounded-xl border border-border bg-background p-4" key={metric.id}>
                        <span className={cn("inline-flex rounded-full px-3 py-1 text-xs font-semibold", styles.badge)}>
                          {metric.label}
                        </span>
                        <p className={cn("mt-4 font-mono tabular-nums text-xl font-semibold tracking-tight", styles.value)}>{metric.value}</p>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">{metric.note}</p>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  {consoleData.topCountries.length ? (
                    consoleData.topCountries.map((country) => (
                      <span
                        className={cn(
                          "rounded-full border px-3 py-1 text-xs font-medium",
                          country.tone === "emerald"
                            ? "border-emerald-200 bg-primary/10 text-primary"
                            : country.tone === "amber"
                              ? "border-amber-200 bg-amber-500/10 text-amber-600"
                              : "border-border bg-background text-muted-foreground"
                        )}
                        key={country.country}
                      >
                        {country.country} {country.active}/{country.total}
                      </span>
                    ))
                  ) : (
                    <span className="rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground">
                      暂无国家覆盖数据
                    </span>
                  )}
                </div>
              </section>
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-[1.05fr,0.95fr]">
            <section className="bg-card text-card-foreground rounded-xl border shadow-sm p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">Action</p>
              <h4 className="mt-3 text-xl font-semibold tracking-tight text-foreground">补点击观察名单</h4>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                先看成功率下滑、暂停或没有下次执行时间的任务，再决定是否恢复、暂停或重建。
              </p>

              <div className="mt-5 space-y-4">
                {consoleData.watchTasks.length ? (
                  consoleData.watchTasks.map((task) => {
                    const meta = taskStatusMeta(task.status);
                    return (
                      <div className="rounded-xl border border-border bg-background p-4" key={task.id}>
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-foreground">
                                {task.brandName || `Task #${task.id}`}
                              </p>
                              <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold", meta.className)}>
                                {meta.label}
                              </span>
                              <span
                                className={cn(
                                  "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                                  task.tone === "red"
                                    ? "bg-destructive/10 text-destructive"
                                    : task.tone === "amber"
                                      ? "bg-amber-500/10 text-amber-600"
                                      : "bg-slate-100 text-foreground"
                                )}
                              >
                                {task.tone === "red" ? "优先排查" : task.tone === "amber" ? "建议跟进" : "持续观察"}
                              </span>
                            </div>
                            <p className="mt-2 text-sm leading-6 text-muted-foreground">
                              {task.username} · 进度 {task.progress}% · 成功率 {formatPercent(task.successRate)}
                            </p>
                          </div>

                          <div className="text-sm text-muted-foreground sm:text-right">
                            <p>总点击 {task.totalClicks}</p>
                            <p>
                              成功 / 失败 {task.successClicks} / {task.failedClicks}
                            </p>
                          </div>
                        </div>

                        <p className="mt-3 text-sm leading-6 text-muted-foreground">{task.reason}</p>
                        <p className="mt-3 text-xs text-muted-foreground">
                          下次执行：{formatDateTime(task.nextRunAt)} · 最近更新：{formatDateTime(task.updatedAt)}
                        </p>
                      </div>
                    );
                  })
                ) : (
                  <p className="rounded-xl border border-border bg-background px-4 py-5 text-sm text-muted-foreground">
                    暂无需要关注的补点击任务。
                  </p>
                )}
              </div>
            </section>

            <div className="space-y-6">
              <section className="bg-card text-card-foreground rounded-xl border shadow-sm p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">Coverage</p>
                <h4 className="mt-3 text-xl font-semibold tracking-tight text-foreground">账号代理覆盖</h4>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  优先补足没有可用代理的账号，其次处理只有部分线路可用的账号。
                </p>

                <div className="mt-5 space-y-4">
                  {consoleData.proxyUsers.length ? (
                    consoleData.proxyUsers.slice(0, 6).map((user) => (
                      <div className="rounded-xl border border-border bg-background p-4" key={user.userId}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-foreground">{user.username}</p>
                              <span
                                className={cn(
                                  "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                                  user.tone === "red"
                                    ? "bg-destructive/10 text-destructive"
                                    : user.tone === "amber"
                                      ? "bg-amber-500/10 text-amber-600"
                                      : "bg-slate-100 text-foreground"
                                )}
                              >
                                {user.tone === "red" ? "线路中断" : user.tone === "amber" ? "部分可用" : "覆盖完整"}
                              </span>
                            </div>
                            <p className="mt-2 text-sm leading-6 text-muted-foreground">{user.note}</p>
                          </div>
                          <div className="text-sm text-muted-foreground sm:text-right">
                            <p>
                              可用 {user.activeProxies} / {user.totalProxies}
                            </p>
                            <p>覆盖率 {formatPercent(user.coverageRate)}</p>
                          </div>
                        </div>
                        <p className="mt-3 text-xs text-muted-foreground">
                          国家：{user.countries.length ? user.countries.join(", ") : "未记录"}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="rounded-xl border border-border bg-background px-4 py-5 text-sm text-muted-foreground">
                      暂无账号代理配置数据。
                    </p>
                  )}
                </div>
              </section>

              <section className="bg-card text-card-foreground rounded-xl border shadow-sm p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">Audit</p>
                <h4 className="mt-3 text-xl font-semibold tracking-tight text-foreground">最近安全与配置操作</h4>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  优先检查未授权访问、敏感数据读取和代理相关配置变更。
                </p>

                <div className="mt-5 space-y-4">
                  {consoleData.auditHighlights.length ? (
                    consoleData.auditHighlights.slice(0, 6).map((item) => (
                      <div className="rounded-xl border border-border bg-background p-4" key={item.id}>
                        <div className="flex items-start gap-3">
                          <span
                            className={cn(
                              "mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg",
                              item.tone === "red"
                                ? "bg-destructive/10 text-destructive"
                                : item.tone === "amber"
                                  ? "bg-amber-500/10 text-amber-600"
                                  : "bg-slate-100 text-foreground"
                            )}
                          >
                            {item.tone === "slate" ? (
                              <ShieldCheck className="h-4 w-4" />
                            ) : (
                              <AlertTriangle className="h-4 w-4" />
                            )}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                              <div>
                                <p className="text-sm font-semibold text-foreground">{item.title}</p>
                                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
                              </div>
                              <p className="text-xs text-muted-foreground">{formatDateTime(item.createdAt)}</p>
                            </div>
                            <p className="mt-3 text-xs text-muted-foreground">
                              user #{item.userId || 0} · {item.ipAddress || "unknown ip"}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="rounded-xl border border-border bg-background px-4 py-5 text-sm text-muted-foreground">
                      暂无审计日志。
                    </p>
                  )}
                </div>
              </section>
            </div>
          </div>

          <MetricGroup
            description="补点击任务的活跃量、暂停量和整体成功率决定了是否适合继续放量。"
            metrics={consoleData.clickFarmMetrics}
            title="补点击负载"
          />
        </>
      ) : null}
    </div>
  );
}
