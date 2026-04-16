"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  CheckCircle2,
  Clock3,
  Link2,
  RefreshCcw,
  Settings,
  Target,
  Users2,
  WalletCards
} from "lucide-react";

import { cn } from "@autocashback/ui";

import type {
  DashboardActionItem,
  DashboardConsoleData,
  DashboardRecentRun,
  DashboardRiskItem
} from "@/lib/dashboard-summary";
import { fetchJson } from "@/lib/api-error-handler";

const coreEntryLinks = [
  {
    id: "accounts",
    title: "账号管理",
    description: "维护返利平台账号、邮箱和收款信息。",
    href: "/accounts"
  },
  {
    id: "offers",
    title: "Offer 管理",
    description: "补齐推广链接、国家、品牌和佣金上限。",
    href: "/offers"
  },
  {
    id: "link-swap",
    title: "换链管理",
    description: "查看执行状态、失败记录和手动触发结果。",
    href: "/link-swap"
  },
  {
    id: "google-ads",
    title: "Google Ads",
    description: "维护授权状态、客户号和广告侧联动配置。",
    href: "/google-ads"
  }
] as const;

function formatDateTime(value: string | null) {
  if (!value) {
    return "暂无记录";
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toLocaleString("zh-CN") : value;
}

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

function OverviewCard({
  label,
  value,
  note,
  tone = "slate"
}: {
  label: string;
  value: string;
  note: string;
  tone?: "emerald" | "amber" | "slate";
}) {
  const toneStyles = {
    emerald: {
      badge: "bg-brand-mist text-brand-emerald",
      value: "text-brand-emerald"
    },
    amber: {
      badge: "bg-amber-50 text-amber-700",
      value: "text-amber-700"
    },
    slate: {
      badge: "bg-slate-100 text-slate-700",
      value: "text-slate-900"
    }
  } as const;

  return (
    <div className="surface-panel p-6">
      <span className={cn("inline-flex rounded-full px-3 py-1 text-xs font-semibold", toneStyles[tone].badge)}>
        {label}
      </span>
      <p className={cn("mt-5 font-mono text-4xl font-semibold", toneStyles[tone].value)}>{value}</p>
      <p className="mt-3 text-sm leading-6 text-slate-600">{note}</p>
    </div>
  );
}

function ActionCard({ item }: { item: DashboardActionItem }) {
  const Icon = resolveActionIcon(item.href);
  const toneStyles = {
    emerald: "bg-brand-mist text-brand-emerald",
    amber: "bg-amber-50 text-amber-700",
    slate: "bg-slate-100 text-slate-700"
  } as const;

  return (
    <Link
      className="group rounded-[24px] border border-brand-line bg-white/90 px-4 py-4 transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-editorial motion-reduce:transform-none"
      href={item.href}
    >
      <div className="flex items-center justify-between gap-3">
        <span className={cn("flex h-11 w-11 items-center justify-center rounded-2xl", toneStyles[item.tone])}>
          <Icon className="h-5 w-5" />
        </span>
        <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:text-brand-emerald" />
      </div>
      <p className="mt-4 text-sm font-semibold text-slate-900">{item.title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-500">{item.description}</p>
    </Link>
  );
}

function RiskCard({ item }: { item: DashboardRiskItem }) {
  const severityStyles = {
    high: "bg-red-50 text-red-700",
    medium: "bg-amber-50 text-amber-700",
    low: "bg-brand-mist text-brand-emerald"
  } as const;

  return (
    <Link className="rounded-[24px] border border-brand-line bg-white px-4 py-4 transition hover:bg-stone-50" href={item.href}>
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl",
            severityStyles[item.severity]
          )}
        >
          {item.severity === "low" ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-slate-900">{item.title}</p>
            <span className="text-xs uppercase tracking-[0.2em] text-slate-400">{item.severity}</span>
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
        </div>
      </div>
    </Link>
  );
}

function RunCard({ run }: { run: DashboardRecentRun }) {
  const statusStyles =
    run.status === "success" ? "bg-brand-mist text-brand-emerald" : "bg-red-50 text-red-700";

  return (
    <div className="rounded-[24px] border border-brand-line bg-stone-50 px-4 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-brand-emerald shadow-sm">
              <Boxes className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-900">Offer #{run.offerId}</p>
              <p className="mt-1 text-xs text-slate-500">{formatDateTime(run.createdAt)}</p>
            </div>
          </div>
          <p className="mt-4 break-all text-sm leading-6 text-slate-600">
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
      <section className="surface-panel p-6">
        <div className="h-8 w-48 animate-pulse rounded-full bg-brand-mist" />
        <div className="mt-4 h-4 w-80 animate-pulse rounded-full bg-stone-100" />
      </section>
      <section className="grid gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div className="surface-panel p-6" key={index}>
            <div className="h-6 w-20 animate-pulse rounded-full bg-stone-100" />
            <div className="mt-5 h-10 w-24 animate-pulse rounded-full bg-stone-100" />
            <div className="mt-3 h-4 w-full animate-pulse rounded-full bg-stone-100" />
          </div>
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

  async function loadSummary(refresh = false) {
    if (refresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    const result = await fetchJson<DashboardConsoleData>("/api/dashboard/summary", {
      cache: "no-store"
    });

    if (!result.success) {
      setError(result.userMessage);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    setData(result.data);
    setError("");
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => {
    void loadSummary();
  }, []);

  if (loading) {
    return <LoadingState />;
  }

  if (!data) {
    return (
      <section className="surface-panel p-6">
        <p className="text-sm text-red-700">{error || "仪表盘数据加载失败"}</p>
        <button
          className="mt-4 rounded-2xl border border-brand-line bg-white px-4 py-2 text-sm font-semibold text-slate-700"
          onClick={() => void loadSummary()}
          type="button"
        >
          重新加载
        </button>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="surface-panel overflow-hidden p-0">
        <div className="grid gap-0 xl:grid-cols-[1.2fr,0.9fr]">
          <div className="bg-[radial-gradient(circle_at_top_left,rgba(5,150,105,0.16),transparent_48%),linear-gradient(180deg,rgba(236,253,245,0.95)_0%,rgba(255,255,255,0.98)_100%)] px-6 py-7 sm:px-8">
            <p className="eyebrow">Dashboard</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{username}，先看今天的总览</h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600">
              先确认 Offer、换链和账号的核心状态，再进入对应模块处理动作和风险。
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {coreEntryLinks.map((item) => (
                <ActionCard item={{ ...item, tone: "emerald" }} key={item.id} />
              ))}
            </div>
          </div>

          <div className="border-t border-brand-line/70 bg-white/84 px-6 py-7 xl:border-l xl:border-t-0">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="eyebrow">总览</p>
                <p className="mt-3 text-sm font-semibold text-slate-900">运行脉搏</p>
              </div>
              <button
                className="inline-flex items-center gap-2 rounded-full border border-brand-line bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-stone-50 disabled:opacity-50"
                disabled={refreshing}
                onClick={() => void loadSummary(true)}
                type="button"
              >
                <RefreshCcw className={cn("h-3.5 w-3.5", refreshing ? "animate-spin" : "")} />
                {refreshing ? "刷新中" : "刷新"}
              </button>
            </div>

            <div className="mt-5 grid gap-3">
              <div className="rounded-[24px] border border-brand-line bg-stone-50 px-4 py-4">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm font-semibold text-slate-900">最近解析时间</p>
                  <Clock3 className="h-4 w-4 text-slate-400" />
                </div>
                <p className="mt-2 text-sm text-slate-600">{formatDateTime(data.overview.latestRunAt)}</p>
              </div>

              <div className="rounded-[24px] border border-brand-line bg-stone-50 px-4 py-4">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm font-semibold text-slate-900">最近解析表现</p>
                  <Target className="h-4 w-4 text-slate-400" />
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  成功 {data.overview.recentSuccessfulRuns} 次，失败 {data.overview.recentFailedRuns} 次。
                </p>
              </div>

              <div className="rounded-[24px] border border-brand-line bg-stone-50 px-4 py-4">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm font-semibold text-slate-900">当前风险焦点</p>
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                </div>
                <p className="mt-2 text-sm text-slate-600">{data.risks[0]?.description || "当前没有高优先级风险。"}</p>
              </div>
            </div>

            {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-4">
        <OverviewCard
          label="启用中 Offer"
          note="已经进入运营或告警状态的 Offer 数量。"
          tone="emerald"
          value={`${data.overview.activeOffers}`}
        />
        <OverviewCard
          label="启用中换链任务"
          note="由调度器持续执行的自动换链任务数量。"
          tone="slate"
          value={`${data.overview.activeTasks}`}
        />
        <OverviewCard
          label="最近成功率"
          note="最近换链执行记录里的成功比例。"
          tone="emerald"
          value={`${data.overview.successRate}%`}
        />
        <OverviewCard
          label="佣金预警"
          note="已达到或接近佣金阈值，需要人工复核的 Offer 数量。"
          tone="amber"
          value={`${data.overview.warningOffers}`}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr,1.05fr]">
        <div className="space-y-6">
          <div className="surface-panel p-6">
            <p className="eyebrow">行动</p>
            <h3 className="mt-3 text-2xl font-semibold text-slate-900">当前优先处理项</h3>
            <div className="mt-5 grid gap-3">
              {data.actions.map((item) => (
                <ActionCard item={item} key={item.id} />
              ))}
            </div>
          </div>

          <div className="surface-panel p-6">
            <p className="eyebrow">风险</p>
            <h3 className="mt-3 text-2xl font-semibold text-slate-900">需要留意的问题</h3>
            <div className="mt-5 space-y-3">
              {data.risks.map((item) => (
                <RiskCard item={item} key={item.id} />
              ))}
            </div>
          </div>
        </div>

        <div className="surface-panel p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="eyebrow">执行记录</p>
              <h3 className="mt-3 text-2xl font-semibold text-slate-900">最近 5 条换链结果</h3>
            </div>
            <Link
              className="inline-flex items-center gap-2 rounded-full border border-brand-line bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-stone-50"
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
              <div className="rounded-[24px] border border-dashed border-brand-line bg-stone-50 px-5 py-6">
                <p className="text-sm text-slate-600">
                  还没有换链执行记录。创建 Offer 并启用换链任务后，这里会按时间顺序显示最新结果。
                </p>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
