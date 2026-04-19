"use client";

import { formatDateTime } from "@/lib/format";

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  Activity,
  RefreshCcw,
  Search,
  Settings,
  Workflow,
  Zap
} from "lucide-react";

import type {
  QueueStats,
  QueueSystemConfig,
  QueueTaskRecord,
  QueueTaskStatus,
  QueueTaskType
} from "@autocashback/domain";
import { EmptyState, StatusBadge, TableSkeleton, cn } from "@autocashback/ui";
import { toast } from "sonner";
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

const TASKS_PAGE_SIZE = 12;

function schedulerTone(value: "healthy" | "warning" | "error") {
  if (value === "healthy") {
    return {
      panel: "border-emerald-200 bg-emerald-50/70"
    };
  }

  if (value === "warning") {
    return {
      panel: "border-amber-200 bg-amber-500/10"
    };
  }

  return {
    panel: "border-destructive/20 bg-destructive/10"
  };
}

function queueTaskStatusBadge(status: QueueTaskStatus) {
  if (status === "running") {
    return { label: "运行中", variant: "running" as const };
  }
  if (status === "pending") {
    return { label: "待执行", variant: "pending" as const };
  }
  if (status === "completed") {
    return { label: "已完成", variant: "success" as const };
  }
  return { label: "失败", variant: "error" as const };
}

function schedulerStatusBadge(status: "healthy" | "warning" | "error") {
  if (status === "healthy") {
    return { label: "healthy", variant: "success" as const };
  }
  if (status === "warning") {
    return { label: "warning", variant: "warning" as const };
  }
  return { label: "error", variant: "error" as const };
}

export function QueueMonitor() {
  const [stats, setStats] = useState<QueueStats>(emptyStats);
  const [tasks, setTasks] = useState<QueueTaskRecord[]>([]);
  const [schedulerStatus, setSchedulerStatus] = useState<SchedulerStatusPayload | null>(null);
  const [config, setConfig] = useState<QueueConfigPayload | null>(null);
  const [activeTab, setActiveTab] = useState<"monitor" | "config">("monitor");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [configLoading, setConfigLoading] = useState(true);
  const [schedulerLoading, setSchedulerLoading] = useState(true);
  const [configSaving, setConfigSaving] = useState(false);
  const [savedConfigSnapshot, setSavedConfigSnapshot] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<QueueTaskStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<QueueTaskType | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sort, setSort] = useState<QueueConsoleSort>("recent");
  const [visibleTaskCount, setVisibleTaskCount] = useState(TASKS_PAGE_SIZE);
  const [message, setMessage] = useState("");
  const [manualScheduling, setManualScheduling] = useState<"all" | "click-farm" | "url-swap" | null>(null);
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const currentConfigSnapshot = useMemo(
    () => (config ? JSON.stringify(config.config) : null),
    [config]
  );
  const configDirty = Boolean(
    currentConfigSnapshot &&
      savedConfigSnapshot &&
      currentConfigSnapshot !== savedConfigSnapshot
  );

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
  const visibleRows = useMemo(
    () => consoleData.rows.slice(0, visibleTaskCount),
    [consoleData.rows, visibleTaskCount]
  );
  const hasMoreRows = visibleTaskCount < consoleData.rows.length;

  const loadQueueData = useCallback(async (options?: {
    background?: boolean;
    preserveMessage?: boolean;
    notifyOnError?: boolean;
  }) => {
    if (options?.background) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    if (!options?.preserveMessage) {
      setMessage("");
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
      const errorMessage = error instanceof Error ? error.message : "加载队列数据失败";
      const shouldNotify = options?.notifyOnError ?? !options?.background;
      if (shouldNotify) {
        toast.error(errorMessage);
      }
      if (!options?.preserveMessage) {
        setMessage("");
      }
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
    } catch (error: unknown) {
      if (!options?.silent) {
        toast.error(error instanceof Error ? error.message : "加载调度器状态失败");
      }
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
      setSavedConfigSnapshot(JSON.stringify(result.data.config));
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "加载队列配置失败");
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
      setSavedConfigSnapshot(JSON.stringify(result.data.config));
      setMessage(result.data.message || "队列配置已保存。");
      toast.success(result.data.message || "队列配置已保存。");
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "保存队列配置失败";
      toast.error(errorMessage);
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
      toast.success(
        result.data.message ||
          `手动调度完成：补点击新增 ${clickFarmInserted}，换链接新增 ${urlSwapInserted}`
      );
      await Promise.all([
        loadQueueData({ background: true, preserveMessage: true }),
        loadSchedulerStatus({ silent: true })
      ]);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "手动调度失败";
      setMessage("");
      toast.error(errorMessage);
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

  function resetQueueConfig() {
    if (!savedConfigSnapshot) {
      return;
    }

    try {
      const savedConfig = JSON.parse(savedConfigSnapshot) as QueueSystemConfig;
      setConfig((current) =>
        current
          ? {
              ...current,
              config: savedConfig
            }
          : current
      );
      toast.success("已恢复到上次保存的配置。");
    } catch {
      toast.error("恢复配置失败，请刷新页面后重试");
    }
  }

  useEffect(() => {
    if (activeTab !== "monitor") {
      return;
    }
    void loadQueueData();
  }, [activeTab, loadQueueData]);

  useEffect(() => {
    void loadQueueConfig();
  }, [loadQueueConfig]);

  useEffect(() => {
    if (activeTab !== "monitor") {
      return;
    }
    void loadSchedulerStatus();
  }, [activeTab, loadSchedulerStatus]);

  useEffect(() => {
    if (activeTab !== "monitor") {
      return undefined;
    }
    const interval = setInterval(() => {
      void loadQueueData({ background: true, preserveMessage: true });
    }, 30_000);

    return () => clearInterval(interval);
  }, [activeTab, loadQueueData]);

  useEffect(() => {
    if (activeTab !== "monitor") {
      return undefined;
    }
    const interval = setInterval(() => {
      void loadSchedulerStatus({ silent: true });
    }, 60_000);

    return () => clearInterval(interval);
  }, [activeTab, loadSchedulerStatus]);

  useEffect(() => {
    if (!configDirty) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [configDirty]);

  useEffect(() => {
    setVisibleTaskCount(TASKS_PAGE_SIZE);
  }, [searchQuery, sort, statusFilter, typeFilter]);

  const totalTasks = stats.running + stats.pending + stats.completed + stats.failed;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">队列配置与监控</h1>
          <p className="mt-1 text-sm text-muted-foreground">管理任务队列、调度状态和并发限制</p>
        </div>
        {activeTab === "monitor" ? (
          <div className="flex flex-wrap gap-3">
            <button
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground disabled:opacity-60"
              disabled={refreshing}
              onClick={() =>
                void loadQueueData({
                  background: true,
                  preserveMessage: true,
                  notifyOnError: true
                })
              }
              type="button"
            >
              <RefreshCcw className={cn("h-4 w-4", refreshing ? "animate-spin" : "")} />
              {refreshing ? "刷新中…" : "刷新"}
            </button>
            <button
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              disabled={manualScheduling !== null}
              onClick={() => void triggerManualScheduling("all")}
              type="button"
            >
              <Zap className="h-4 w-4" />
              {manualScheduling === "all" ? "补投中..." : "手动补投"}
            </button>
          </div>
        ) : null}
      </div>

      <div className="border-b border-border">
        <nav className="-mb-px flex gap-8">
          <button
            className={cn(
              "inline-flex items-center gap-2 border-b-2 px-1 py-4 text-sm font-medium transition-colors",
              activeTab === "monitor"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
            )}
            onClick={() => setActiveTab("monitor")}
            type="button"
          >
            <Activity className="h-4 w-4" />
            实时监控
          </button>
          <button
            className={cn(
              "inline-flex items-center gap-2 border-b-2 px-1 py-4 text-sm font-medium transition-colors",
              activeTab === "config"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
            )}
            onClick={() => setActiveTab("config")}
            type="button"
          >
            <Settings className="h-4 w-4" />
            配置管理
          </button>
        </nav>
      </div>

      {message ? (
        <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-foreground">
          {message}
        </div>
      ) : null}

      {activeTab === "monitor" ? (
        <div className="space-y-6">
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MonitorCard
              label="运行中"
              tone="blue"
              value={String(consoleData.overview.runningTasks)}
              meta={`总任务 ${totalTasks}`}
            />
            <MonitorCard
              label="待执行"
              tone="amber"
              value={String(consoleData.overview.pendingTasks)}
              meta={`类型 ${typeFilter === "all" ? "全部" : typeFilter}`}
            />
            <MonitorCard
              label="失败"
              tone="red"
              value={String(consoleData.overview.failedTasks)}
              meta={`排序 ${sortOptions.find((option) => option.value === sort)?.label || "按最新创建"}`}
            />
            <MonitorCard
              label="调度器"
              tone={consoleData.overview.activeSchedulerCount === 2 ? "emerald" : "slate"}
              value={`${consoleData.overview.activeSchedulerCount}/2`}
              meta={schedulerStatus ? `心跳 ${formatDateTime(schedulerStatus.heartbeatAt)}` : "等待状态"}
            />
          </section>

          <section className="bg-card text-card-foreground rounded-xl border shadow-sm overflow-hidden">
            <div className="border-b border-border/70 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-primary">任务列表</p>
                  <h2 className="mt-2 text-xl font-semibold tracking-tight text-foreground">队列监控</h2>
                </div>
                {(searchQuery || statusFilter !== "all" || typeFilter !== "all" || sort !== "recent") && (
                  <button
                    className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground"
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

              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <label className="block text-sm font-medium text-foreground md:col-span-2">
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
            </div>

            {loading ? (
              <TableSkeleton className="m-5" rows={8} />
            ) : consoleData.rows.length ? (
              <div className="overflow-x-auto">
                <table className="min-w-[1080px] w-full text-left text-sm">
                  <thead className="bg-muted/30 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    <tr className="border-b border-border/70">
                      <th className="px-5 py-3">任务</th>
                      <th className="px-5 py-3">状态</th>
                      <th className="px-5 py-3">用户</th>
                      <th className="px-5 py-3">调度</th>
                      <th className="px-5 py-3">执行</th>
                      <th className="px-5 py-3">更新</th>
                    </tr>
                  </thead>
                  <tbody className="bg-background">
                    {visibleRows.map((row) => {
                      const statusMeta = queueTaskStatusBadge(row.task.status);
                      return (
                        <tr className="border-b border-border/40 align-top" key={row.task.id}>
                          <td className="px-5 py-4">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-mono tabular-nums font-semibold text-foreground">{row.task.id}</span>
                                <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                                  {row.task.type}
                                </span>
                                <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                                  P{row.task.priority}
                                </span>
                                {row.isPendingBacklog ? (
                                  <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-600">
                                    已到执行时间
                                  </span>
                                ) : null}
                              </div>
                              <p className="mt-2 break-all text-xs leading-5 text-muted-foreground">{row.payloadPreview}</p>
                              {row.task.errorMessage ? (
                                <p className="mt-2 text-xs leading-5 text-destructive">{row.task.errorMessage}</p>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <StatusBadge className="px-2.5 py-1 text-[11px]" label={statusMeta.label} variant={statusMeta.variant} />
                          </td>
                          <td className="px-5 py-4 text-muted-foreground">#{row.task.userId}</td>
                          <td className="px-5 py-4 text-xs text-muted-foreground">
                            <p>可执行：{formatDateTime(row.task.availableAt)}</p>
                            <p className="mt-1">开始：{formatDateTime(row.task.startedAt)}</p>
                            <p className="mt-1">完成：{formatDateTime(row.task.completedAt)}</p>
                          </td>
                          <td className="px-5 py-4 text-xs text-muted-foreground">
                            <p>重试：{row.task.retryCount} / {row.task.maxRetries}</p>
                            <p className="mt-1">Worker：{row.task.workerId || "--"}</p>
                          </td>
                          <td className="px-5 py-4 text-xs text-muted-foreground">
                            <p>创建：{formatDateTime(row.task.createdAt)}</p>
                            <p className="mt-1">更新：{formatDateTime(row.task.updatedAt)}</p>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState className="m-5" icon={Workflow} title="当前筛选条件下没有队列任务" />
            )}

            {hasMoreRows ? (
              <div className="border-t border-border/60 p-5">
                <button
                  className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground"
                  onClick={() => setVisibleTaskCount((current) => current + TASKS_PAGE_SIZE)}
                  type="button"
                >
                  加载更多
                </button>
              </div>
            ) : null}
          </section>

          <section className="bg-card text-card-foreground rounded-xl border shadow-sm p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">调度器健康检查</p>
                <h2 className="mt-2 text-xl font-semibold tracking-tight text-foreground">后台调度器</h2>
                <p className="mt-2 text-sm text-muted-foreground">监控换链接和补点击调度器的状态与入队情况。</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground disabled:opacity-60"
                  disabled={schedulerLoading}
                  onClick={() => void loadSchedulerStatus()}
                  type="button"
                >
                  {schedulerLoading ? "刷新中…" : "刷新"}
                </button>
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
              </div>
            </div>

            {schedulerStatus ? (
              <div className="mt-5 space-y-4">
                {schedulerStatus.note ? (
                  <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
                    {schedulerStatus.note}
                  </div>
                ) : null}

                <div className="grid gap-4 lg:grid-cols-2">
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
                    const statusMeta = schedulerStatusBadge(item.value.status);
                    return (
                      <div className={cn("rounded-xl border p-4", tone.panel)} key={item.key}>
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="font-medium text-foreground">{item.label}</h3>
                          <StatusBadge label={statusMeta.label} variant={statusMeta.variant} />
                        </div>
                        <p className="mt-3 text-sm text-foreground">{item.value.message}</p>
                        <div className="mt-4 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                          <p>启用任务：{item.value.metrics.enabledTasks}</p>
                          <p>最近入队：{item.value.metrics.recentQueuedTasks}</p>
                          <p>待调度：{item.value.metrics.overdueTasks}</p>
                          <p>运行中：{item.value.metrics.runningTasks || 0}</p>
                          <p>检查周期：{item.value.metrics.checkInterval}</p>
                          <p>最后入队：{formatDateTime(item.value.metrics.lastQueuedAt)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                  <p>最近心跳：{formatDateTime(schedulerStatus.heartbeatAt)}</p>
                  <p>最近编排：{formatDateTime(schedulerStatus.lastTickAt)}</p>
                </div>
              </div>
            ) : (
              <p className="mt-4 rounded-lg bg-muted/40 px-4 py-5 text-sm text-muted-foreground">
                {schedulerLoading ? "正在加载调度器状态..." : "暂未获取到调度器状态。"}
              </p>
            )}
          </section>
        </div>
      ) : (
        <div className="space-y-6">
          <section className="rounded-xl border border-amber-200 bg-amber-500/10 px-4 py-3 text-sm text-amber-800">
            修改配置后会直接生效，建议按机器能力逐步调整并发限制。
          </section>

          <section
            className={cn(
              "bg-card text-card-foreground rounded-xl border shadow-sm p-5",
              configDirty ? "border-amber-200 bg-amber-500/5" : ""
            )}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">队列配置</p>
                <h2 className="mt-2 text-xl font-semibold tracking-tight text-foreground">配置管理</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground disabled:opacity-60"
                  disabled={!configDirty || configSaving}
                  onClick={resetQueueConfig}
                  type="button"
                >
                  重置
                </button>
                <button
                  className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  disabled={configLoading || configSaving || !config || !configDirty}
                  onClick={saveQueueConfig}
                  type="button"
                >
                  {configSaving ? "保存中…" : "保存配置"}
                </button>
              </div>
            </div>

            {configDirty ? (
              <p className="mt-4 rounded-lg border border-amber-200 bg-amber-500/10 px-3 py-2 text-sm text-amber-700">
                当前配置有未保存修改。
              </p>
            ) : null}

            {configLoading && !config ? (
              <p className="mt-4 rounded-lg bg-muted/40 px-4 py-5 text-sm text-muted-foreground">正在加载队列配置...</p>
            ) : null}

            {config ? (
              <>
                <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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

                <div className="mt-6 grid gap-4 lg:grid-cols-2">
                  <div className="space-y-3">
                    {queueConfigTaskLabels.map((item) => (
                      <ConfigInput
                        key={item.key}
                        label={`${item.label}并发`}
                        value={config.config.perTypeConcurrency[item.key]}
                        onChange={(value) => updatePerTypeConcurrency(item.key, value)}
                      />
                    ))}
                  </div>

                  <div className="rounded-xl border border-border bg-muted/40 p-4">
                    <p className="text-sm font-semibold text-foreground">当前生效配置</p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <ConfigStat label="全局并发" value={String(config.config.globalConcurrency)} />
                      <ConfigStat label="轮询间隔" value={`${config.config.pollIntervalMs} ms`} />
                      <ConfigStat label="僵尸超时" value={`${config.config.staleTimeoutMs} ms`} />
                      <ConfigStat label="来源" value={config.configSource === "database" ? "数据库" : "默认值"} />
                    </div>
                    <p className="mt-4 text-sm text-muted-foreground">
                      {config.note || "配置保存后会自动同步到调度服务。"}
                    </p>
                  </div>
                </div>
              </>
            ) : null}

            {!configLoading && !config ? (
              <p className="mt-4 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                暂未加载到队列配置，请刷新页面后重试。
              </p>
            ) : null}
          </section>
        </div>
      )}
    </div>
  );
}

function MonitorCard(props: {
  label: string;
  value: string;
  meta: string;
  tone: "amber" | "blue" | "emerald" | "red" | "slate";
}) {
  const toneStyles = {
    blue: "bg-blue-100 text-blue-700",
    amber: "bg-amber-100 text-amber-700",
    emerald: "bg-emerald-100 text-emerald-700",
    red: "bg-red-100 text-red-700",
    slate: "bg-slate-100 text-slate-700"
  } as const;

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{props.label}</span>
        <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold", toneStyles[props.tone])}>
          {props.label}
        </span>
      </div>
      <p className="mt-4 text-3xl font-semibold tracking-tight text-foreground">{props.value}</p>
      <p className="mt-2 text-sm text-muted-foreground">{props.meta}</p>
    </div>
  );
}

function ConfigStat(props: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-3">
      <p className="text-xs text-muted-foreground">{props.label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{props.value}</p>
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
