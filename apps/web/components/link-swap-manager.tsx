"use client";

import { useEffect, useMemo, useState } from "react";

import type { LinkSwapRunRecord, LinkSwapTaskRecord, OfferRecord } from "@autocashback/domain";

type ScriptTemplatePayload = {
  template: string;
  token: string;
};

export function LinkSwapManager() {
  const [tasks, setTasks] = useState<LinkSwapTaskRecord[]>([]);
  const [runs, setRuns] = useState<LinkSwapRunRecord[]>([]);
  const [offers, setOffers] = useState<OfferRecord[]>([]);
  const [intervals, setIntervals] = useState<Record<number, number>>({});
  const [script, setScript] = useState<ScriptTemplatePayload>({ template: "", token: "" });
  const [message, setMessage] = useState("");

  const offersMap = useMemo(
    () => new Map(offers.map((offer) => [offer.id, offer])),
    [offers]
  );

  async function loadAll() {
    const [tasksResponse, runsResponse, offersResponse, scriptResponse] = await Promise.all([
      fetch("/api/link-swap/tasks"),
      fetch("/api/link-swap/runs"),
      fetch("/api/offers"),
      fetch("/api/script/link-swap/template")
    ]);

    const taskList = (await tasksResponse.json()).tasks || [];
    setTasks(taskList);
    setRuns((await runsResponse.json()).runs || []);
    setOffers((await offersResponse.json()).offers || []);
    setScript(await scriptResponse.json());
    setIntervals(
      Object.fromEntries(
        taskList.map((task: LinkSwapTaskRecord) => [task.id, task.intervalMinutes])
      )
    );
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function saveTask(task: LinkSwapTaskRecord, enabled: boolean) {
    setMessage("");
    const response = await fetch("/api/link-swap/tasks", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        offerId: task.offerId,
        enabled,
        intervalMinutes: Number(intervals[task.id] || task.intervalMinutes)
      })
    });

    const payload = await response.json();
    setMessage(response.ok ? "任务已更新" : payload.error || "任务更新失败");
    await loadAll();
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-[1.15fr,0.85fr]">
        <div className="surface-panel p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="eyebrow">任务总览</p>
              <h3 className="mt-2 text-2xl font-semibold text-slate-900">换链接任务</h3>
            </div>
            <span className="rounded-full bg-stone-100 px-3 py-2 font-mono text-xs text-slate-600">
              {tasks.length} tasks
            </span>
          </div>

          <div className="mt-5 space-y-3">
            {tasks.length ? (
              tasks.map((task) => {
                const offer = offersMap.get(task.offerId);
                return (
                  <div className="rounded-[28px] border border-brand-line bg-stone-50 p-5" key={task.id}>
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {offer?.brandName || `Offer #${task.offerId}`}
                        </p>
                        <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">
                          {offer?.campaignLabel || "未绑定标签"} · {offer?.targetCountry || "--"}
                        </p>
                        <p className="mt-3 max-w-2xl break-all font-mono text-xs text-slate-600">
                          {offer?.latestResolvedSuffix || "尚未解析到可用 suffix"}
                        </p>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2 lg:w-[360px]">
                        <label className="text-sm font-medium text-slate-700">
                          执行间隔（分钟）
                          <input
                            className="mt-2 w-full rounded-2xl border border-brand-line bg-white px-4 py-3 font-mono"
                            min={1}
                            step={1}
                            type="number"
                            value={intervals[task.id] ?? task.intervalMinutes}
                            onChange={(event) =>
                              setIntervals((current) => ({
                                ...current,
                                [task.id]: Number(event.target.value)
                              }))
                            }
                          />
                        </label>
                        <div className="flex items-end gap-2">
                          <button
                            className="rounded-2xl border border-brand-line bg-white px-4 py-3 text-xs font-semibold text-slate-700"
                            onClick={() => saveTask(task, task.enabled)}
                            type="button"
                          >
                            保存频率
                          </button>
                          <button
                            className={`rounded-2xl px-4 py-3 text-xs font-semibold text-white ${
                              task.enabled ? "bg-slate-700" : "bg-brand-emerald"
                            }`}
                            onClick={() => saveTask(task, !task.enabled)}
                            type="button"
                          >
                            {task.enabled ? "暂停任务" : "启用任务"}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-4">
                      <p className="text-sm text-slate-600">状态：{task.status}</p>
                      <p className="text-sm text-slate-600">当前间隔：{task.intervalMinutes} 分钟</p>
                      <p className="text-sm text-slate-600">连续失败：{task.consecutiveFailures}</p>
                      <p className="text-sm text-slate-600">下次执行：{task.nextRunAt || "待调度"}</p>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="rounded-2xl bg-stone-50 px-4 py-5 text-sm text-slate-500">
                创建 Offer 后会自动生成换链接任务。
              </p>
            )}
          </div>
        </div>

        <div className="surface-panel p-6">
          <p className="eyebrow">脚本对接</p>
          <h3 className="mt-2 text-2xl font-semibold text-slate-900">MCC 执行说明</h3>
          <ol className="mt-5 space-y-3 text-sm leading-7 text-slate-600">
            <li>1. 在 Google Ads 中先为目标 Campaign 打上与 Offer 一致的 `campaignLabel`。</li>
            <li>2. 点击下方复制脚本，直接粘贴到 Google Ads Scripts / MCC 中，无需再修改脚本内容。</li>
            <li>3. 设置定时任务执行后，脚本会从 AutoCashBack 快照接口读取最新 suffix，并同步到匹配标签的 Campaign 和 sitelink。</li>
          </ol>

          <div className="mt-5 rounded-[28px] border border-brand-line bg-stone-50 p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Script Token</p>
            <p className="mt-2 font-mono text-sm text-slate-800">{script.token || "尚未生成"}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                className="rounded-full bg-brand-emerald px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
                disabled={!script.template}
                onClick={() => navigator.clipboard.writeText(script.template || "")}
                type="button"
              >
                复制可直接使用脚本
              </button>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              这份脚本已经内置当前站点地址和 Script Token。轮换 Token 后，请重新复制一次最新脚本。
            </p>
            <textarea
              className="mt-4 min-h-56 w-full rounded-2xl border border-brand-line bg-white px-4 py-3 font-mono text-xs text-slate-700"
              readOnly
              value={script.template}
            />
          </div>
        </div>
      </section>

      <section className="surface-panel p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="eyebrow">最近执行日志</p>
            <h3 className="mt-2 text-2xl font-semibold text-slate-900">调度执行记录</h3>
          </div>
          {message ? <span className="text-sm text-slate-600">{message}</span> : null}
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {runs.length ? (
            runs.map((run) => {
              const offer = offersMap.get(run.offerId);
              return (
                <div className="rounded-2xl border border-brand-line bg-stone-50 px-4 py-4" key={run.id}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">
                      {offer?.brandName || `Offer #${run.offerId}`}
                    </p>
                    <span className="text-xs uppercase tracking-wide text-slate-500">{run.status}</span>
                  </div>
                  <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">
                    {offer?.campaignLabel || "未绑定标签"}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">{run.createdAt}</p>
                  <p className="mt-3 break-all font-mono text-xs text-slate-700">
                    {run.resolvedSuffix || run.errorMessage || "无 suffix"}
                  </p>
                </div>
              );
            })
          ) : (
            <p className="rounded-2xl bg-stone-50 px-4 py-5 text-sm text-slate-500">
              还没有换链接执行日志。
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
