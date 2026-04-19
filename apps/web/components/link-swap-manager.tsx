"use client";

import { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckCircle2,
  Copy,
  History,
  Link2,
  MoreHorizontal,
  Pause,
  PencilLine,
  Play,
  RefreshCcw,
  ShieldAlert,
} from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";

import type { LinkSwapRunRecord, LinkSwapTaskRecord, OfferRecord } from "@autocashback/domain";
import {
  CardSkeleton,
  EmptyState,
  PageHeader,
  StatCard,
  StatSkeleton,
  StatusBadge,
  cn,
  getStatusBadgeMeta
} from "@autocashback/ui";
import { toast } from "sonner";

import { LinkSwapTaskDialog } from "@/components/link-swap-task-dialog";
import { ModalFrame } from "@/components/modal-frame";
import { fetchJson } from "@/lib/api-error-handler";
import {
  buildLinkSwapConsole,
  type LinkSwapConsoleRow,
  type LinkSwapConsoleStatus
} from "@/lib/link-swap-console";

type ScriptTemplatePayload = {
  template: string;
  token: string;
};

type FeedbackState = {
  tone: "success" | "error";
  text: string;
};

type SortField = "offer" | "status" | "mode" | "interval" | "lastRun" | "nextRun" | "failures";
type SortDirection = "asc" | "desc";

const statusFilterOptions: Array<{ value: "all" | LinkSwapConsoleStatus; label: string }> = [
  { value: "all", label: "全部状态" },
  { value: "running", label: "运行中" },
  { value: "paused", label: "已暂停" },
  { value: "warning", label: "预警" },
  { value: "error", label: "异常" }
];

const modeFilterOptions: Array<{ value: "all" | LinkSwapTaskRecord["mode"]; label: string }> = [
  { value: "all", label: "全部模式" },
  { value: "script", label: "Script 模式" },
  { value: "google_ads_api", label: "Google Ads API" }
];

function formatDateTime(value: string | null) {
  if (!value) {
    return "--";
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed)
    ? new Date(parsed).toLocaleString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
      })
    : value;
}

function formatRunSummary(run: LinkSwapRunRecord | null) {
  if (!run) {
    return "暂无执行记录";
  }

  return run.resolvedSuffix || run.errorMessage || "本次执行未返回 suffix";
}

function getRowSortValue(row: LinkSwapConsoleRow, field: SortField): number | string {
  switch (field) {
    case "offer":
      return (row.offer?.brandName || row.offer?.campaignLabel || `Offer ${row.task.offerId}`).toLowerCase();
    case "status":
      return row.statusGroup;
    case "mode":
      return row.task.mode;
    case "interval":
      return row.task.intervalMinutes;
    case "lastRun":
      return Date.parse(row.task.lastRunAt || row.latestRun?.createdAt || "") || 0;
    case "nextRun":
      return Date.parse(row.task.nextRunAt || "") || 0;
    case "failures":
      return row.task.consecutiveFailures;
    default:
      return row.task.id;
  }
}

function compareRows(left: LinkSwapConsoleRow, right: LinkSwapConsoleRow, field: SortField, direction: SortDirection) {
  const leftValue = getRowSortValue(left, field);
  const rightValue = getRowSortValue(right, field);

  let base =
    typeof leftValue === "number" && typeof rightValue === "number"
      ? leftValue - rightValue
      : String(leftValue).localeCompare(String(rightValue), "zh-CN", { numeric: true });

  if (field === "status") {
    const statusRank: Record<LinkSwapConsoleStatus, number> = {
      error: 0,
      warning: 1,
      running: 2,
      paused: 3
    };
    base = statusRank[left.statusGroup] - statusRank[right.statusGroup];
  }

  return direction === "asc" ? base : -base;
}

function SortableHeader({
  active,
  direction,
  label,
  onClick
}: {
  active: boolean;
  direction: SortDirection;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className="inline-flex items-center gap-1 text-left text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground"
      onClick={onClick}
      type="button"
    >
      <span>{label}</span>
      {!active ? (
        <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground/80" />
      ) : direction === "asc" ? (
        <ArrowUp className="h-3.5 w-3.5 text-foreground" />
      ) : (
        <ArrowDown className="h-3.5 w-3.5 text-foreground" />
      )}
    </button>
  );
}

function statusVariant(status: LinkSwapConsoleStatus) {
  switch (status) {
    case "running":
      return "running" as const;
    case "paused":
      return "paused" as const;
    case "warning":
      return "warning" as const;
    case "error":
      return "error" as const;
    default:
      return "idle" as const;
  }
}

export function LinkSwapManager() {
  const searchParams = useSearchParams();
  const selectedOfferId = Number(searchParams.get("offerId") || 0);

  const [tasks, setTasks] = useState<LinkSwapTaskRecord[]>([]);
  const [runs, setRuns] = useState<LinkSwapRunRecord[]>([]);
  const [offers, setOffers] = useState<OfferRecord[]>([]);
  const [script, setScript] = useState<ScriptTemplatePayload>({ template: "", token: "" });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rotatingToken, setRotatingToken] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [activeOffer, setActiveOffer] = useState<OfferRecord | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyTask, setHistoryTask] = useState<LinkSwapConsoleRow | null>(null);
  const [historyRecords, setHistoryRecords] = useState<LinkSwapRunRecord[]>([]);
  const [taskActionLoading, setTaskActionLoading] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | LinkSwapConsoleStatus>("all");
  const [modeFilter, setModeFilter] = useState<"all" | LinkSwapTaskRecord["mode"]>("all");
  const [sortField, setSortField] = useState<SortField>("nextRun");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const deferredSearchQuery = useDeferredValue(searchQuery);

  async function loadAll(options?: { refresh?: boolean }) {
    if (options?.refresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    const [tasksResult, runsResult, offersResult, scriptResult] = await Promise.all([
      fetchJson<{ tasks: LinkSwapTaskRecord[] }>("/api/link-swap/tasks", { cache: "no-store" }),
      fetchJson<{ runs: LinkSwapRunRecord[] }>("/api/link-swap/runs", { cache: "no-store" }),
      fetchJson<{ offers: OfferRecord[] }>("/api/offers", { cache: "no-store" }),
      fetchJson<ScriptTemplatePayload>("/api/script/link-swap/template", { cache: "no-store" })
    ]);

    const failedResult = [tasksResult, runsResult, offersResult, scriptResult].find((result) => !result.success);
    if (failedResult && !failedResult.success) {
      toast.error(failedResult.userMessage);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    setTasks(tasksResult.success ? tasksResult.data.tasks || [] : []);
    setRuns(runsResult.success ? runsResult.data.runs || [] : []);
    setOffers(offersResult.success ? offersResult.data.offers || [] : []);
    setScript(scriptResult.success ? scriptResult.data : { template: "", token: "" });
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => {
    void loadAll();
  }, []);

  useEffect(() => {
    if (!selectedOfferId || !offers.length) {
      return;
    }

    const offer = offers.find((item) => item.id === selectedOfferId) || null;
    if (offer) {
      setActiveOffer(offer);
    }
  }, [offers, selectedOfferId]);

  const consoleData = useMemo(() => buildLinkSwapConsole(tasks, offers, runs), [tasks, offers, runs]);

  const filteredRows = useMemo(() => {
    const normalizedQuery = deferredSearchQuery.trim().toLowerCase();

    return consoleData.rows
      .filter((row) => {
        if (normalizedQuery && !row.searchText.includes(normalizedQuery)) {
          return false;
        }

        if (statusFilter !== "all" && row.statusGroup !== statusFilter) {
          return false;
        }

        if (modeFilter !== "all" && row.task.mode !== modeFilter) {
          return false;
        }

        return true;
      })
      .slice()
      .sort((left: LinkSwapConsoleRow, right: LinkSwapConsoleRow) =>
        compareRows(left, right, sortField, sortDirection)
      );
  }, [consoleData.rows, deferredSearchQuery, modeFilter, sortDirection, sortField, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [deferredSearchQuery, modeFilter, pageSize, sortDirection, sortField, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  async function handleTaskAction(taskId: number, action: "enable" | "disable" | "swap-now") {
    setTaskActionLoading(`${action}-${taskId}`);
    
    const result = await fetchJson<{ message?: string }>(`/api/link-swap/tasks/${taskId}/${action}`, {
      method: "POST"
    });

    if (!result.success) {
      toast.error(result.userMessage);
      setTaskActionLoading(null);
      return;
    }

    setFeedback({
      tone: "success",
      text:
        result.data.message ||
        (action === "enable" ? "任务已恢复" : action === "disable" ? "任务已暂停" : "任务已加入立即执行队列")
    });
    await loadAll({ refresh: true });
    setTaskActionLoading(null);
  }

  async function openHistory(row: LinkSwapConsoleRow) {
    setHistoryTask(row);
    setHistoryOpen(true);
    setHistoryLoading(true);
    setHistoryRecords([]);

    const result = await fetchJson<{ history: LinkSwapRunRecord[] }>(
      `/api/link-swap/tasks/${row.task.id}/history`,
      { cache: "no-store" }
    );

    if (!result.success) {
      toast.error(result.userMessage);
      setHistoryLoading(false);
      return;
    }

    setHistoryRecords(result.data.history || []);
    setHistoryLoading(false);
  }

  async function rotateToken() {
    setRotatingToken(true);
    
    const result = await fetchJson<{ message?: string }>(
      "/api/script/link-swap/rotate-token",
      { method: "POST" }
    );

    if (!result.success) {
      toast.error(result.userMessage);
      setRotatingToken(false);
      return;
    }

    await loadAll({ refresh: true });
    setFeedback({
      tone: "success",
      text: "Token 已更换，旧脚本立即失效，请重新复制最新脚本。"
    });
    setRotatingToken(false);
  }

  async function copyScriptTemplate() {
    if (!script.template) {
      toast.error("当前没有可复制的脚本模板");
      return;
    }

    try {
      await navigator.clipboard.writeText(script.template);
      toast.success("最新换链脚本已复制到剪贴板");
    } catch {
      toast.error("复制失败，请检查浏览器剪贴板权限");
    }
  }

  function toggleSort(field: SortField) {
    if (sortField !== field) {
      startTransition(() => {
        setSortField(field);
        setSortDirection(field === "offer" || field === "mode" || field === "status" ? "asc" : "desc");
      });
      return;
    }

    startTransition(() => {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
    });
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader />
        <section className="grid gap-4 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <StatSkeleton key={index} />
          ))}
        </section>
        <section className="grid gap-5 xl:grid-cols-[1.2fr,0.8fr]">
          <CardSkeleton className="min-h-80" />
          <CardSkeleton className="min-h-80" />
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <button
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-muted/40 disabled:opacity-60"
            disabled={refreshing}
            onClick={() => void loadAll({ refresh: true })}
            type="button"
          >
            <RefreshCcw className={cn("h-4 w-4", refreshing ? "animate-spin" : "")} />
            {refreshing ? "刷新中" : "刷新"}
          </button>
        }
      />

      <section className="bg-card text-card-foreground rounded-xl border shadow-sm p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Script Token</p>
            <p className="mt-2 break-all font-mono tabular-nums text-sm text-muted-foreground">
              {script.token || "尚未生成"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="rounded-full border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground disabled:opacity-60"
              disabled={rotatingToken}
              onClick={() => void rotateToken()}
              type="button"
            >
              {rotatingToken ? "更换中..." : "更换 Token"}
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
              disabled={!script.template || rotatingToken}
              onClick={() => void copyScriptTemplate()}
              type="button"
            >
              <Copy className="h-3.5 w-3.5" />
              复制最新脚本
            </button>
            <button
              className="rounded-full border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground"
              onClick={() => {
                setHistoryTask(null);
                setHistoryRecords(runs.slice(0, 20));
                setHistoryLoading(false);
                setHistoryOpen(true);
              }}
              type="button"
            >
              查看执行历史
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-5">
        <StatCard
          icon={Link2}
          label="总任务"
          note="当前用户下所有换链任务数量。"
          tone="slate"
          value={`${consoleData.stats.totalTasks}`}
        />
        <StatCard
          icon={Play}
          label="运行中"
          note="当前处于可调度状态的任务。"
          tone="emerald"
          value={`${consoleData.stats.runningTasks}`}
        />
        <StatCard
          icon={Pause}
          label="已暂停"
          note="已停用或暂不调度的任务。"
          tone="slate"
          value={`${consoleData.stats.pausedTasks}`}
        />
        <StatCard
          icon={ShieldAlert}
          label="预警/异常"
          note="存在连续失败或状态异常的任务。"
          tone="amber"
          value={`${consoleData.stats.warningTasks}`}
        />
        <StatCard
          icon={CheckCircle2}
          label="最近成功率"
          note="基于最近执行记录计算的成功比例。"
          tone="emerald"
          value={`${consoleData.stats.recentSuccessRate}%`}
        />
      </section>

      {feedback ? (
        <section
          className={cn(
            "rounded-xl border px-5 py-4 text-sm",
            feedback.tone === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-destructive/20 bg-destructive/10 text-red-800"
          )}
        >
          {feedback.text}
        </section>
      ) : null}

      <section className="space-y-6">
        <div className="bg-card text-card-foreground rounded-xl border shadow-sm p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">任务列表</p>
              <h3 className="mt-2 text-xl font-semibold tracking-tight text-foreground">按状态筛选和处理任务</h3>
            </div>
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr),auto,auto] xl:min-w-[560px]">
              <label className="relative block">
                <span className="sr-only">搜索任务</span>
                <input
                  className="w-full rounded-lg border border-border bg-muted/40 py-3 pl-4 pr-4 text-sm text-foreground"
                  onChange={(event) =>
                    startTransition(() => {
                      setSearchQuery(event.target.value);
                    })
                  }
                  placeholder="搜索品牌、标签、Offer ID 或 Google Ads ID"
                  value={searchQuery}
                />
              </label>

              <select
                className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-foreground"
                onChange={(event) =>
                  startTransition(() => {
                    setStatusFilter(event.target.value as "all" | LinkSwapConsoleStatus);
                  })
                }
                value={statusFilter}
              >
                {statusFilterOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <select
                className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-foreground"
                onChange={(event) =>
                  startTransition(() => {
                    setModeFilter(event.target.value as "all" | LinkSwapTaskRecord["mode"]);
                  })
                }
                value={modeFilter}
              >
                {modeFilterOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border/70">
                  <th className="pb-3">
                    <SortableHeader
                      active={sortField === "offer"}
                      direction={sortDirection}
                      label="Offer"
                      onClick={() => toggleSort("offer")}
                    />
                  </th>
                  <th className="pb-3">
                    <SortableHeader
                      active={sortField === "status"}
                      direction={sortDirection}
                      label="状态"
                      onClick={() => toggleSort("status")}
                    />
                  </th>
                  <th className="pb-3">
                    <SortableHeader
                      active={sortField === "mode"}
                      direction={sortDirection}
                      label="模式"
                      onClick={() => toggleSort("mode")}
                    />
                  </th>
                  <th className="pb-3">
                    <SortableHeader
                      active={sortField === "interval"}
                      direction={sortDirection}
                      label="间隔"
                      onClick={() => toggleSort("interval")}
                    />
                  </th>
                  <th className="pb-3">
                    <SortableHeader
                      active={sortField === "lastRun"}
                      direction={sortDirection}
                      label="最近执行"
                      onClick={() => toggleSort("lastRun")}
                    />
                  </th>
                  <th className="pb-3">
                    <SortableHeader
                      active={sortField === "nextRun"}
                      direction={sortDirection}
                      label="下次执行"
                      onClick={() => toggleSort("nextRun")}
                    />
                  </th>
                  <th className="pb-3">
                    <SortableHeader
                      active={sortField === "failures"}
                      direction={sortDirection}
                      label="失败"
                      onClick={() => toggleSort("failures")}
                    />
                  </th>
                  <th className="pb-3 text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRows.length ? (
                  paginatedRows.map((row: LinkSwapConsoleRow) => {
                    const isRunning = row.statusGroup === "running";
                    const taskStatusVariant = statusVariant(row.statusGroup);
                    const taskStatusMeta = getStatusBadgeMeta(taskStatusVariant);
                    return (
                      <tr className="border-b border-border/40 align-top" key={row.task.id}>
                        <td className="py-4 pr-4">
                          <div className="min-w-[220px]">
                            <p className="font-semibold text-foreground">
                              {row.offer?.brandName || `Offer #${row.task.offerId}`}
                            </p>
                            <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
                              {row.offer?.campaignLabel || "未设置标签"} · {row.offer?.targetCountry || "--"}
                            </p>
                            <p className="mt-2 break-all text-xs text-muted-foreground">
                              {formatRunSummary(row.latestRun)}
                            </p>
                          </div>
                        </td>
                        <td className="py-4 pr-4">
                          <StatusBadge label={taskStatusMeta.label} variant={taskStatusVariant} />
                        </td>
                        <td className="py-4 pr-4 text-foreground">
                          {row.task.mode === "script" ? "Script" : "Google Ads API"}
                        </td>
                        <td className="py-4 pr-4 text-foreground">{row.task.intervalMinutes} 分钟</td>
                        <td className="py-4 pr-4 text-foreground">
                          <div>
                            <p>{formatDateTime(row.task.lastRunAt || row.latestRun?.createdAt || null)}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              近 50 条: 成功 {row.recentSuccessCount} / 失败 {row.recentFailureCount}
                            </p>
                          </div>
                        </td>
                        <td className="py-4 pr-4 text-foreground">{formatDateTime(row.task.nextRunAt)}</td>
                        <td className="py-4 pr-4 text-foreground">{row.task.consecutiveFailures}</td>
                        <td className="py-4">
                          <div className="flex flex-wrap justify-end gap-2">
                            <button
                              className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground"
                              onClick={() => setActiveOffer(row.offer)}
                              type="button"
                            >
                              <PencilLine className="h-3.5 w-3.5" />
                              编辑
                            </button>
                            <button
                              className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground"
                              onClick={() => void openHistory(row)}
                              type="button"
                            >
                              <History className="h-3.5 w-3.5" />
                              历史
                            </button>
                            <DropdownMenu.Root>
                              <DropdownMenu.Trigger asChild>
                                <button
                                  className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground disabled:opacity-50"
                                  disabled={Boolean(taskActionLoading)}
                                  type="button"
                                >
                                  <MoreHorizontal className="h-3.5 w-3.5" />
                                  更多
                                </button>
                              </DropdownMenu.Trigger>
                              <DropdownMenu.Portal>
                                <DropdownMenu.Content
                                  align="end"
                                  className="z-50 min-w-[170px] rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg"
                                  sideOffset={6}
                                >
                                  <DropdownMenu.Item
                                    className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm outline-none hover:bg-muted focus:bg-muted data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50"
                                    disabled={!isRunning || taskActionLoading === `swap-now-${row.task.id}`}
                                    onSelect={() => void handleTaskAction(row.task.id, "swap-now")}
                                  >
                                    <Play className="h-4 w-4" />
                                    立即执行
                                  </DropdownMenu.Item>
                                  {isRunning ? (
                                    <DropdownMenu.Item
                                      className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-amber-700 outline-none hover:bg-amber-50 focus:bg-amber-50 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50"
                                      disabled={taskActionLoading === `disable-${row.task.id}`}
                                      onSelect={() => void handleTaskAction(row.task.id, "disable")}
                                    >
                                      <Pause className="h-4 w-4" />
                                      暂停任务
                                    </DropdownMenu.Item>
                                  ) : (
                                    <DropdownMenu.Item
                                      className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-primary outline-none hover:bg-emerald-50 focus:bg-emerald-50 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50"
                                      disabled={taskActionLoading === `enable-${row.task.id}`}
                                      onSelect={() => void handleTaskAction(row.task.id, "enable")}
                                    >
                                      <Play className="h-4 w-4" />
                                      恢复任务
                                    </DropdownMenu.Item>
                                  )}
                                </DropdownMenu.Content>
                              </DropdownMenu.Portal>
                            </DropdownMenu.Root>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td className="py-6" colSpan={8}>
                      <EmptyState
                        description={consoleData.rows.length === 0 ? "创建 Offer 后会生成任务。" : "调整筛选后重试。"}
                        icon={Link2}
                        title={consoleData.rows.length === 0 ? "当前还没有换链任务" : "当前筛选条件下没有匹配任务"}
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex flex-col gap-3 border-t border-border/60 pt-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <p>
                共 {filteredRows.length} 个任务，当前第 {currentPage} / {totalPages} 页
              </p>
              <select
                className="rounded-full border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground"
                onChange={(event) => setPageSize(Number(event.target.value))}
                value={pageSize}
              >
                <option value={10}>10 / 页</option>
                <option value={20}>20 / 页</option>
                <option value={50}>50 / 页</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button
                className="rounded-lg border border-border bg-background px-4 py-2 font-medium disabled:opacity-40"
                disabled={currentPage <= 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                type="button"
              >
                上一页
              </button>
              <button
                className="rounded-lg border border-border bg-background px-4 py-2 font-medium disabled:opacity-40"
                disabled={currentPage >= totalPages}
                onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                type="button"
              >
                下一页
              </button>
            </div>
          </div>
        </div>
      </section>

      <LinkSwapTaskDialog
        offer={activeOffer}
        onClose={() => setActiveOffer(null)}
        onSaved={() => loadAll({ refresh: true })}
        open={Boolean(activeOffer)}
      />

      <ModalFrame
        eyebrow="执行历史"
        onClose={() => {
          setHistoryOpen(false);
          setHistoryTask(null);
          setHistoryRecords([]);
        }}
        open={historyOpen}
        title={historyTask ? `${historyTask.offer?.brandName || `Offer #${historyTask.task.offerId}`} 执行记录` : "执行记录"}
      >
        {historyLoading ? (
          <p className="text-sm text-muted-foreground">正在加载执行记录...</p>
        ) : historyRecords.length ? (
          <div className="space-y-3">
            {historyRecords.map((run) => (
              <div className="rounded-xl border border-border bg-muted/40 p-4" key={run.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{formatDateTime(run.createdAt)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      应用结果: {run.applyStatus}
                      {run.applyErrorMessage ? ` · ${run.applyErrorMessage}` : ""}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "inline-flex rounded-full px-3 py-1 text-xs font-semibold",
                      run.status === "success" ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
                    )}
                  >
                    {run.status === "success" ? "成功" : "失败"}
                  </span>
                </div>
                <p className="mt-3 break-all font-mono tabular-nums text-xs text-foreground">
                  {run.resolvedSuffix || run.errorMessage || "本次执行未返回 suffix"}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            description="暂无执行记录。"
            icon={History}
            title="当前任务还没有执行历史"
          />
        )}
      </ModalFrame>
    </div>
  );
}
