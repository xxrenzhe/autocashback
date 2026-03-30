"use client";

import { useEffect, useState } from "react";

import type { LinkSwapRunRecord, LinkSwapTaskRecord, OfferRecord } from "@autocashback/domain";

export function LinkSwapManager() {
  const [tasks, setTasks] = useState<LinkSwapTaskRecord[]>([]);
  const [runs, setRuns] = useState<LinkSwapRunRecord[]>([]);
  const [offers, setOffers] = useState<OfferRecord[]>([]);

  async function loadAll() {
    const [tasksResponse, runsResponse, offersResponse] = await Promise.all([
      fetch("/api/link-swap/tasks"),
      fetch("/api/link-swap/runs"),
      fetch("/api/offers")
    ]);
    setTasks((await tasksResponse.json()).tasks || []);
    setRuns((await runsResponse.json()).runs || []);
    setOffers((await offersResponse.json()).offers || []);
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function toggleTask(task: LinkSwapTaskRecord) {
    await fetch("/api/link-swap/tasks", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        offerId: task.offerId,
        enabled: !task.enabled,
        intervalMinutes: task.intervalMinutes
      })
    });
    await loadAll();
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr,0.9fr]">
      <div className="surface-panel p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="eyebrow">任务总览</p>
            <h3 className="mt-2 text-2xl font-semibold text-slate-900">换链接任务</h3>
          </div>
          <button
            className="rounded-2xl bg-brand-emerald px-4 py-2 text-sm font-semibold text-white"
            onClick={() => navigator.clipboard.writeText("进入系统设置复制默认脚本模板")}
            type="button"
          >
            复制脚本说明
          </button>
        </div>

        <div className="mt-5 space-y-3">
          {tasks.length ? (
            tasks.map((task) => {
              const offer = offers.find((item) => item.id === task.offerId);
              return (
                <div className="rounded-[28px] border border-brand-line bg-stone-50 p-5" key={task.id}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{offer?.brandName || `Offer #${task.offerId}`}</p>
                      <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">{offer?.campaignLabel}</p>
                    </div>
                    <button
                      className="rounded-full border border-brand-line bg-white px-4 py-2 text-xs font-semibold text-slate-700"
                      onClick={() => toggleTask(task)}
                      type="button"
                    >
                      {task.enabled ? "暂停任务" : "启用任务"}
                    </button>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <p className="text-sm text-slate-600">状态：{task.status}</p>
                    <p className="text-sm text-slate-600">间隔：{task.intervalMinutes} 分钟</p>
                    <p className="text-sm text-slate-600">连续失败：{task.consecutiveFailures}</p>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="rounded-2xl bg-stone-50 px-4 py-5 text-sm text-slate-500">创建 Offer 后会自动生成换链接任务。</p>
          )}
        </div>
      </div>

      <div className="surface-panel p-6">
        <p className="eyebrow">最近执行日志</p>
        <div className="mt-5 space-y-3">
          {runs.length ? (
            runs.map((run) => (
              <div className="rounded-2xl border border-brand-line bg-stone-50 px-4 py-4" key={run.id}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">Offer #{run.offerId}</p>
                  <span className="text-xs uppercase tracking-wide text-slate-500">{run.status}</span>
                </div>
                <p className="mt-2 text-xs text-slate-500">{run.createdAt}</p>
                <p className="mt-2 break-all text-sm text-slate-600">{run.resolvedSuffix || run.errorMessage || "无 suffix"}</p>
              </div>
            ))
          ) : (
            <p className="rounded-2xl bg-stone-50 px-4 py-5 text-sm text-slate-500">还没有换链接执行日志。</p>
          )}
        </div>
      </div>
    </div>
  );
}
