import { getDashboardSummary, listLinkSwapRuns } from "@autocashback/db";

import { requireUser } from "@/lib/auth";

function KpiCard({
  label,
  value,
  note
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="surface-panel p-6">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-4 font-mono text-4xl font-semibold text-slate-900">{value}</p>
      <p className="mt-3 text-sm leading-6 text-slate-600">{note}</p>
    </div>
  );
}

export default async function DashboardPage() {
  const user = await requireUser();
  const summary = await getDashboardSummary(user.id);
  const runs = await listLinkSwapRuns(user.id);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-4">
        <KpiCard label="启用中 Offer" value={`${summary.activeOffers}`} note="已经进入运营或告警状态的 Offer 数量" />
        <KpiCard label="启用中换链接任务" value={`${summary.activeTasks}`} note="由平台调度器持续解析终链的任务数" />
        <KpiCard label="最近成功率" value={`${summary.successRate}%`} note="最近换链接执行日志中的成功比例" />
        <KpiCard label="阈值预警 Offer" value={`${summary.warningOffers}`} note="手工录入佣金已达到上限，需要人工确认停投" />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr,0.95fr]">
        <div className="surface-panel p-6">
          <p className="eyebrow">运营建议</p>
          <h3 className="mt-3 text-2xl font-semibold text-slate-900">本周优先处理 3 件事</h3>
          <ul className="mt-5 space-y-3 text-sm leading-7 text-slate-600">
            <li>1. 给所有正在投放的 Offer 补齐 `campaignLabel`，避免脚本误伤。</li>
            <li>2. 为代理配置至少 1 个可用 URL，确保终链解析链路能跑通。</li>
            <li>3. 对已达到佣金阈值的 Offer 手动确认是否停投或降低预算。</li>
          </ul>
        </div>

        <div className="surface-panel p-6">
          <p className="eyebrow">最近解析记录</p>
          <div className="mt-5 space-y-3">
            {runs.length ? (
              runs.slice(0, 5).map((run) => (
                <div className="rounded-2xl border border-brand-line bg-stone-50 px-4 py-4" key={run.id}>
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm font-medium text-slate-900">Offer #{run.offerId}</p>
                    <span className="text-xs uppercase tracking-wide text-slate-500">{run.status}</span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">{run.createdAt}</p>
                  <p className="mt-2 break-all text-sm text-slate-700">{run.resolvedSuffix || run.errorMessage || "尚未产生 suffix"}</p>
                </div>
              ))
            ) : (
              <p className="rounded-2xl bg-stone-50 px-4 py-5 text-sm text-slate-500">
                还没有换链接执行记录，创建 Offer 后系统会自动为其生成任务。
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
