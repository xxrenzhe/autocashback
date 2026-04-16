"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import {
  LINK_SWAP_ALLOWED_INTERVALS_MINUTES,
  LINK_SWAP_INTERVAL_OPTIONS,
  type LinkSwapRunRecord,
  type LinkSwapTaskRecord,
  type OfferRecord
} from "@autocashback/domain";

import { LinkSwapTaskDialog } from "@/components/link-swap-task-dialog";

type ScriptTemplatePayload = {
  template: string;
  token: string;
};

function getIntervalOptions(currentValue: number) {
  if (LINK_SWAP_INTERVAL_OPTIONS.some((option) => option.value === currentValue)) {
    return LINK_SWAP_INTERVAL_OPTIONS;
  }

  if (LINK_SWAP_ALLOWED_INTERVALS_MINUTES.includes(currentValue)) {
    return [
      ...LINK_SWAP_INTERVAL_OPTIONS,
      {
        value: currentValue,
        label: `${currentValue} 分钟（旧值）`
      }
    ];
  }

  return LINK_SWAP_INTERVAL_OPTIONS;
}

export function LinkSwapManager() {
  const searchParams = useSearchParams();
  const selectedOfferId = Number(searchParams.get("offerId") || 0);

  const [tasks, setTasks] = useState<LinkSwapTaskRecord[]>([]);
  const [runs, setRuns] = useState<LinkSwapRunRecord[]>([]);
  const [offers, setOffers] = useState<OfferRecord[]>([]);
  const [intervals, setIntervals] = useState<Record<number, number>>({});
  const [script, setScript] = useState<ScriptTemplatePayload>({ template: "", token: "" });
  const [message, setMessage] = useState("");
  const [rotatingToken, setRotatingToken] = useState(false);
  const [activeOffer, setActiveOffer] = useState<OfferRecord | null>(null);
  const [taskActionLoading, setTaskActionLoading] = useState<string | null>(null);

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

    const tasksPayload = await tasksResponse.json();
    const taskList = tasksPayload?.tasks || tasksPayload?.data?.tasks || [];
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

  useEffect(() => {
    if (!selectedOfferId || !offers.length) {
      return;
    }

    const matchedOffer = offers.find((offer) => offer.id === selectedOfferId) || null;
    if (matchedOffer) {
      setActiveOffer(matchedOffer);
    }
  }, [offers, selectedOfferId]);

  async function saveTask(task: LinkSwapTaskRecord, enabled: boolean) {
    setTaskActionLoading(`save-${task.id}`);
    setMessage("");
    const intervalMinutes = Number(intervals[task.id] || task.intervalMinutes);
    if (!LINK_SWAP_ALLOWED_INTERVALS_MINUTES.includes(intervalMinutes)) {
      setMessage(
        `换链接间隔必须是以下值之一：${LINK_SWAP_ALLOWED_INTERVALS_MINUTES.join(", ")} 分钟`
      );
      setTaskActionLoading(null);
      return;
    }

    try {
      const response = await fetch("/api/link-swap/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offerId: task.offerId,
          enabled,
          intervalMinutes,
          durationDays: task.durationDays,
          mode: task.mode,
          googleCustomerId: task.googleCustomerId,
          googleCampaignId: task.googleCampaignId
        })
      });

      const payload = await response.json();
      setMessage(response.ok ? payload.message || "任务已更新" : payload.error || "任务更新失败");
      await loadAll();
    } finally {
      setTaskActionLoading(null);
    }
  }

  async function enableTask(task: LinkSwapTaskRecord) {
    setTaskActionLoading(`enable-${task.id}`);
    setMessage("");

    try {
      const response = await fetch(`/api/link-swap/tasks/${task.id}/enable`, {
        method: "POST"
      });
      const payload = await response.json().catch(() => ({}));
      setMessage(response.ok ? payload.message || "任务已启用" : payload.error || "启用任务失败");
      await loadAll();
    } finally {
      setTaskActionLoading(null);
    }
  }

  function getTaskStatusLabel(task: LinkSwapTaskRecord) {
    if (!task.enabled || task.status === "idle") {
      return "已停用";
    }

    switch (task.status) {
      case "ready":
        return "运行中";
      case "warning":
        return "预警";
      case "error":
        return "异常";
      default:
        return task.status;
    }
  }

  async function rotateToken() {
    setRotatingToken(true);
    setMessage("");

    try {
      const response = await fetch("/api/script/link-swap/rotate-token", {
        method: "POST"
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage(payload.error || "Token 更换失败");
        return;
      }

      await loadAll();
      setMessage("Token 已更换，旧脚本立即失效，请复制最新换链接脚本。");
    } catch {
      setMessage("Token 更换失败");
    } finally {
      setRotatingToken(false);
    }
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
                const isSelected = offer?.id === selectedOfferId;

                return (
                  <div
                    className={`rounded-[28px] border p-5 ${
                      isSelected
                        ? "border-brand-emerald bg-brand-mist/40"
                        : "border-brand-line bg-stone-50"
                    }`}
                    key={task.id}
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {offer?.brandName || `Offer #${task.offerId}`}
                        </p>
                        <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">
                          {offer?.campaignLabel || "未绑定标签"} · {offer?.targetCountry || "--"} · {task.mode}
                        </p>
                        <p className="mt-3 max-w-2xl break-all font-mono text-xs text-slate-600">
                          {offer?.latestResolvedSuffix || "尚未解析到可用 suffix"}
                        </p>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2 lg:w-[420px]">
                        <label className="text-sm font-medium text-slate-700">
                          执行间隔（分钟）
                          <select
                            className="mt-2 w-full rounded-2xl border border-brand-line bg-white px-4 py-3 font-mono"
                            value={intervals[task.id] ?? task.intervalMinutes}
                            onChange={(event) =>
                              setIntervals((current) => ({
                                ...current,
                                [task.id]: Number(event.target.value)
                              }))
                            }
                          >
                            {getIntervalOptions(intervals[task.id] ?? task.intervalMinutes).map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <div className="flex items-end gap-2">
                          {offer ? (
                            <button
                              className="rounded-2xl border border-brand-line bg-white px-4 py-3 text-xs font-semibold text-slate-700"
                              onClick={() => setActiveOffer(offer)}
                              type="button"
                            >
                              编辑任务
                            </button>
                          ) : null}
                          <button
                            className="rounded-2xl border border-brand-line bg-white px-4 py-3 text-xs font-semibold text-slate-700"
                            disabled={taskActionLoading === `save-${task.id}`}
                            onClick={() => saveTask(task, task.enabled)}
                            type="button"
                          >
                            {taskActionLoading === `save-${task.id}` ? "保存中..." : "保存配置"}
                          </button>
                          {!task.enabled || task.status === "idle" ? (
                            <button
                              className="rounded-2xl bg-brand-emerald px-4 py-3 text-xs font-semibold text-white"
                              disabled={taskActionLoading === `enable-${task.id}`}
                              onClick={() => enableTask(task)}
                              type="button"
                            >
                              {taskActionLoading === `enable-${task.id}` ? "启用中..." : "恢复任务"}
                            </button>
                          ) : (
                            <button
                              className="rounded-2xl bg-slate-700 px-4 py-3 text-xs font-semibold text-white"
                              disabled={taskActionLoading === `save-${task.id}`}
                              onClick={() => saveTask(task, false)}
                              type="button"
                            >
                              暂停任务
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-4">
                      <p className="text-sm text-slate-600">状态：{getTaskStatusLabel(task)}</p>
                      <p className="text-sm text-slate-600">当前间隔：{task.intervalMinutes} 分钟</p>
                      <p className="text-sm text-slate-600">
                        持续天数：{task.durationDays === -1 ? "不限期" : `${task.durationDays} 天`}
                      </p>
                      <p className="text-sm text-slate-600">下次执行：{task.nextRunAt || "待调度"}</p>
                    </div>

                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      <p className="text-sm text-slate-600">连续失败：{task.consecutiveFailures}</p>
                      <p className="text-sm text-slate-600">
                        Customer ID：{task.googleCustomerId || "--"}
                      </p>
                      <p className="text-sm text-slate-600">
                        Campaign ID：{task.googleCampaignId || "--"}
                      </p>
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
            <li>3. Script Token 默认长期有效，同一时间只有当前显示的这一个 Token 可用。</li>
            <li>4. 如需更换 Token，请在这里直接更换，然后重新复制最新脚本。</li>
            <li>5. Script 模式下，脚本会从快照接口读取 suffix；Google Ads API 模式则由平台直接更新目标 Campaign。</li>
          </ol>

          <div className="mt-5 rounded-[28px] border border-brand-line bg-stone-50 p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Script Token</p>
            <p className="mt-2 font-mono text-sm text-slate-800">{script.token || "尚未生成"}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                className="rounded-full border border-brand-line bg-white px-4 py-2 text-xs font-semibold text-slate-700 disabled:opacity-60"
                disabled={rotatingToken}
                onClick={rotateToken}
                type="button"
              >
                {rotatingToken ? "更换中..." : "更换 Token"}
              </button>
              <button
                className="rounded-full bg-brand-emerald px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
                disabled={!script.template || rotatingToken}
                onClick={() => navigator.clipboard.writeText(script.template || "")}
                type="button"
              >
                复制最新换链接脚本
              </button>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              这份脚本已经内置当前站点地址和 Script Token。Token 默认长期有效，若你更换 Token，旧 Token 会立即失效，请重新复制一次最新脚本。
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
                  <p className="mt-2 text-xs text-slate-500">
                    应用结果：{run.applyStatus}
                    {run.applyErrorMessage ? ` · ${run.applyErrorMessage}` : ""}
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

      <LinkSwapTaskDialog
        offer={activeOffer}
        open={Boolean(activeOffer)}
        onClose={() => setActiveOffer(null)}
        onSaved={loadAll}
      />
    </div>
  );
}
