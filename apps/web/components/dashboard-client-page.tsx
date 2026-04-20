"use client";

import { formatDateTime } from "@/lib/format";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  CheckCircle2,
  Link2,
  RefreshCcw,
  Settings,
  Target,
  Users2,
  WalletCards
} from "lucide-react";

import { EmptyState, StatusBadge, cn } from "@autocashback/ui";
import { toast } from "sonner";

import type {
  DashboardActionItem,
  DashboardConsoleData,
  DashboardRecentRun,
  DashboardRiskItem
} from "@/lib/dashboard-summary";
import { fetchJson } from "@/lib/api-error-handler";

function resolveActionIcon(href: string) {
  if (href.startsWith("/accounts")) {
    return Users2;
  }
  if (href.startsWith("/offers")) {
    return WalletCards;
  }
  if (href.startsWith("/link-swap")) {
    return Link2;
  }
  if (href.startsWith("/google-ads")) {
    return Target;
  }
  if (href.startsWith("/settings")) {
    return Settings;
  }

  return Boxes;
}

function ActionCard({ item }: { item: DashboardActionItem }) {
  const Icon = resolveActionIcon(item.href);
  const toneClassName = item.tone === "amber" ? "border-amber-200 bg-amber-500/10 text-amber-700" : "border-primary/15 bg-primary/10 text-primary";

  return (
    <Link
      className="group flex items-center justify-between gap-4 rounded-xl border border-border bg-background/80 px-4 py-3 text-sm transition hover:bg-secondary/35"
      href={item.href}
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className={cn("flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border", toneClassName)}>
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0">
          <span className="block truncate font-semibold text-foreground">{item.title}</span>
          <span className="mt-1 block text-xs leading-5 text-muted-foreground">{item.description}</span>
        </span>
      </span>
      <ArrowRight className="h-4 w-4 flex-shrink-0 text-muted-foreground transition group-hover:text-primary" />
    </Link>
  );
}

function RiskCard({ item }: { item: DashboardRiskItem }) {
  const severityStyles = {
    high: "bg-destructive/10 text-destructive",
    medium: "bg-amber-500/10 text-amber-600",
    low: "bg-primary/10 text-primary"
  } as const;
  const severityLabel = item.severity === "high" ? "高" : item.severity === "medium" ? "中" : "低";

  return (
    <Link
      className="group flex items-center justify-between gap-4 rounded-xl border border-border bg-background/80 px-4 py-3 transition hover:bg-secondary/35"
      href={item.href}
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className={cn("flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border", severityStyles[item.severity])}>
          {item.severity === "low" ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
        </span>
        <span className="min-w-0">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-foreground">{item.title}</span>
            <span className="rounded-md border border-border bg-card px-1.5 py-0.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              {severityLabel}
            </span>
          </span>
          <span className="mt-1 block text-xs leading-5 text-muted-foreground">{item.description}</span>
        </span>
      </span>
      <ArrowRight className="h-4 w-4 flex-shrink-0 text-muted-foreground transition group-hover:text-primary" />
    </Link>
  );
}

function RunCard({ run }: { run: DashboardRecentRun }) {
  const statusVariant = run.status === "success" ? "success" : "error";

  return (
    <div className="grid gap-3 rounded-xl border border-border bg-background/75 px-4 py-3 text-sm md:grid-cols-[120px,160px,1fr,auto] md:items-center">
      <div>
        <p className="font-semibold text-foreground">Offer #{run.offerId}</p>
        <p className="mt-1 text-xs text-muted-foreground md:hidden">{formatDateTime(run.createdAt)}</p>
      </div>
      <div className="hidden text-xs text-muted-foreground md:block">{formatDateTime(run.createdAt)}</div>
      <div className="min-w-0">
        <p className="truncate text-xs leading-5 text-muted-foreground">
          {run.resolvedSuffix || run.errorMessage || "未返回 suffix"}
        </p>
      </div>
      <StatusBadge label={run.status === "success" ? "成功" : "失败"} variant={statusVariant} />
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-5">
      <section className="surface-panel px-5 py-5">
        <div className="grid gap-5 lg:grid-cols-[1.15fr,0.85fr]">
          <div>
            <div className="h-4 w-24 animate-pulse rounded-md bg-muted" />
            <div className="mt-4 h-9 w-56 animate-pulse rounded-md bg-primary/10" />
            <div className="mt-3 h-4 w-72 animate-pulse rounded-md bg-muted" />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div className="rounded-xl border border-border bg-background/70 p-4" key={index}>
                <div className="h-3 w-16 animate-pulse rounded-md bg-muted" />
                <div className="mt-3 h-7 w-20 animate-pulse rounded-md bg-primary/10" />
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="flex items-center justify-between gap-4">
        <div>
          <div className="h-7 w-40 animate-pulse rounded-md bg-primary/10" />
          <div className="mt-3 h-4 w-64 animate-pulse rounded-md bg-muted" />
        </div>
        <div className="h-9 w-20 animate-pulse rounded-lg bg-muted" />
      </section>
      <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <div className="space-y-2" key={index}>
              <div className="h-3 w-16 animate-pulse rounded-md bg-muted" />
              <div className="h-8 w-20 animate-pulse rounded-md bg-primary/10" />
            </div>
          ))}
        </div>
      </section>
      <section className="grid gap-4 xl:grid-cols-[0.85fr,0.85fr,1.3fr]">
        {Array.from({ length: 3 }).map((_, index) => (
          <div className="min-h-40 animate-pulse rounded-xl border border-border bg-card" key={index} />
        ))}
      </section>
    </div>
  );
}

function OverviewStat({
  label,
  tone = "default",
  value
}: {
  label: string;
  tone?: "default" | "warning";
  value: number | string;
}) {
  return (
    <article className="rounded-2xl border border-border bg-background/72 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
      <p className={cn("mt-3 text-3xl font-semibold tracking-[-0.03em]", tone === "warning" ? "text-amber-700" : "text-foreground")}>
        {value}
      </p>
    </article>
  );
}

export function DashboardClientPage({ username }: { username: string }) {
  const [data, setData] = useState<DashboardConsoleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  
  const loadSummary = useCallback(async (refresh = false) => {
    if (refresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError("");

    const result = await fetchJson<DashboardConsoleData>("/api/dashboard/summary", {
      cache: "no-store"
    });

    if (!result.success) {
      const nextError = result.userMessage || "仪表盘数据加载失败";
      toast.error(nextError);
      setError(nextError);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    setData(result.data);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  if (loading) {
    return <LoadingState />;
  }

  if (!data) {
    return (
      <EmptyState
        action={
          <button
            className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground"
            onClick={() => void loadSummary()}
            type="button"
          >
            重新加载
          </button>
        }
        description={error || "请重新加载仪表盘数据。"}
        icon={AlertTriangle}
        title="仪表盘数据加载失败"
      />
    );
  }

  return (
    <div className="space-y-5">
      <section className="surface-panel px-5 py-5 lg:px-6">
        <div className="grid gap-6 lg:grid-cols-[1.15fr,0.85fr]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">今日概览</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-foreground">{username}，先看状态再执行</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
              当前有 {data.overview.activeAccounts} 个活跃账号、{data.overview.activeOffers} 个启用 Offer 和 {data.overview.activeTasks} 个换链任务。
              先处理优先动作和风险，再进入各模块细查。
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <OverviewStat label="活跃账号" value={data.overview.activeAccounts} />
            <OverviewStat label="启用 Offer" value={data.overview.activeOffers} />
            <OverviewStat label="当前任务" value={data.overview.activeTasks} />
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 border-t border-border/80 pt-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <span className="info-chip">成功率 {data.overview.successRate}%</span>
            <span className="info-chip">广告费预警 {data.overview.warningOffers}</span>
            <span className="info-chip">优先动作 {data.actions.length}</span>
          </div>
          <button
            className="button-secondary"
            disabled={refreshing}
            onClick={() => void loadSummary(true)}
            type="button"
          >
            <RefreshCcw className={cn("h-4 w-4", refreshing ? "animate-spin" : "")} />
            {refreshing ? "刷新中" : "刷新数据"}
          </button>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.06fr,0.94fr]">
        <div className="rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-border/80 pb-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Priority Queue</p>
              <h3 className="mt-2 text-lg font-semibold tracking-[-0.03em] text-foreground">优先处理</h3>
            </div>
            <span className="info-chip font-mono tabular-nums">{data.actions.length}</span>
          </div>
          <div className="mt-4 grid gap-3">
            {data.actions.length ? (
              data.actions.map((item) => <ActionCard item={item} key={item.id} />)
            ) : (
              <EmptyState
                className="border-solid bg-background/70"
                description="当前没有待处理动作，说明主要模块运行平稳。"
                icon={CheckCircle2}
                title="暂无待处理动作"
              />
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-border/80 pb-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Risk Watch</p>
              <h3 className="mt-2 text-lg font-semibold tracking-[-0.03em] text-foreground">风险提醒</h3>
            </div>
            <span className="info-chip font-mono tabular-nums">{data.risks.length}</span>
          </div>
          <div className="mt-4 space-y-3">
            {data.risks.length ? (
              data.risks.map((item) => <RiskCard item={item} key={item.id} />)
            ) : (
              <EmptyState
                className="border-solid bg-background/70"
                description="当前没有需要额外跟进的风险项。"
                icon={CheckCircle2}
                title="暂无风险项"
              />
            )}
          </div>
        </div>
      </section>

      <section>
        <div className="rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-sm">
          <div className="flex flex-col gap-4 border-b border-border/80 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Recent Activity</p>
              <h3 className="mt-2 text-lg font-semibold tracking-[-0.03em] text-foreground">最近换链结果</h3>
              <p className="mt-1 text-sm text-muted-foreground">最近 5 条执行记录，便于快速判断是否需要继续排查。</p>
            </div>
            <Link className="button-secondary" href="/link-swap">
              查看全部
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="mt-4 space-y-3">
            {data.recentRuns.length ? (
              data.recentRuns.map((run) => <RunCard key={run.id} run={run} />)
            ) : (
              <EmptyState
                className="border-solid bg-background/70"
                description="还没有换链执行记录，首次执行后会在这里汇总。"
                icon={Boxes}
                title="还没有换链执行记录"
              />
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
