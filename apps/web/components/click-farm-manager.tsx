"use client";

import { formatDateTime } from "@/lib/format";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Pause,
  Play,
  RefreshCcw,
  Search,
  Target,
  Workflow,
  Zap
} from "lucide-react";

import type { ClickFarmTask, OfferRecord } from "@autocashback/domain";
import { EmptyState, PageHeader, StatCard, StatusBadge, TableSkeleton, cn } from "@autocashback/ui";
import { toast } from "sonner";

import { ClickFarmTaskDialog } from "@/components/click-farm-task-dialog";
import { fetchJson } from "@/lib/api-error-handler";
import {
  buildClickFarmConsole,
  type ClickFarmConsoleSort
} from "@/lib/click-farm-console";


const sortOptions: Array<{ value: ClickFarmConsoleSort; label: string }> = [
  { value: "recent", label: "按最新创建" },
  { value: "success-rate", label: "按成功率" },
  { value: "daily-clicks", label: "按每日点击" },
  { value: "progress", label: "按任务进度" }
];

function formatPercent(value: number | null) {
  if (value === null) {
    return "暂无样本";
  }

  return `${(value * 100).toFixed(1)}%`;
}

function statusMeta(task: ClickFarmTask) {
  if (task.status === "running") {
    return {
      label: "运行中",
      variant: "running" as const
    };
  }

  if (task.status === "pending") {
    return {
      label: "等待开始",
      variant: "pending" as const
    };
  }

  if (task.status === "paused" || task.status === "stopped") {
    return {
      label: "已暂停",
      variant: "warning" as const
    };
  }

  return {
    label: "已完成",
    variant: "success" as const
  };
}

export function ClickFarmManager() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialOfferId = Number(searchParams.get("offerId") || 0);

  const [tasks, setTasks] = useState<ClickFarmTask[]>([]);
  const [offers, setOffers] = useState<OfferRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ClickFarmTask["status"] | "all">("all");
  const [countryFilter, setCountryFilter] = useState("all");
  const [sort, setSort] = useState<ClickFarmConsoleSort>("recent");
  const [selectedOfferId, setSelectedOfferId] = useState<number | null>(null);
  const [dialogOffer, setDialogOffer] = useState<OfferRecord | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bootstrappedFromQuery, setBootstrappedFromQuery] = useState(false);
  const [taskActionLoading, setTaskActionLoading] = useState<string | null>(null);
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const selectedOffer = useMemo(
    () => offers.find((offer) => offer.id === selectedOfferId) || null,
    [offers, selectedOfferId]
  );

  const allConsole = useMemo(
    () =>
      buildClickFarmConsole(tasks, offers, {
        search: "",
        status: "all",
        country: "all",
        sort: "recent"
      }),
    [offers, tasks]
  );

  const consoleData = useMemo(
    () =>
      buildClickFarmConsole(tasks, offers, {
        search: deferredSearchQuery,
        status: statusFilter,
        country: countryFilter,
        sort
      }),
    [countryFilter, deferredSearchQuery, offers, sort, statusFilter, tasks]
  );

  async function loadAll(options?: { background?: boolean; preserveNotice?: boolean }) {
    if (options?.background) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const [tasksResult, offersResult] = await Promise.all([
        fetchJson<{ tasks: ClickFarmTask[] }>("/api/click-farm/tasks", { cache: "no-store" }),
        fetchJson<{ offers: OfferRecord[] }>("/api/offers", { cache: "no-store" })
      ]);

      if (!tasksResult.success) {
        throw new Error(tasksResult.userMessage);
      }

      if (!offersResult.success) {
        throw new Error(offersResult.userMessage);
      }

      setTasks(tasksResult.data.tasks || []);
      setOffers(offersResult.data.offers || []);
    } catch {
      toast.error("加载数据失败");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, []);

  useEffect(() => {
    if (bootstrappedFromQuery || !offers.length || !initialOfferId) {
      return;
    }

    const matchedOffer = offers.find((offer) => offer.id === initialOfferId) || null;
    if (matchedOffer) {
      setSelectedOfferId(matchedOffer.id);
      setDialogOffer(matchedOffer);
      setDialogOpen(true);
      router.replace("/click-farm");
    }

    setBootstrappedFromQuery(true);
  }, [bootstrappedFromQuery, initialOfferId, offers, router]);

  function openDialogForOffer(offer: OfferRecord) {
    setSelectedOfferId(offer.id);
    setDialogOffer(offer);
    setDialogOpen(true);
    router.replace("/click-farm");
  }

  async function handleTaskAction(action: "stop" | "restart" | "delete", task: ClickFarmTask) {
    if (action === "delete" && !window.confirm("确认删除该补点击任务？历史统计会随任务一起移除。")) {
      return;
    }

    setTaskActionLoading(`${action}-${task.id}`);

    const endpoint =
      action === "delete"
        ? `/api/click-farm/tasks/${task.id}`
        : `/api/click-farm/tasks/${task.id}/${action}`;

    const result = await fetchJson<{ task?: ClickFarmTask; success?: boolean }>(endpoint, {
      method: action === "delete" ? "DELETE" : "POST"
    });

    setTaskActionLoading(null);

    if (!result.success) {
      toast.error(result.userMessage || "操作失败");
      return;
    }

    toast.success(
      action === "stop"
        ? "任务已暂停。"
        : action === "restart"
          ? "任务已恢复。"
          : "任务已删除。"
    );

    await loadAll({ background: true, preserveNotice: true });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <button
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground disabled:opacity-60"
            disabled={refreshing}
            onClick={() => void loadAll({ background: true, preserveNotice: true })}
            type="button"
          >
            <RefreshCcw className={cn("h-4 w-4", refreshing ? "animate-spin" : "")} />
            {refreshing ? "刷新中…" : "刷新列表"}
          </button>
        }
        eyebrow="Click Farm"
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span>补点击任务控制台</span>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              {allConsole.overview.totalTasks} tasks
            </span>
          </span>
        }
      />

      <section className="bg-card text-card-foreground rounded-xl border shadow-sm p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr),auto] xl:min-w-[560px] xl:flex-1">
            <select
              className="w-full rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-foreground"
              onChange={(event) =>
                setSelectedOfferId(event.target.value ? Number(event.target.value) : null)
              }
              value={selectedOfferId || ""}
            >
              <option value="">选择 Offer</option>
              {offers.map((offer) => (
                <option key={offer.id} value={offer.id}>
                  {offer.brandName} · {offer.targetCountry}
                </option>
              ))}
            </select>

            <button
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              disabled={!selectedOffer}
              onClick={() => selectedOffer && openDialogForOffer(selectedOffer)}
              type="button"
            >
              新建 / 编辑任务
            </button>
          </div>

          <p className="text-sm text-muted-foreground">
            {selectedOffer
              ? `${selectedOffer.brandName} · ${selectedOffer.targetCountry} · ${selectedOffer.campaignLabel || "未设置 Campaign Label"}`
              : "选择 Offer 后再创建任务。"}
          </p>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-4">
        <StatCard icon={Zap} label="运行中任务" tone="emerald" value={String(allConsole.overview.activeTasks)} />
        <StatCard
          icon={AlertTriangle}
          label="暂停 / 异常"
          tone={allConsole.overview.warningTasks > 0 ? "amber" : "emerald"}
          value={String(allConsole.overview.warningTasks)}
        />
        <StatCard icon={Workflow} label="累计点击" tone="slate" value={String(allConsole.overview.totalClicks)} />
        <StatCard
          icon={Target}
          label="平均成功率"
          tone={allConsole.overview.averageSuccessRate >= 80 ? "emerald" : "amber"}
          value={`${allConsole.overview.averageSuccessRate.toFixed(1)}%`}
        />
      </section>

      <section className="space-y-6">
          <section className="bg-card text-card-foreground rounded-xl border shadow-sm p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">筛选</p>
                <h3 className="mt-2 text-xl font-semibold tracking-tight text-foreground">按状态、国家和任务规模筛选补点击任务</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {allConsole.overview.warningTasks > 0 ? (
                  <button
                    className="rounded-full bg-amber-500/10 px-4 py-2 text-xs font-semibold text-amber-600"
                    onClick={() => setStatusFilter("paused")}
                    type="button"
                  >
                    查看暂停任务
                  </button>
                ) : null}
                {(searchQuery || statusFilter !== "all" || countryFilter !== "all" || sort !== "recent") && (
                  <button
                    className="rounded-full border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground"
                    onClick={() => {
                      setSearchQuery("");
                      setStatusFilter("all");
                      setCountryFilter("all");
                      setSort("recent");
                    }}
                    type="button"
                  >
                    清空筛选
                  </button>
                )}
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <label className="block text-sm font-medium text-foreground md:col-span-2 xl:col-span-1">
                搜索任务
                <div className="mt-2 flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2">
                  <Search className="h-4 w-4 text-muted-foreground/80" />
                  <input
                    className="w-full bg-transparent text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring placeholder:text-muted-foreground/80"
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="品牌、国家、任务 ID、Offer ID"
                    value={searchQuery}
                  />
                </div>
              </label>

              <label className="block text-sm font-medium text-foreground">
                状态
                <select
                  className="mt-2 w-full rounded-lg border border-border bg-muted/40 px-3 py-2"
                  onChange={(event) =>
                    setStatusFilter(event.target.value as ClickFarmTask["status"] | "all")
                  }
                  value={statusFilter}
                >
                  <option value="all">全部状态</option>
                  <option value="running">运行中</option>
                  <option value="pending">等待开始</option>
                  <option value="paused">已暂停</option>
                  <option value="stopped">已暂停</option>
                  <option value="completed">已完成</option>
                </select>
              </label>

              <label className="block text-sm font-medium text-foreground">
                国家
                <select
                  className="mt-2 w-full rounded-lg border border-border bg-muted/40 px-3 py-2"
                  onChange={(event) => setCountryFilter(event.target.value)}
                  value={countryFilter}
                >
                  <option value="all">全部国家</option>
                  {allConsole.countryOptions.map((country) => (
                    <option key={country} value={country}>
                      {country}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm font-medium text-foreground">
                排序
                <select
                  className="mt-2 w-full rounded-lg border border-border bg-muted/40 px-3 py-2"
                  onChange={(event) => setSort(event.target.value as ClickFarmConsoleSort)}
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
              <h3 className="mt-2 text-xl font-semibold tracking-tight text-foreground">按节奏、质量和状态管理任务</h3>
            </div>

            {loading ? (
              <TableSkeleton className="m-5" rows={6} />
            ) : consoleData.rows.length ? (
              <div className="overflow-x-auto p-5">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-muted-foreground font-medium text-xs border-b border-border sticky top-0 bg-background/95 backdrop-blur z-10">
                    <tr>
                      <th className="pb-3 pr-4">Offer</th>
                      <th className="pb-3 pr-4">状态</th>
                      <th className="pb-3 pr-4">节奏</th>
                      <th className="pb-3 pr-4">质量</th>
                      <th className="pb-3 pr-4">调度</th>
                      <th className="pb-3 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {consoleData.rows.map((row) => {
                      const currentStatus = statusMeta(row.task);
                      const loadingStop = taskActionLoading === `stop-${row.task.id}`;
                      const loadingRestart = taskActionLoading === `restart-${row.task.id}`;
                      const loadingDelete = taskActionLoading === `delete-${row.task.id}`;

                      return (
                        <tr className="border-b border-border hover:bg-muted/30 transition-colors" key={row.task.id}>
                          <td className="py-4 pr-4">
                            <div className="min-w-[220px]">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-semibold text-foreground">{row.brandName}</p>
                                {row.country ? (
                                  <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                                    {row.country}
                                  </span>
                                ) : null}
                              </div>
                              <p className="mt-2 text-xs text-muted-foreground">任务 #{row.task.id}</p>
                              <p className="mt-2 text-xs text-muted-foreground">
                                {row.offer?.campaignLabel || "未设置 Campaign Label"}
                              </p>
                            </div>
                          </td>

                          <td className="py-4 pr-4">
                            <div className="min-w-[140px] space-y-2">
                              <StatusBadge label={currentStatus.label} variant={currentStatus.variant} />
                              {row.task.pauseReason ? (
                                <p className="text-xs text-amber-600">{row.task.pauseMessage || "任务已暂停"}</p>
                              ) : row.nextRunMissing ? (
                                <p className="text-xs text-amber-600">缺少下次调度时间</p>
                              ) : null}
                            </div>
                          </td>

                          <td className="py-4 pr-4">
                            <div className="min-w-[180px]">
                              <p className="text-foreground">每日点击 {row.task.dailyClickCount}</p>
                              <p className="mt-2 text-xs text-muted-foreground">
                                {row.task.startTime} - {row.task.endTime} · {row.task.timezone}
                              </p>
                              <p className="mt-2 text-xs text-muted-foreground">
                                周期 {row.task.durationDays === -1 ? "不限期" : `${row.task.durationDays} 天`}
                              </p>
                            </div>
                          </td>

                          <td className="py-4 pr-4">
                            <div className="min-w-[180px] space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className={cn(
                                    "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                                    row.needsAttention ? "bg-amber-500/10 text-amber-600" : "bg-primary/10 text-primary"
                                  )}
                                >
                                  成功率 {formatPercent(row.successRate)}
                                </span>
                                <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                                  进度 {row.progressPercent.toFixed(0)}%
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                点击总量 {row.task.totalClicks}（成功 {row.task.successClicks} / 失败 {row.task.failedClicks}）
                              </p>
                              <div className="flex items-center gap-2">
                                <span
                                  className={cn(
                                    "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                                    row.needsAttention ? "bg-amber-500/10 text-amber-600" : "bg-slate-100 text-foreground"
                                  )}
                                >
                                  {row.needsAttention ? "需关注质量" : "质量稳定"}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td className="py-4 pr-4">
                            <div className="min-w-[180px]">
                              <p className="text-foreground">{formatDateTime(row.task.nextRunAt)}</p>
                              <p className="mt-2 text-xs text-muted-foreground">
                                开始日期 {row.task.scheduledStartDate}
                              </p>
                              <p className="mt-2 text-xs text-muted-foreground">
                                创建于 {formatDateTime(row.task.createdAt)}
                              </p>
                            </div>
                          </td>

                          <td className="py-4">
                            <div className="flex min-w-[220px] flex-wrap justify-end gap-2">
                              {row.offer ? (
                                <button
                                  className="rounded-full border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground"
                                  onClick={() => openDialogForOffer(row.offer!)}
                                  type="button"
                                >
                                  编辑
                                </button>
                              ) : null}

                              {(row.task.status === "pending" || row.task.status === "running") && (
                                <button
                                  className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground disabled:opacity-60"
                                  disabled={loadingStop}
                                  onClick={() => void handleTaskAction("stop", row.task)}
                                  type="button"
                                >
                                  <Pause className="h-3.5 w-3.5" />
                                  {loadingStop ? "处理中..." : "暂停"}
                                </button>
                              )}

                              {(row.task.status === "paused" || row.task.status === "stopped") && (
                                <button
                                  className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground disabled:opacity-60"
                                  disabled={loadingRestart}
                                  onClick={() => void handleTaskAction("restart", row.task)}
                                  type="button"
                                >
                                  <Play className="h-3.5 w-3.5" />
                                  {loadingRestart ? "处理中..." : "恢复"}
                                </button>
                              )}

                              <button
                                className="rounded-full border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive disabled:opacity-60"
                                disabled={loadingDelete}
                                onClick={() => void handleTaskAction("delete", row.task)}
                                type="button"
                              >
                                {loadingDelete ? "处理中..." : "删除"}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                action={
                  <div className="flex flex-wrap justify-center gap-3">
                    <Link
                      className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground"
                      href="/offers"
                    >
                      去 Offer 管理
                    </Link>
                    {selectedOffer ? (
                      <button
                        className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white"
                        onClick={() => openDialogForOffer(selectedOffer)}
                        type="button"
                      >
                        直接创建
                      </button>
                    ) : null}
                  </div>
                }
                icon={Zap}
                title={
                  searchQuery || statusFilter !== "all" || countryFilter !== "all"
                    ? "当前筛选条件下没有任务"
                    : "还没有补点击任务"
                }
              />
            )}
          </section>
      </section>

      <ClickFarmTaskDialog
        offer={dialogOffer}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={() => void loadAll({ background: true, preserveNotice: true })}
      />
    </div>
  );
}
