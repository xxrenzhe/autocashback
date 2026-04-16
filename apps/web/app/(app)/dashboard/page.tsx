import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  Clock3,
  Link2,
  Settings,
  Target,
  Users2,
  WalletCards
} from "lucide-react";

import { getDashboardSummary, listLinkSwapRuns } from "@autocashback/db";
import { cn } from "@autocashback/ui";

import { requireUser } from "@/lib/auth";

function formatDateTime(value: string | null) {
  if (!value) {
    return "待生成";
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toLocaleString("zh-CN") : value;
}

function KpiCard({
  label,
  value,
  note,
  tone
}: {
  label: string;
  value: string;
  note: string;
  tone: "emerald" | "slate" | "amber";
}) {
  const toneStyles = {
    emerald: {
      badge: "bg-brand-mist text-brand-emerald",
      value: "text-brand-emerald"
    },
    slate: {
      badge: "bg-slate-100 text-slate-700",
      value: "text-slate-900"
    },
    amber: {
      badge: "bg-amber-50 text-amber-700",
      value: "text-amber-700"
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

function QuickAction({
  href,
  icon: Icon,
  title,
  note
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  note: string;
}) {
  return (
    <Link
      className="group rounded-[24px] border border-brand-line bg-white/90 px-4 py-4 transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-editorial motion-reduce:transform-none"
      href={href}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-mist text-brand-emerald">
          <Icon className="h-5 w-5" />
        </span>
        <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:text-brand-emerald" />
      </div>
      <p className="mt-4 text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-500">{note}</p>
    </Link>
  );
}

export default async function DashboardPage() {
  const user = await requireUser();
  const summary = await getDashboardSummary(user.id);
  const runs = await listLinkSwapRuns(user.id);

  const latestRun = runs[0] ?? null;
  const recentFailedRuns = runs.filter((run) => run.status === "failed").length;
  const recentSuccessfulRuns = runs.filter((run) => run.status === "success").length;

  const focusItems = [
    {
      title: "补齐投放标签",
      note: "给所有正在投放的 Offer 补齐 `campaignLabel`，避免脚本误伤。"
    },
    {
      title: "检查代理可用性",
      note: "为代理配置至少 1 个可用 URL，确保终链解析链路能跑通。"
    },
    {
      title: "处理佣金预警",
      note: "对已达到佣金阈值的 Offer 手动确认是否停投或降低预算。"
    }
  ];

  const riskItems = [
    summary.warningOffers > 0
      ? `当前有 ${summary.warningOffers} 个 Offer 已触发佣金阈值预警，建议优先复核预算。`
      : "当前没有 Offer 触发佣金阈值预警，预算侧相对稳定。",
    recentFailedRuns > 0
      ? `最近解析记录中有 ${recentFailedRuns} 次失败，建议排查代理、终链跳转或 Google Ads 配置。`
      : "最近解析记录未出现失败，终链链路稳定。",
    summary.activeTasks === 0
      ? "当前没有启用中的换链任务，新增 Offer 后记得及时开启自动解析。"
      : `当前共有 ${summary.activeTasks} 个启用中的换链任务在持续运行。`
  ];

  return (
    <div className="space-y-6">
      <section className="surface-panel overflow-hidden p-0">
        <div className="grid gap-0 xl:grid-cols-[1.25fr,0.95fr]">
          <div className="bg-[radial-gradient(circle_at_top_left,rgba(5,150,105,0.16),transparent_48%),linear-gradient(180deg,rgba(236,253,245,0.95)_0%,rgba(255,255,255,0.98)_100%)] px-6 py-7 sm:px-8">
            <p className="eyebrow">Dashboard</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
              {user.username}，今天先盯住返利链路
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600">
              在这里先查看关键指标、待处理事项和风险提醒，再进入账号、Offer 或换链接任务继续处理。
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <QuickAction href="/accounts" icon={Users2} note="维护返利平台账号与邮箱信息。" title="进入账号管理" />
              <QuickAction href="/offers" icon={WalletCards} note="补齐投放参数并处理佣金阈值。" title="进入 Offer 管理" />
              <QuickAction href="/link-swap" icon={Link2} note="查看换链状态、最近执行与失败原因。" title="进入换链接管理" />
              <QuickAction href="/settings" icon={Settings} note="调整代理配置、密码和系统参数。" title="进入系统设置" />
            </div>
          </div>

          <div className="border-t border-brand-line/70 bg-white/84 px-6 py-7 xl:border-l xl:border-t-0">
            <p className="eyebrow">运营脉搏</p>
            <div className="mt-5 grid gap-3">
              <div className="rounded-[24px] border border-brand-line bg-stone-50 px-4 py-4">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm font-semibold text-slate-900">最近解析时间</p>
                  <Clock3 className="h-4 w-4 text-slate-400" />
                </div>
                <p className="mt-2 text-sm text-slate-600">{formatDateTime(latestRun?.createdAt ?? null)}</p>
              </div>

              <div className="rounded-[24px] border border-brand-line bg-stone-50 px-4 py-4">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm font-semibold text-slate-900">最近解析表现</p>
                  <Target className="h-4 w-4 text-slate-400" />
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  成功 {recentSuccessfulRuns} 次，失败 {recentFailedRuns} 次。
                </p>
              </div>

              <div className="rounded-[24px] border border-brand-line bg-stone-50 px-4 py-4">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm font-semibold text-slate-900">当前最需要关注</p>
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                </div>
                <p className="mt-2 text-sm text-slate-600">{riskItems[0]}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-4">
        <KpiCard label="启用中 Offer" note="已经进入运营或告警状态的 Offer 数量。" tone="emerald" value={`${summary.activeOffers}`} />
        <KpiCard label="启用中换链接任务" note="由平台调度器持续解析终链的任务数。" tone="slate" value={`${summary.activeTasks}`} />
        <KpiCard label="最近成功率" note="最近换链接执行日志中的成功比例。" tone="emerald" value={`${summary.successRate}%`} />
        <KpiCard label="阈值预警 Offer" note="手工录入佣金已达到上限，需要人工确认停投。" tone="amber" value={`${summary.warningOffers}`} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr,1.05fr]">
        <div className="space-y-6">
          <div className="surface-panel p-6">
            <p className="eyebrow">本周行动</p>
            <h3 className="mt-3 text-2xl font-semibold text-slate-900">优先处理 3 件事</h3>
            <div className="mt-5 space-y-4">
              {focusItems.map((item, index) => (
                <div className="rounded-[24px] border border-brand-line bg-stone-50 px-4 py-4" key={item.title}>
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand-mist text-sm font-semibold text-brand-emerald">
                      {index + 1}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{item.note}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="surface-panel p-6">
            <p className="eyebrow">风险与提醒</p>
            <div className="mt-5 space-y-3">
              {riskItems.map((item) => (
                <div className="rounded-[24px] border border-brand-line bg-white px-4 py-4" key={item}>
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
                      <AlertTriangle className="h-4 w-4" />
                    </span>
                    <p className="text-sm leading-6 text-slate-600">{item}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="surface-panel p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="eyebrow">最近解析记录</p>
              <h3 className="mt-3 text-2xl font-semibold text-slate-900">最近 5 条终链结果</h3>
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
            {runs.length ? (
              runs.slice(0, 5).map((run) => {
                const runStatusStyles =
                  run.status === "success"
                    ? "bg-brand-mist text-brand-emerald"
                    : "bg-red-50 text-red-700";

                return (
                  <div className="rounded-[24px] border border-brand-line bg-stone-50 px-4 py-4" key={run.id}>
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
                          {run.resolvedSuffix || run.errorMessage || "尚未产生 suffix"}
                        </p>
                      </div>
                      <span className={cn("inline-flex rounded-full px-3 py-1 text-xs font-semibold", runStatusStyles)}>
                        {run.status === "success" ? "成功" : "失败"}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-[24px] border border-dashed border-brand-line bg-stone-50 px-5 py-6">
                <p className="text-sm text-slate-600">
                  还没有换链接执行记录。创建 Offer 并启用换链接任务后，这里会按时间顺序显示最新结果。
                </p>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
