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

import { EmptyState, cn } from "@autocashback/ui";
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
    <Link
      className="group flex items-center justify-between gap-4 rounded-lg border border-border bg-background px-3 py-2.5 text-sm transition hover:bg-muted/40"
      href={item.href}
    >
      <span className="flex min-w-0 items-center gap-3">
        <span
          className={cn(
            "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg",
            item.tone === "amber" ? "bg-amber-500/10 text-amber-600" : "bg-primary/10 text-primary"
          )}
        >
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0">
          <span className="block truncate font-semibold text-foreground">{item.title}</span>
          <span className="block truncate text-xs text-muted-foreground">{item.description}</span>
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

  return (
    <Link
      className="group flex items-center justify-between gap-4 rounded-lg border border-border bg-background px-3 py-2.5 transition hover:bg-muted/40"
      href={item.href}
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className={cn("flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg", severityStyles[item.severity])}>
          {item.severity === "low" ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
        </span>
        <span className="min-w-0">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-foreground">{item.title}</span>
            <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{item.severity}</span>
          </span>
          <span className="block truncate text-xs text-muted-foreground">{item.description}</span>
        </span>
      </span>
      <ArrowRight className="h-4 w-4 flex-shrink-0 text-muted-foreground transition group-hover:text-primary" />
    </Link>
  );
}

function RunCard({ run }: { run: DashboardRecentRun }) {
  const statusStyles =
    run.status === "success" ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive";

  return (
    <div className="grid gap-3 rounded-lg border border-border bg-background px-3 py-2.5 text-sm md:grid-cols-[120px,120px,1fr] md:items-center">
      <div>
        <p className="font-semibold text-foreground">Offer #{run.offerId}</p>
        <p className="mt-1 text-xs text-muted-foreground md:hidden">{formatDateTime(run.createdAt)}</p>
      </div>
      <div className="hidden text-xs text-muted-foreground md:block">{formatDateTime(run.createdAt)}</div>
      <div className="flex min-w-0 items-center justify-between gap-3">
        <p className="truncate text-xs text-muted-foreground">
          {run.resolvedSuffix || run.errorMessage || "未返回 suffix"}
        </p>
        <span className={cn("inline-flex flex-shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold", statusStyles)}>
          {run.status === "success" ? "成功" : "失败"}
        </span>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-4">
      <section className="flex items-center justify-between gap-4">
        <div>
          <div className="h-7 w-40 animate-pulse rounded-full bg-primary/10" />
          <div className="mt-3 h-4 w-64 animate-pulse rounded-full bg-muted" />
        </div>
        <div className="h-9 w-20 animate-pulse rounded-lg bg-muted" />
      </section>
      <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <div className="space-y-2" key={index}>
              <div className="h-3 w-16 animate-pulse rounded-full bg-muted" />
              <div className="h-8 w-20 animate-pulse rounded-full bg-primary/10" />
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
    <div className="space-y-4">
      <section className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">仪表盘</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {username} · {data.overview.activeAccounts} 个活跃账号 · {data.overview.activeOffers} 个启用 Offer · {data.overview.activeTasks} 个换链任务
          </p>
        </div>
        <button
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-muted/40 disabled:opacity-50"
          disabled={refreshing}
          onClick={() => void loadSummary(true)}
          type="button"
        >
          <RefreshCcw className={cn("h-4 w-4", refreshing ? "animate-spin" : "")} />
          {refreshing ? "刷新中" : "刷新"}
        </button>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm sm:col-span-2 xl:col-span-5">
          <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <div>
              <dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">活跃账号</dt>
              <dd className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{data.overview.activeAccounts}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">启用 Offer</dt>
              <dd className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{data.overview.activeOffers}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">换链任务</dt>
              <dd className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{data.overview.activeTasks}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">最近成功率</dt>
              <dd
                className={cn(
                  "mt-1 text-2xl font-semibold tracking-tight",
                  data.overview.successRate >= 80 ? "text-emerald-700" : "text-amber-700"
                )}
              >
                {data.overview.successRate}%
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">佣金预警</dt>
              <dd className="mt-1 text-2xl font-semibold tracking-tight text-amber-700">{data.overview.warningOffers}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.85fr,0.85fr,1.3fr]">
        <div className="rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-foreground">优先处理</h3>
            <span className="rounded-full bg-muted px-2.5 py-1 font-mono tabular-nums text-xs text-muted-foreground">
              {data.actions.length}
            </span>
          </div>
          <div className="mt-3 grid gap-2">
            {data.actions.length ? (
              data.actions.map((item) => <ActionCard item={item} key={item.id} />)
            ) : (
              <EmptyState icon={CheckCircle2} title="暂无待处理动作" />
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-foreground">风险提醒</h3>
            <span className="rounded-full bg-muted px-2.5 py-1 font-mono tabular-nums text-xs text-muted-foreground">
              {data.risks.length}
            </span>
          </div>
          <div className="mt-3 space-y-2">
            {data.risks.length ? (
              data.risks.map((item) => <RiskCard item={item} key={item.id} />)
            ) : (
              <EmptyState icon={CheckCircle2} title="暂无风险项" />
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">最近换链结果</h3>
              <p className="mt-1 text-xs text-muted-foreground">最近 5 条</p>
            </div>
            <Link
              className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground transition hover:bg-muted/40"
              href="/link-swap"
            >
              查看全部
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="mt-4 space-y-2">
            {data.recentRuns.length ? (
              data.recentRuns.map((run) => <RunCard key={run.id} run={run} />)
            ) : (
              <EmptyState icon={Boxes} title="还没有换链执行记录" />
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
