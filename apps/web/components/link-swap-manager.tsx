"use client";

import Link from "next/link";
import { startTransition, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckCircle2,
  Clock3,
  Copy,
  ExternalLink,
  History,
  Link2,
  Pause,
  PencilLine,
  Play,
  RefreshCcw,
  Settings2,
  ShieldAlert,
  Target
} from "lucide-react";

import type { LinkSwapRunRecord, LinkSwapTaskRecord, OfferRecord } from "@autocashback/domain";
import { cn } from "@autocashback/ui";

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

type FeedbackState =
  | {
      tone: "success" | "error";
      text: string;
    }
  | null;

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

function SummaryCard({
  label,
  value,
  note,
  tone,
  icon: Icon
}: {
  label: string;
  value: string;
  note: string;
  tone: "emerald" | "amber" | "slate";
  icon: React.ComponentType<{ className?: string }>;
}) {
  const toneStyles = {
    emerald: {
      badge: "bg-primary/10 text-primary",
      icon: "bg-primary/10 text-primary"
    },
    amber: {
      badge: "bg-amber-500/10 text-amber-600",
      icon: "bg-amber-500/10 text-amber-600"
    },
    slate: {
      badge: "bg-slate-100 text-foreground",
      icon: "bg-slate-100 text-foreground"
    }
  } as const;

  return (
    <div className="bg-card text-card-foreground rounded-xl border shadow-sm p-5">
      <div className="flex items-start justify-between gap-4">
        <span className={cn("inline-flex rounded-full px-3 py-1 text-xs font-semibold", toneStyles[tone].badge)}>
          {label}
        </span>
        <span className={cn("flex h-10 w-10 items-center justify-center rounded-lg", toneStyles[tone].icon)}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-5 font-mono text-4xl font-semibold text-foreground">{value}</p>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{note}</p>
    </div>
  );
}

function statusPill(status: LinkSwapConsoleStatus) {
  switch (status) {
    case "running":
      return "bg-primary/10 text-primary";
    case "paused":
      return "bg-slate-100 text-foreground";
    case "warning":
      return "bg-amber-500/10 text-amber-600";
    case "error":
      return "bg-destructive/10 text-destructive";
    default:
      return "bg-slate-100 text-foreground";
  }
}

function statusLabel(status: LinkSwapConsoleStatus) {
  switch (status) {
    case "running":
      return "运行中";
    case "paused":
      return "已暂停";
    case "warning":
      return "预警";
    case "error":
      return "异常";
    default:
      return status;
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
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [rotatingToken, setRotatingToken] = useState(false);
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
      setFeedback({ tone: "error", text: failedResult.userMessage });
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
    setFeedback(null);

    const result = await fetchJson<{ message?: string }>(`/api/link-swap/tasks/${taskId}/${action}`, {
      method: "POST"
    });

    if (!result.success) {
      setFeedback({ tone: "error", text: result.userMessage });
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
      setFeedback({ tone: "error", text: result.userMessage });
      setHistoryLoading(false);
      return;
    }

    setHistoryRecords(result.data.history || []);
    setHistoryLoading(false);
  }

  async function rotateToken() {
    setRotatingToken(true);
    setFeedback(null);

    const result = await fetchJson<{ message?: string }>(
      "/api/script/link-swap/rotate-token",
      { method: "POST" }
    );

    if (!result.success) {
      setFeedback({ tone: "error", text: result.userMessage });
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
      setFeedback({ tone: "error", text: "当前没有可复制的脚本模板" });
      return;
    }

    try {
      await navigator.clipboard.writeText(script.template);
      setFeedback({ tone: "success", text: "最新换链脚本已复制到剪贴板" });
    } catch {
      setFeedback({ tone: "error", text: "复制失败，请检查浏览器剪贴板权限" });
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
        <section className="bg-card text-card-foreground rounded-xl border shadow-sm p-5">
          <div className="h-8 w-48 animate-pulse rounded-full bg-primary/10" />
          <div className="mt-4 h-4 w-80 animate-pulse rounded-full bg-muted" />
        </section>
        <section className="grid gap-4 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <div className="bg-card text-card-foreground rounded-xl border shadow-sm p-5" key={index}>
              <div className="h-6 w-20 animate-pulse rounded-full bg-muted" />
              <div className="mt-5 h-10 w-24 animate-pulse rounded-full bg-muted" />
              <div className="mt-3 h-4 w-full animate-pulse rounded-full bg-muted" />
            </div>
          ))}
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="bg-card text-card-foreground rounded-xl border shadow-sm overflow-hidden p-0">
        <div className="grid gap-0 xl:grid-cols-[1.15fr,0.85fr]">
          <div className="bg-[radial-gradient(circle_at_top_left,rgba(5,150,105,0.16),transparent_48%),linear-gradient(180deg,rgba(236,253,245,0.95)_0%,rgba(255,255,255,0.98)_100%)] px-6 py-7 sm:px-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">Link Swap</p>
                <h2 className="mt-3 text-xl font-semibold tracking-tight tracking-tight tracking-tight text-foreground">换链任务控制台</h2>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">
                  统一查看任务状态、执行节奏、最近结果和脚本对接信息，先处理异常和预警，再调整具体任务。
                </p>
              </div>
              <button
                className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground transition hover:bg-muted/40 disabled:opacity-60"
                disabled={refreshing}
                onClick={() => void loadAll({ refresh: true })}
                type="button"
              >
                <RefreshCcw className={cn("h-3.5 w-3.5", refreshing ? "animate-spin" : "")} />
                {refreshing ? "刷新中" : "刷新"}
              </button>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Link
                className="group rounded-xl border border-border bg-background/90 p-4 transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md motion-reduce:transform-none"
                href="/offers"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Target className="h-5 w-5" />
                  </span>
                  <ExternalLink className="h-4 w-4 text-muted-foreground/80 transition group-hover:text-primary" />
                </div>
                <p className="mt-4 text-sm font-semibold text-foreground">查看 Offer</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">先补齐品牌、国家和 campaignLabel，再回到这里管理任务。</p>
              </Link>

              <Link
                className="group rounded-xl border border-border bg-background/90 p-4 transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md motion-reduce:transform-none"
                href="/google-ads"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Link2 className="h-5 w-5" />
                  </span>
                  <ExternalLink className="h-4 w-4 text-muted-foreground/80 transition group-hover:text-primary" />
                </div>
                <p className="mt-4 text-sm font-semibold text-foreground">Google Ads 配置</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">API 模式依赖 Customer ID、Campaign ID 和授权状态。</p>
              </Link>

              <Link
                className="group rounded-xl border border-border bg-background/90 p-4 transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md motion-reduce:transform-none"
                href="/settings"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Settings2 className="h-5 w-5" />
                  </span>
                  <ExternalLink className="h-4 w-4 text-muted-foreground/80 transition group-hover:text-primary" />
                </div>
                <p className="mt-4 text-sm font-semibold text-foreground">代理与系统设置</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">异常任务优先检查目标国家代理和脚本运行环境。</p>
              </Link>

              <button
                className="group rounded-xl border border-border bg-background/90 p-4 text-left transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md motion-reduce:transform-none"
                onClick={() => {
                  setHistoryTask(null);
                  setHistoryRecords(runs.slice(0, 20));
                  setHistoryLoading(false);
                  setHistoryOpen(true);
                }}
                type="button"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <History className="h-5 w-5" />
                  </span>
                  <ExternalLink className="h-4 w-4 text-muted-foreground/80 transition group-hover:text-primary" />
                </div>
                <p className="mt-4 text-sm font-semibold text-foreground">查看执行历史</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">从任务行打开历史弹窗，快速定位失败原因和最近 suffix。</p>
              </button>
            </div>
          </div>

          <div className="border-t border-border/70 bg-background/80 px-6 py-7 xl:border-l xl:border-t-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">脚本对接</p>
            <h3 className="mt-3 text-xl font-semibold tracking-tight text-foreground">MCC 执行说明</h3>
            <ol className="mt-5 space-y-3 text-sm leading-7 text-muted-foreground">
              <li>1. 先在对应 Offer 中确认 campaignLabel、目标国家和最终推广链接配置正确。</li>
              <li>2. Script 模式直接复制下面的模板，粘贴到 Google Ads Scripts 或 MCC 环境。</li>
              <li>3. Google Ads API 模式由平台直接更新目标 Campaign，需要先完成授权和 ID 配置。</li>
              <li>4. 每次更换 Token 后，旧脚本立即失效，请重新复制最新模板。</li>
            </ol>

            <div className="mt-5 rounded-xl border border-border bg-muted/40 p-5">
              <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Script Token</p>
              <p className="mt-2 break-all font-mono text-sm text-foreground">{script.token || "尚未生成"}</p>
              <div className="mt-4 flex flex-wrap gap-3">
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
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-5">
        <SummaryCard
          icon={Link2}
          label="总任务"
          note="当前用户下所有换链任务数量。"
          tone="slate"
          value={`${consoleData.stats.totalTasks}`}
        />
        <SummaryCard
          icon={Play}
          label="运行中"
          note="当前处于可调度状态的任务。"
          tone="emerald"
          value={`${consoleData.stats.runningTasks}`}
        />
        <SummaryCard
          icon={Pause}
          label="已暂停"
          note="已停用或暂不调度的任务。"
          tone="slate"
          value={`${consoleData.stats.pausedTasks}`}
        />
        <SummaryCard
          icon={ShieldAlert}
          label="预警/异常"
          note="存在连续失败或状态异常的任务。"
          tone="amber"
          value={`${consoleData.stats.warningTasks}`}
        />
        <SummaryCard
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

      <section className="grid gap-5 xl:grid-cols-[1.2fr,0.8fr]">
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
                          <span className={cn("inline-flex rounded-full px-3 py-1 text-xs font-semibold", statusPill(row.statusGroup))}>
                            {statusLabel(row.statusGroup)}
                          </span>
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
                            {isRunning ? (
                              <>
                                <button
                                  className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground disabled:opacity-50"
                                  disabled={taskActionLoading === `swap-now-${row.task.id}`}
                                  onClick={() => void handleTaskAction(row.task.id, "swap-now")}
                                  type="button"
                                >
                                  <Play className="h-3.5 w-3.5" />
                                  立即执行
                                </button>
                                <button
                                  className="inline-flex items-center gap-2 rounded-lg bg-slate-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                                  disabled={taskActionLoading === `disable-${row.task.id}`}
                                  onClick={() => void handleTaskAction(row.task.id, "disable")}
                                  type="button"
                                >
                                  <Pause className="h-3.5 w-3.5" />
                                  暂停
                                </button>
                              </>
                            ) : (
                              <button
                                className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                                disabled={taskActionLoading === `enable-${row.task.id}`}
                                onClick={() => void handleTaskAction(row.task.id, "enable")}
                                type="button"
                              >
                                <Play className="h-3.5 w-3.5" />
                                恢复
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td className="py-8 text-muted-foreground" colSpan={8}>
                      {consoleData.rows.length === 0
                        ? "当前还没有换链任务。创建 Offer 后会自动生成对应任务。"
                        : "当前筛选条件下没有匹配的任务。"}
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

        <div className="space-y-6">
          <div className="bg-card text-card-foreground rounded-xl border shadow-sm p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">重点提醒</p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight text-foreground">当前优先处理项</h3>
            <div className="mt-5 space-y-3">
              <div className="rounded-xl border border-border bg-muted/40 p-4">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
                    <AlertTriangle className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">先处理预警和异常</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      当前有 {consoleData.stats.warningTasks} 个任务进入预警或异常状态，优先检查代理、Offer 链接和 Google Ads 参数。
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-muted/40 p-4">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Clock3 className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">控制执行节奏</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      如果某个 Offer 近期波动明显，优先调整任务间隔和持续天数，而不是频繁手动触发。
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-muted/40 p-4">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-foreground">
                    <Target className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">API 模式单独复核</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      当前有 {consoleData.stats.apiModeTasks} 个任务使用 Google Ads API 模式，这些任务需要同时校验授权和目标 Campaign ID。
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-card text-card-foreground rounded-xl border shadow-sm p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">最近执行</p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight text-foreground">最近 6 条结果</h3>
            <div className="mt-5 space-y-3">
              {runs.length ? (
                runs.slice(0, 6).map((run) => {
                  const offer = offers.find((item) => item.id === run.offerId) || null;
                  return (
                    <div className="rounded-xl border border-border bg-muted/40 p-4" key={run.id}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground">
                            {offer?.brandName || `Offer #${run.offerId}`}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(run.createdAt)}</p>
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
                      <p className="mt-3 break-all text-xs text-muted-foreground">
                        {run.resolvedSuffix || run.errorMessage || "本次执行未返回 suffix"}
                      </p>
                    </div>
                  );
                })
              ) : (
                <p className="rounded-xl border border-dashed border-border bg-muted/40 px-4 py-5 text-sm text-muted-foreground">
                  还没有换链执行记录。
                </p>
              )}
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
        description={
          historyTask
            ? `查看 ${historyTask.offer?.brandName || `Offer #${historyTask.task.offerId}`} 的最近执行结果。`
            : "查看最近执行结果。"
        }
        text-xs font-semibold uppercase tracking-wider text-primary="执行历史"
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
                <p className="mt-3 break-all font-mono text-xs text-foreground">
                  {run.resolvedSuffix || run.errorMessage || "本次执行未返回 suffix"}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">当前任务还没有执行历史。</p>
        )}
      </ModalFrame>
    </div>
  );
}
