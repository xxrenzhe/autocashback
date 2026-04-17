"use client";

import { formatDateTime } from "@/lib/format";

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  RefreshCcw,
  Search,
  Settings2,
  Target,
  Workflow,
  Wrench,
  Zap
} from "lucide-react";

import type {
  QueueStats,
  QueueSystemConfig,
  QueueTaskRecord,
  QueueTaskStatus,
  QueueTaskType
} from "@autocashback/domain";
import { cn } from "@autocashback/ui";
import { AdminOperationsMonitor } from "@/components/admin-operations-monitor";
import { fetchJson } from "@/lib/api-error-handler";
import {
  buildQueueConsole,
  type QueueConsoleSort,
  type SchedulerStatusPayload
} from "@/lib/queue-console";

const emptyStats: QueueStats = {
  total: 0,
  pending: 0,
  running: 0,
  completed: 0,
  failed: 0,
  byType: {
    "click-farm-trigger": 0,
    "click-farm-batch": 0,
    "click-farm": 0,
    "url-swap": 0
  },
  byTypeRunning: {
    "click-farm-trigger": 0,
    "click-farm-batch": 0,
    "click-farm": 0,
    "url-swap": 0
  }
};

type QueueConfigPayload = {
  config: QueueSystemConfig;
  configSource: "database" | "default";
  note: string;
};


const queueConfigTaskLabels: Array<{ key: QueueTaskType; label: string }> = [
  { key: "click-farm-trigger", label: "补点击触发" },
  { key: "click-farm-batch", label: "补点击批次" },
  { key: "click-farm", label: "补点击执行" },
  { key: "url-swap", label: "换链接执行" }
];

const typeOptions: Array<{ value: QueueTaskType | "all"; label: string }> = [
  { value: "all", label: "全部类型" },
  { value: "click-farm-trigger", label: "补点击触发" },
  { value: "click-farm-batch", label: "补点击批次" },
  { value: "click-farm", label: "补点击执行" },
  { value: "url-swap", label: "换链接执行" }
];

const statusOptions: Array<{ value: QueueTaskStatus | "all"; label: string }> = [
  { value: "all", label: "全部状态" },
  { value: "pending", label: "待执行" },
  { value: "running", label: "运行中" },
  { value: "completed", label: "已完成" },
  { value: "failed", label: "失败" }
];

const sortOptions: Array<{ value: QueueConsoleSort; label: string }> = [
  { value: "recent", label: "按最新创建" },
  { value: "available-at", label: "按可执行时间" },
  { value: "priority", label: "按优先级" },
  { value: "failed-first", label: "失败优先" }
];



function OverviewCard({
  label,
  note,
  tone,
  value
}: {
  label: string;
  note: string;
  tone: "emerald" | "amber" | "slate" | "red";
  value: string;
}) {
  const toneStyles = {
    emerald: {
      badge: "bg-primary/10 text-primary",
      value: "text-primary"
    },
    amber: {
      badge: "bg-amber-500/10 text-amber-600",
      value: "text-amber-600"
    },
    slate: {
      badge: "bg-slate-100 text-foreground",
      value: "text-foreground"
    },
    red: {
      badge: "bg-destructive/10 text-destructive",
      value: "text-destructive"
    }
  } as const;

  return (
    <div className="bg-card text-card-foreground rounded-xl border shadow-sm p-5">
      <span className={cn("inline-flex rounded-full px-3 py-1 text-xs font-semibold", toneStyles[tone].badge)}>
        {label}
      </span>
      <p className={cn("mt-5 font-mono tabular-nums text-4xl font-semibold", toneStyles[tone].value)}>{value}</p>
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

function schedulerTone(value: "healthy" | "warning" | "error") {
  if (value === "healthy") {
    return {
      badge: "bg-primary/10 text-primary",
      panel: "border-emerald-200 bg-emerald-50/70"
    };
  }

  if (value === "warning") {
    return {
      badge: "bg-amber-500/10 text-amber-600",
      panel: "border-amber-200 bg-amber-500/10"
    };
  }

  return {
    badge: "bg-destructive/10 text-destructive",
    panel: "border-destructive/20 bg-destructive/10"
  };
}

function taskStatusMeta(status: QueueTaskStatus) {
  if (status === "running") {
    return { label: "运行中", className: "bg-primary/10 text-primary" };
  }
  if (status === "pending") {
    return { label: "待执行", className: "bg-slate-100 text-foreground" };
  }
  if (status === "completed") {
    return { label: "已完成", className: "bg-slate-100 text-foreground" };
  }
  return { label: "失败", className: "bg-destructive/10 text-destructive" };
}

export function QueueMonitor() {
  const [stats, setStats] = useState<QueueStats>(emptyStats);
  const [tasks, setTasks] = useState<QueueTaskRecord[]>([]);
  const [schedulerStatus, setSchedulerStatus] = useState<SchedulerStatusPayload | null>(null);
  const [config, setConfig] = useState<QueueConfigPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [configLoading, setConfigLoading] = useState(true);
  const [schedulerLoading, setSchedulerLoading] = useState(true);
  const [configSaving, setConfigSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState<QueueTaskStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<QueueTaskType | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sort, setSort] = useState<QueueConsoleSort>("recent");
      const [schedulerError, setSchedulerError] = useState("");
  const [configError, setConfigError] = useState("");
  const [manualScheduling, setManualScheduling] = useState<"all" | "click-farm" | "url-swap" | null>(null);
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const consoleData = useMemo(
    () =>
      buildQueueConsole({
        stats,
        tasks,
        schedulerStatus,
        filters: {
          search: deferredSearchQuery,
          sort
        }
      }),
    [deferredSearchQuery, schedulerStatus, sort, stats, tasks]
  );

  const loadQueueData = useCallback(async (options?: { background?: boolean; preserveMessage?: boolean }) => {
    if (options?.background) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    if (!options?.preserveMessage) {
          }

    try {
      const query = new URLSearchParams();
      if (statusFilter !== "all") {
        query.set("status", statusFilter);
      }
      if (typeFilter !== "all") {
        query.set("type", typeFilter);
      }
      query.set("limit", "100");

      const [statsResult, tasksResult] = await Promise.all([
        fetchJson<{ stats: QueueStats }>("/api/queue/stats", { cache: "no-store" }),
        fetchJson<{ tasks: QueueTaskRecord[] }>(`/api/queue/tasks?${query.toString()}`, {
          cache: "no-store"
        })
      ]);

      if (!statsResult.success) {
        throw new Error(statsResult.userMessage);
      }
      if (!tasksResult.success) {
        throw new Error(tasksResult.userMessage);
      }

      setStats(statsResult.data.stats || emptyStats);
      setTasks(tasksResult.data.tasks || []);
    } catch (error: unknown) {
            setMessage(error instanceof Error ? error.message : "加载队列数据失败");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter, typeFilter]);

  const loadSchedulerStatus = useCallback(async (options?: { silent?: boolean }) => {
    try {
      if (!options?.silent) {
        setSchedulerLoading(true);
      }
      const schedulerResult = await fetchJson<{ data: SchedulerStatusPayload }>("/api/queue/scheduler", {
        cache: "no-store"
      });
      if (!schedulerResult.success) {
        throw new Error(schedulerResult.userMessage);
      }

      setSchedulerStatus(schedulerResult.data.data || null);
      setSchedulerError("");
    } catch (error: unknown) {
      setSchedulerError(error instanceof Error ? error.message : "加载调度器状态失败");
    } finally {
      setSchedulerLoading(false);
    }
  }, []);

  const loadQueueConfig = useCallback(async () => {
    try {
      setConfigLoading(true);
      const result = await fetchJson<QueueConfigPayload>("/api/queue/config", { cache: "no-store" });
      if (!result.success) {
        throw new Error(result.userMessage);
      }

      setConfig({
        config: result.data.config,
        configSource: result.data.configSource || "default",
        note: result.data.note || ""
      });
      setConfigError("");
    } catch (error: unknown) {
      setConfigError(error instanceof Error ? error.message : "加载队列配置失败");
    } finally {
      setConfigLoading(false);
    }
  }, []);

  async function saveQueueConfig() {
    if (!config) {
      return;
    }

    try {
      setConfigSaving(true);
      setConfigError("");
      const result = await fetchJson<{
        config: QueueSystemConfig;
        message?: string;
      }>("/api/queue/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config.config)
      });
      if (!result.success) {
        throw new Error(result.userMessage);
      }

      setConfig({
        config: result.data.config,
        configSource: "database",
        note: "配置保存后会在 60 秒内自动同步到后台调度服务"
      });
            setMessage(result.data.message || "队列配置已保存。");
    } catch (error: unknown) {
      setConfigError(error instanceof Error ? error.message : "保存队列配置失败");
    } finally {
      setConfigSaving(false);
    }
  }

  async function triggerManualScheduling(target: "all" | "click-farm" | "url-swap") {
    try {
      setManualScheduling(target);
      const result = await fetchJson<{
        message?: string;
        data?: {
          clickFarm?: { inserted: number; duplicate: number };
          urlSwap?: { inserted: number; duplicate: number };
        };
      }>("/api/queue/scheduler", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target })
      });
      if (!result.success) {
        throw new Error(result.userMessage);
      }

      const clickFarmInserted = result.data.data?.clickFarm?.inserted || 0;
      const urlSwapInserted = result.data.data?.urlSwap?.inserted || 0;
            setMessage(
        result.data.message ||
          `手动调度完成：补点击新增 ${clickFarmInserted}，换链接新增 ${urlSwapInserted}`
      );
      await Promise.all([
        loadQueueData({ background: true, preserveMessage: true }),
        loadSchedulerStatus({ silent: true })
      ]);
    } catch (error: unknown) {
            setMessage(error instanceof Error ? error.message : "手动调度失败");
    } finally {
      setManualScheduling(null);
    }
  }

  function updateConfigField(
    field: "globalConcurrency" | "pollIntervalMs" | "staleTimeoutMs",
    value: number
  ) {
    setConfig((current) =>
      current
        ? {
            ...current,
            config: {
              ...current.config,
              [field]: value
            }
          }
        : current
    );
  }

  function updatePerTypeConcurrency(type: QueueTaskType, value: number) {
    setConfig((current) =>
      current
        ? {
            ...current,
            config: {
              ...current.config,
              perTypeConcurrency: {
                ...current.config.perTypeConcurrency,
                [type]: value
              }
            }
          }
        : current
    );
  }

  useEffect(() => {
    void loadQueueData();
  }, [loadQueueData]);

  useEffect(() => {
    void loadSchedulerStatus();
    void loadQueueConfig();
  }, [loadQueueConfig, loadSchedulerStatus]);

  useEffect(() => {
    const interval = setInterval(() => {
      void loadQueueData({ background: true, preserveMessage: true });
    }, 30_000);

    return () => clearInterval(interval);
  }, [loadQueueData]);

  useEffect(() => {
    const interval = setInterval(() => {
      void loadSchedulerStatus({ silent: true });
    }, 60_000);

    return () => clearInterval(interval);
  }, [loadSchedulerStatus]);

  return (
    <div className="space-y-6">
      <section className="bg-card text-card-foreground rounded-xl border shadow-sm overflow-hidden p-0">
        <div className="border-b border-border/70 p-5">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">Queue</p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <h2 className="text-xl font-semibold tracking-tight tracking-tight text-foreground">统一队列控制台</h2>
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  {stats.total} tasks
                </span>
              </div>
              <p className="mt-4 text-sm leading-7 text-muted-foreground">
                把补点击、换链和调度器状态放在一个面板里看。先判断健康度，再补投待调度任务或调整并发配置。
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground disabled:opacity-60"
                disabled={refreshing}
                onClick={() => void loadQueueData({ background: true, preserveMessage: true })}
                type="button"
              >
                <RefreshCcw className={cn("h-4 w-4", refreshing ? "animate-spin" : "")} />
                {refreshing ? "刷新中…" : "刷新队列"}
              </button>
              <button
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                disabled={manualScheduling !== null}
                onClick={() => void triggerManualScheduling("all")}
                type="button"
              >
                <Zap className="h-4 w-4" />
                {manualScheduling === "all" ? "补投中..." : "补投全部待调度任务"}
              </button>
            </div>
          </div>

          
        </div>

        <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
          <ShortcutCard
            description="补点击任务积压时，直接回到业务页确认任务本身是否设置合理。"
            href="/click-farm"
            icon={Target}
            title="补点击任务"
          />
          <ShortcutCard
            description="换链任务和队列互相影响，调度异常时建议同步排查换链页。"
            href="/link-swap"
            icon={Workflow}
            title="换链管理"
          />
          <ShortcutCard
            description="代理和脚本配置异常会直接影响队列健康度，必要时从设置页回查。"
            href="/settings"
            icon={Settings2}
            title="系统设置"
          />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-4">
        <OverviewCard
          label="待执行任务"
          note="当前统一队列里尚未开始处理的任务数。"
          tone={consoleData.overview.pendingTasks > 0 ? "amber" : "emerald"}
          value={String(consoleData.overview.pendingTasks)}
        />
        <OverviewCard
          label="运行中任务"
          note="当前已被 worker 或调度器接手的任务数。"
          tone="emerald"
          value={String(consoleData.overview.runningTasks)}
        />
        <OverviewCard
          label="失败任务"
          note="建议优先查看错误信息和最近更新时间。"
          tone={consoleData.overview.failedTasks > 0 ? "red" : "emerald"}
          value={String(consoleData.overview.failedTasks)}
        />
        <OverviewCard
          label="健康调度器"
          note="当前心跳和状态都正常的调度器数量。"
          tone={consoleData.overview.activeSchedulerCount === 2 ? "emerald" : "amber"}
          value={`${consoleData.overview.activeSchedulerCount}/2`}
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr),420px]">
        <div className="space-y-6">
          <section className="bg-card text-card-foreground rounded-xl border shadow-sm p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">筛选与查看</p>
                <h3 className="mt-2 text-xl font-semibold tracking-tight text-foreground">先筛出积压或失败任务</h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  支持按类型、状态、搜索关键字和排序快速缩小范围，方便先排查最影响系统吞吐的任务。
                </p>
              </div>
              {(searchQuery || statusFilter !== "all" || typeFilter !== "all" || sort !== "recent") && (
                <button
                  className="rounded-full border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground"
                  onClick={() => {
                    setSearchQuery("");
                    setStatusFilter("all");
                    setTypeFilter("all");
                    setSort("recent");
                  }}
                  type="button"
                >
                  清空筛选
                </button>
              )}
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <label className="block text-sm font-medium text-foreground md:col-span-2 xl:col-span-1">
                搜索任务
                <div className="mt-2 flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2">
                  <Search className="h-4 w-4 text-muted-foreground/80" />
                  <input
                    className="w-full bg-transparent text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring placeholder:text-muted-foreground/80"
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="任务 ID、类型、用户、payload"
                    value={searchQuery}
                  />
                </div>
              </label>

              <label className="block text-sm font-medium text-foreground">
                类型
                <select
                  className="mt-2 w-full rounded-lg border border-border bg-muted/40 px-3 py-2"
                  onChange={(event) => setTypeFilter(event.target.value as QueueTaskType | "all")}
                  value={typeFilter}
                >
                  {typeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm font-medium text-foreground">
                状态
                <select
                  className="mt-2 w-full rounded-lg border border-border bg-muted/40 px-3 py-2"
                  onChange={(event) => setStatusFilter(event.target.value as QueueTaskStatus | "all")}
                  value={statusFilter}
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm font-medium text-foreground">
                排序
                <select
                  className="mt-2 w-full rounded-lg border border-border bg-muted/40 px-3 py-2"
                  onChange={(event) => setSort(event.target.value as QueueConsoleSort)}
                  value={sort}
                >
                  {sortOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section className="bg-card text-card-foreground rounded-xl border shadow-sm overflow-hidden p-0">
            <div className="border-b border-border/70 p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">任务列表</p>
              <h3 className="mt-2 text-xl font-semibold tracking-tight text-foreground">按时间、优先级和错误状态查看队列</h3>
            </div>

            {loading ? (
              <div className="space-y-4 p-5">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div className="rounded-xl border border-border bg-muted/40 px-4 py-5" key={index}>
                    <div className="h-4 w-32 animate-pulse rounded-full bg-stone-200" />
                    <div className="mt-4 h-4 w-full animate-pulse rounded-full bg-stone-200" />
                    <div className="mt-3 h-4 w-5/6 animate-pulse rounded-full bg-stone-200" />
                  </div>
                ))}
              </div>
            ) : consoleData.rows.length ? (
              <div className="space-y-4 p-5">
                {consoleData.rows.map((row) => {
                  const statusMeta = taskStatusMeta(row.task.status);
                  return (
                    <div className="rounded-xl border border-border bg-muted/40 p-4" key={row.task.id}>
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-mono tabular-nums text-sm font-semibold text-foreground">{row.task.id}</p>
                            <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                              {row.task.type}
                            </span>
                            <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold", statusMeta.className)}>
                              {statusMeta.label}
                            </span>
                            <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                              {row.task.priority}
                            </span>
                            {row.isPendingBacklog ? (
                              <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-600">
                                已到执行时间
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-3 break-all text-xs leading-6 text-muted-foreground">{row.payloadPreview}</p>
                          <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 xl:grid-cols-4">
                            <p>用户：#{row.task.userId}</p>
                            <p>可执行：{formatDateTime(row.task.availableAt)}</p>
                            <p>开始：{formatDateTime(row.task.startedAt)}</p>
                            <p>完成：{formatDateTime(row.task.completedAt)}</p>
                          </div>
                        </div>

                        <div className="min-w-[180px] text-xs text-muted-foreground lg:text-right">
                          <p>创建于：{formatDateTime(row.task.createdAt)}</p>
                          <p className="mt-2">更新于：{formatDateTime(row.task.updatedAt)}</p>
                          <p className="mt-2">重试：{row.task.retryCount} / {row.task.maxRetries}</p>
                          <p className="mt-2">Worker：{row.task.workerId || "--"}</p>
                        </div>
                      </div>

                      {row.task.errorMessage ? (
                        <div className="mt-4 rounded-[20px] border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs leading-6 text-destructive">
                          {row.task.errorMessage}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="px-6 py-10 text-center">
                <p className="text-base font-semibold text-foreground">当前筛选条件下没有队列任务</p>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  可以放宽筛选条件，或去业务页检查是否还有待入队的任务。
                </p>
              </div>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <section className="bg-card text-card-foreground rounded-xl border shadow-sm p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">队列配置</p>
                <h3 className="mt-2 text-xl font-semibold tracking-tight text-foreground">统一调度参数</h3>
              </div>
              <button
                className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                disabled={configLoading || configSaving || !config}
                onClick={saveQueueConfig}
                type="button"
              >
                {configSaving ? "保存中…" : "保存"}
              </button>
            </div>

            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              调整全局并发、轮询间隔和每种任务类型的并发上限，保存后会自动同步到调度服务。
            </p>

            {configLoading && !config ? (
              <p className="mt-4 rounded-lg bg-muted/40 px-4 py-5 text-sm text-muted-foreground">正在加载队列配置...</p>
            ) : null}

            {config ? (
              <>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <ConfigInput
                    label="全局并发"
                    value={config.config.globalConcurrency}
                    onChange={(value) => updateConfigField("globalConcurrency", value)}
                  />
                  <ConfigInput
                    label="轮询间隔(ms)"
                    value={config.config.pollIntervalMs}
                    onChange={(value) => updateConfigField("pollIntervalMs", value)}
                  />
                  <ConfigInput
                    label="僵尸任务超时(ms)"
                    value={config.config.staleTimeoutMs}
                    onChange={(value) => updateConfigField("staleTimeoutMs", value)}
                  />
                </div>

                <div className="mt-5 space-y-3">
                  {queueConfigTaskLabels.map((item) => (
                    <ConfigInput
                      key={item.key}
                      label={`${item.label}并发`}
                      value={config.config.perTypeConcurrency[item.key]}
                      onChange={(value) => updatePerTypeConcurrency(item.key, value)}
                    />
                  ))}
                </div>

                <div className="mt-5 rounded-xl border border-border bg-muted/40 p-4 text-sm leading-6 text-muted-foreground">
                  <p>配置来源：{config.configSource === "database" ? "数据库" : "默认值"}</p>
                  <p className="mt-2">{config.note || "配置保存后会自动同步到调度服务。"}</p>
                </div>
              </>
            ) : null}

            {configError ? <p className="mt-4 text-sm text-destructive">{configError}</p> : null}
          </section>

          <section className="bg-card text-card-foreground rounded-xl border shadow-sm p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">调度器状态</p>
                <h3 className="mt-2 text-xl font-semibold tracking-tight text-foreground">后台编排健康度</h3>
              </div>
              <button
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground disabled:opacity-60"
                disabled={schedulerLoading}
                onClick={() => void loadSchedulerStatus()}
                type="button"
              >
                {schedulerLoading ? "刷新中…" : "刷新"}
              </button>
            </div>

            {schedulerStatus ? (
              <div className="mt-5 space-y-4">
                <p className="rounded-xl bg-sky-50 p-4 text-sm leading-6 text-sky-800">
                  {schedulerStatus.note}
                </p>

                {[
                  {
                    key: "click-farm",
                    label: "补点击调度器",
                    value: schedulerStatus.clickFarmScheduler
                  },
                  {
                    key: "url-swap",
                    label: "换链接调度器",
                    value: schedulerStatus.urlSwapScheduler
                  }
                ].map((item) => {
                  const tone = schedulerTone(item.value.status);
                  return (
                    <div className={cn("rounded-xl border p-4", tone.panel)} key={item.key}>
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-semibold text-foreground">{item.label}</p>
                        <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", tone.badge)}>
                          {item.value.status}
                        </span>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-foreground">{item.value.message}</p>
                      <div className="mt-4 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                        <p>启用任务：{item.value.metrics.enabledTasks}</p>
                        <p>待调度：{item.value.metrics.overdueTasks}</p>
                        <p>最近入队：{item.value.metrics.recentQueuedTasks}</p>
                        <p>运行中：{item.value.metrics.runningTasks || 0}</p>
                        <p>检查周期：{item.value.metrics.checkInterval}</p>
                        <p>最后入队：{formatDateTime(item.value.metrics.lastQueuedAt)}</p>
                      </div>
                    </div>
                  );
                })}

                <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                  <p>最近心跳：{formatDateTime(schedulerStatus.heartbeatAt)}</p>
                  <p>最近编排：{formatDateTime(schedulerStatus.lastTickAt)}</p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <button
                    className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground disabled:opacity-60"
                    disabled={manualScheduling !== null}
                    onClick={() => void triggerManualScheduling("click-farm")}
                    type="button"
                  >
                    {manualScheduling === "click-farm" ? "补投中..." : "补投补点击"}
                  </button>
                  <button
                    className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground disabled:opacity-60"
                    disabled={manualScheduling !== null}
                    onClick={() => void triggerManualScheduling("url-swap")}
                    type="button"
                  >
                    {manualScheduling === "url-swap" ? "补投中..." : "补投换链接"}
                  </button>
                  <button
                    className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground disabled:opacity-60"
                    disabled={manualScheduling !== null}
                    onClick={() => void triggerManualScheduling("all")}
                    type="button"
                  >
                    {manualScheduling === "all" ? "补投中..." : "补投全部"}
                  </button>
                </div>
              </div>
            ) : (
              <p className="mt-4 rounded-lg bg-muted/40 px-4 py-5 text-sm text-muted-foreground">
                {schedulerLoading ? "正在加载调度器状态..." : "暂未获取到调度器状态。"}
              </p>
            )}

            {schedulerError ? <p className="mt-4 text-sm text-destructive">{schedulerError}</p> : null}
          </section>

          <section className="bg-card text-card-foreground rounded-xl border shadow-sm p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">重点提醒</p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight text-foreground">先处理这些队列风险</h3>

            <div className="mt-5 space-y-4">
              {consoleData.risks.slice(0, 4).map((risk) => (
                <div className="rounded-xl border border-border bg-background p-4" key={risk.id}>
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        "mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg",
                        risk.tone === "red"
                          ? "bg-destructive/10 text-destructive"
                          : risk.tone === "amber"
                            ? "bg-amber-500/10 text-amber-600"
                            : "bg-slate-100 text-foreground"
                      )}
                    >
                      {risk.tone === "slate" ? <Wrench className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{risk.title}</p>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">{risk.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>

      <AdminOperationsMonitor />
    </div>
  );
}

function ConfigInput(props: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="grid gap-2 text-sm text-muted-foreground">
      <span>{props.label}</span>
      <input
        className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
        min={1}
        onChange={(event) => props.onChange(Number(event.target.value || 0))}
        type="number"
        value={props.value}
      />
    </label>
  );
}
