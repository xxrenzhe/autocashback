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

import { CardSkeleton, EmptyState, PageHeader, ShortcutCard, StatCard, StatSkeleton, cn } from "@autocashback/ui";
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

  return (
    <Link href={item.href}>
      <ShortcutCard
        description={item.description}
        icon={Icon}
        title={item.title}
        tone={item.tone}
        trailing={<ArrowRight className="h-4 w-4 text-muted-foreground/80 transition group-hover:text-primary" />}
      />
    </Link>
  );
}

function RiskCard({ item }: { item: DashboardRiskItem }) {
  const severityStyles = {
    high: "bg-destructive/10 text-destructive",
    medium: "bg-amber-500/10 text-amber-600",
    low: "bg-primary/10 text-primary"
  } as const;

  return (
    <Link className="rounded-xl border border-border bg-background p-4 transition hover:bg-muted/40" href={item.href}>
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg",
            severityStyles[item.severity]
          )}
        >
          {item.severity === "low" ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-foreground">{item.title}</p>
            <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground/80">{item.severity}</span>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.description}</p>
        </div>
      </div>
    </Link>
  );
}

function RunCard({ run }: { run: DashboardRecentRun }) {
  const statusStyles =
    run.status === "success" ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive";

  return (
    <div className="rounded-xl border border-border bg-muted/40 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-background text-primary shadow-sm">
              <Boxes className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">Offer #{run.offerId}</p>
              <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(run.createdAt)}</p>
            </div>
          </div>
          <p className="mt-4 break-all text-sm leading-6 text-muted-foreground">
            {run.resolvedSuffix || run.errorMessage || "本次执行未返回 suffix。"}
          </p>
        </div>
        <span className={cn("inline-flex rounded-full px-3 py-1 text-xs font-semibold", statusStyles)}>
          {run.status === "success" ? "成功" : "失败"}
        </span>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-6">
      <section className="bg-card text-card-foreground rounded-xl border shadow-sm p-5">
        <div className="h-8 w-48 animate-pulse rounded-full bg-primary/10" />
        <div className="mt-4 h-4 w-80 animate-pulse rounded-full bg-muted" />
      </section>
      <section className="grid gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <StatSkeleton key={index} />
        ))}
      </section>
      <section className="grid gap-5 xl:grid-cols-[0.95fr,1.05fr]">
        <div className="space-y-6">
          <CardSkeleton />
          <CardSkeleton />
        </div>
        <CardSkeleton className="min-h-64" />
      </section>
    </div>
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
    <div className="space-y-6">
      <PageHeader
        actions={
          <button
            className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground transition hover:bg-muted/40 disabled:opacity-50"
            disabled={refreshing}
            onClick={() => void loadSummary(true)}
            type="button"
          >
            <RefreshCcw className={cn("h-3.5 w-3.5", refreshing ? "animate-spin" : "")} />
            {refreshing ? "刷新中" : "刷新"}
          </button>
        }
        description="保留总览、风险和最近执行，减少首屏解释层级。"
        title={`${username}，今日概览`}
      />

      <section className="grid gap-4 xl:grid-cols-4">
        <StatCard
          label="启用中 Offer"
          note="已经进入运营或告警状态的 Offer 数量。"
          tone="emerald"
          value={`${data.overview.activeOffers}`}
        />
        <StatCard
          label="启用中换链任务"
          note="由调度器持续执行的自动换链任务数量。"
          tone="slate"
          value={`${data.overview.activeTasks}`}
        />
        <StatCard
          label="最近成功率"
          note="最近换链执行记录里的成功比例。"
          tone={data.overview.successRate >= 80 ? "emerald" : "amber"}
          value={`${data.overview.successRate}%`}
        />
        <StatCard
          label="佣金预警"
          note="已达到或接近佣金阈值，需要人工复核的 Offer 数量。"
          tone="amber"
          value={`${data.overview.warningOffers}`}
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.95fr,1.05fr]">
        <div className="space-y-6">
          <div className="bg-card text-card-foreground rounded-xl border shadow-sm p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">行动</p>
            <h3 className="mt-3 text-xl font-semibold tracking-tight text-foreground">当前优先处理项</h3>
            <div className="mt-5 grid gap-3">
              {data.actions.map((item) => (
                <ActionCard item={item} key={item.id} />
              ))}
            </div>
          </div>

          <div className="bg-card text-card-foreground rounded-xl border shadow-sm p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">风险</p>
            <h3 className="mt-3 text-xl font-semibold tracking-tight text-foreground">需要留意的问题</h3>
            <div className="mt-5 space-y-3">
              {data.risks.map((item) => (
                <RiskCard item={item} key={item.id} />
              ))}
            </div>
          </div>
        </div>

        <div className="bg-card text-card-foreground rounded-xl border shadow-sm p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">执行记录</p>
              <h3 className="mt-3 text-xl font-semibold tracking-tight text-foreground">最近 5 条换链结果</h3>
            </div>
            <Link
              className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground transition hover:bg-muted/40"
              href="/link-swap"
            >
              查看全部
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="mt-5 space-y-3">
            {data.recentRuns.length ? (
              data.recentRuns.map((run) => <RunCard key={run.id} run={run} />)
            ) : (
              <EmptyState
                description="创建 Offer 并启用换链任务后，这里会按时间顺序显示最新结果。"
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
