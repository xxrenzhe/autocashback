"use client";

import { useEffect, useState } from "react";

import {
  LINK_SWAP_ALLOWED_INTERVALS_MINUTES,
  LINK_SWAP_INTERVAL_OPTIONS,
  type LinkSwapRunRecord,
  type LinkSwapTaskRecord,
  type OfferRecord
} from "@autocashback/domain";

import { ModalFrame } from "@/components/modal-frame";

type LinkSwapTaskDialogProps = {
  open: boolean;
  offer: OfferRecord | null;
  onClose: () => void;
  onSaved?: () => Promise<void> | void;
};

type FormState = {
  enabled: boolean;
  intervalMinutes: number;
  durationDays: number;
  mode: LinkSwapTaskRecord["mode"];
  googleCustomerId: string;
  googleCampaignId: string;
};

const initialForm: FormState = {
  enabled: true,
  intervalMinutes: 60,
  durationDays: -1,
  mode: "script",
  googleCustomerId: "",
  googleCampaignId: ""
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

export function LinkSwapTaskDialog(props: LinkSwapTaskDialogProps) {
  const { offer, onClose, onSaved, open } = props;
  const [task, setTask] = useState<LinkSwapTaskRecord | null>(null);
  const [form, setForm] = useState<FormState>(initialForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [enabling, setEnabling] = useState(false);
  const [disabling, setDisabling] = useState(false);
  const [swappingNow, setSwappingNow] = useState(false);
  const [message, setMessage] = useState("");
  const [proxyWarning, setProxyWarning] = useState("");
  const [history, setHistory] = useState<LinkSwapRunRecord[]>([]);

  const canEnableTask = Boolean(
    task && (!task.enabled || task.status === "idle" || task.status === "error")
  );
  const canDisableTask = Boolean(task && task.enabled && task.status !== "idle");
  const canSwapNowTask = Boolean(task && task.enabled && task.status !== "idle");

  useEffect(() => {
    if (!open || !offer) {
      return;
    }

    const currentOffer = offer;
    let cancelled = false;

    async function loadTask() {
      setLoading(true);
      setMessage("");
      setProxyWarning("");
      setHistory([]);

      try {
        const response = await fetch(`/api/offers/${currentOffer.id}/link-swap-task`);
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error || "加载换链接任务失败");
        }

        if (cancelled) {
          return;
        }

        const nextTask = (payload.task || null) as LinkSwapTaskRecord | null;
        setTask(nextTask);
        setForm({
          enabled: nextTask?.enabled ?? true,
          intervalMinutes: nextTask?.intervalMinutes ?? 60,
          durationDays: nextTask?.durationDays ?? -1,
          mode: nextTask?.mode ?? "script",
          googleCustomerId: nextTask?.googleCustomerId || "",
          googleCampaignId: nextTask?.googleCampaignId || ""
        });

        if (nextTask?.id) {
          const historyResponse = await fetch(`/api/link-swap/tasks/${nextTask.id}/history`);
          const historyPayload = await historyResponse.json().catch(() => null);
          if (!cancelled && historyResponse.ok) {
            setHistory(historyPayload?.history || historyPayload?.data?.history || []);
          }
        }

        const proxyResponse = await fetch(
          `/api/settings/proxy?country=${encodeURIComponent(currentOffer.targetCountry)}`
        );
        const proxyPayload = await proxyResponse.json().catch(() => null);
        if (cancelled) {
          return;
        }
        const proxyUrl = proxyPayload?.data?.proxy_url || null;
        setProxyWarning(
          proxyUrl
            ? ""
            : `未配置 ${currentOffer.targetCountry} 国家的代理。请先前往设置页面补齐代理，否则换链接任务无法执行。`
        );
      } catch (error: unknown) {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : "加载换链接任务失败");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadTask();

    return () => {
      cancelled = true;
    };
  }, [offer, open]);

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!offer) return;

    if (
      form.mode === "google_ads_api" &&
      (!form.googleCustomerId.trim() || !form.googleCampaignId.trim())
    ) {
      setMessage("Google Ads API 模式必须填写 Customer ID 和 Campaign ID");
      return;
    }

    if (!LINK_SWAP_ALLOWED_INTERVALS_MINUTES.includes(Number(form.intervalMinutes))) {
      setMessage(
        `换链接间隔必须是以下值之一：${LINK_SWAP_ALLOWED_INTERVALS_MINUTES.join(", ")} 分钟`
      );
      return;
    }

    if (Number(form.durationDays) !== -1 && (Number(form.durationDays) < 1 || Number(form.durationDays) > 365)) {
      setMessage('任务持续天数必须在 1-365 天之间，或选择"不限期"');
      return;
    }

    if (proxyWarning) {
      setMessage(proxyWarning);
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const endpoint = task?.id ? `/api/link-swap/tasks/${task.id}` : "/api/link-swap/tasks";
      const response = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offerId: offer.id,
          enabled: form.enabled,
          intervalMinutes: Number(form.intervalMinutes),
          durationDays: Number(form.durationDays),
          mode: form.mode,
          googleCustomerId: form.googleCustomerId.trim() || null,
          googleCampaignId: form.googleCampaignId.trim() || null
        })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "保存失败");
      }

      setTask((payload.task || payload.data) as LinkSwapTaskRecord);
      if (task?.id) {
        const historyResponse = await fetch(`/api/link-swap/tasks/${task.id}/history`);
        const historyPayload = await historyResponse.json().catch(() => null);
        if (historyResponse.ok) {
          setHistory(historyPayload?.history || historyPayload?.data?.history || []);
        }
      }
      setMessage(payload.message || "换链接任务已保存");
      await onSaved?.();
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function handleEnableTask() {
    if (!task?.id) {
      return;
    }

    if (proxyWarning) {
      setMessage(proxyWarning);
      return;
    }

    setEnabling(true);
    setMessage("");

    try {
      const response = await fetch(`/api/link-swap/tasks/${task.id}/enable`, {
        method: "POST"
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "启用任务失败");
      }

      const nextTask = (payload.task || payload.data || null) as LinkSwapTaskRecord | null;
      setTask(nextTask);
      if (nextTask) {
        setForm((current) => ({
          ...current,
          enabled: nextTask.enabled
        }));
        const historyResponse = await fetch(`/api/link-swap/tasks/${nextTask.id}/history`);
        const historyPayload = await historyResponse.json().catch(() => null);
        if (historyResponse.ok) {
          setHistory(historyPayload?.history || historyPayload?.data?.history || []);
        }
      }
      setMessage(payload.message || "任务已启用");
      await onSaved?.();
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "启用任务失败");
    } finally {
      setEnabling(false);
    }
  }

  async function handleDisableTask() {
    if (!task?.id) {
      return;
    }

    setDisabling(true);
    setMessage("");

    try {
      const response = await fetch(`/api/link-swap/tasks/${task.id}/disable`, {
        method: "POST"
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "停用任务失败");
      }

      const nextTask = (payload.task || payload.data || null) as LinkSwapTaskRecord | null;
      setTask(nextTask);
      if (nextTask) {
        setForm((current) => ({
          ...current,
          enabled: nextTask.enabled
        }));
      }
      setMessage(payload.message || "任务已停用");
      await onSaved?.();
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "停用任务失败");
    } finally {
      setDisabling(false);
    }
  }

  async function handleSwapNowTask() {
    if (!task?.id) {
      return;
    }

    if (proxyWarning) {
      setMessage(proxyWarning);
      return;
    }

    setSwappingNow(true);
    setMessage("");

    try {
      const response = await fetch(`/api/link-swap/tasks/${task.id}/swap-now`, {
        method: "POST"
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "立即执行失败");
      }

      const nextTask = (payload.task || payload.data || null) as LinkSwapTaskRecord | null;
      setTask(nextTask);
      if (nextTask) {
        setForm((current) => ({
          ...current,
          enabled: nextTask.enabled
        }));
      }
      setMessage(payload.message || "任务已加入立即执行队列");
      await onSaved?.();
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "立即执行失败");
    } finally {
      setSwappingNow(false);
    }
  }

  return (
    <ModalFrame
      description="为单个 Offer 配置换链接执行方式。脚本模式沿用现有 MCC Script；Google Ads API 模式会由平台直接更新指定 Campaign 的 Final URL Suffix。"
      onClose={onClose}
      open={open}
      title={offer ? `${offer.brandName} 的换链接任务` : "换链接任务"}
    >
      {offer ? (
        <form className="space-y-5" onSubmit={handleSave}>
          <div className="rounded-xl border border-border bg-muted/40 p-5">
            <p className="text-sm font-semibold text-foreground">{offer.brandName}</p>
            <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
              {offer.targetCountry} · {offer.campaignLabel || "未设置 Campaign Label"}
            </p>
            <p className="mt-3 break-all font-mono text-xs text-muted-foreground">
              最近 Suffix: {offer.latestResolvedSuffix || "尚未解析"}
            </p>
          </div>

          {proxyWarning ? (
            <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-5 text-sm leading-6 text-destructive">
              <p>{proxyWarning}</p>
              <button
                className="mt-3 rounded-full border border-destructive/20 bg-background px-4 py-2 text-xs font-semibold text-destructive"
                onClick={() => {
                  window.location.href = "/settings";
                }}
                type="button"
              >
                前往设置
              </button>
            </div>
          ) : null}

          {loading ? (
            <p className="rounded-lg bg-muted/40 px-4 py-5 text-sm text-muted-foreground">正在加载任务...</p>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium text-foreground">
                  执行模式
                  <select
                    className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2"
                    value={form.mode}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        mode: event.target.value as LinkSwapTaskRecord["mode"]
                      }))
                    }
                  >
                    <option value="script">脚本模式</option>
                    <option value="google_ads_api">Google Ads API 模式</option>
                  </select>
                </label>

                <label className="block text-sm font-medium text-foreground">
                  执行间隔（分钟）
                  <select
                    className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono"
                    value={form.intervalMinutes}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        intervalMinutes: Number(event.target.value)
                      }))
                    }
                  >
                    {getIntervalOptions(form.intervalMinutes).map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium text-foreground">
                  持续天数
                  <select
                    className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2"
                    value={form.durationDays}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        durationDays: Number(event.target.value)
                      }))
                    }
                  >
                    <option value={7}>7 天</option>
                    <option value={14}>14 天</option>
                    <option value={30}>30 天</option>
                    <option value={60}>60 天</option>
                    <option value={-1}>不限期</option>
                  </select>
                </label>

                <label className="flex items-end gap-3 rounded-xl border border-border bg-muted/40 p-4 text-sm font-medium text-foreground">
                  <input
                    checked={form.enabled}
                    className="h-4 w-4 rounded border-border"
                    type="checkbox"
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        enabled: event.target.checked
                      }))
                    }
                  />
                  启用任务
                </label>
              </div>

              {form.mode === "google_ads_api" ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm font-medium text-foreground">
                    Customer ID
                    <input
                      className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono"
                      placeholder="1234567890"
                      value={form.googleCustomerId}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          googleCustomerId: event.target.value
                        }))
                      }
                    />
                  </label>

                  <label className="block text-sm font-medium text-foreground">
                    Campaign ID
                    <input
                      className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono"
                      placeholder="987654321"
                      value={form.googleCampaignId}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          googleCampaignId: event.target.value
                        }))
                      }
                    />
                  </label>
                </div>
              ) : (
                <div className="rounded-xl border border-border bg-muted/40 p-5 text-sm leading-6 text-muted-foreground">
                  脚本模式仍通过 `/api/script/link-swap/snapshot` 向 MCC 脚本提供只读快照。只要 Offer 配置了
                  `campaignLabel`，脚本就会匹配并更新对应 Campaign。
                </div>
              )}

              {task ? (
                <div className="grid gap-3 rounded-xl border border-border bg-muted/40 p-5 text-sm text-muted-foreground sm:grid-cols-2">
                  <p>当前状态：{task.status}</p>
                  <p>连续失败：{task.consecutiveFailures}</p>
                  <p>上次执行：{task.lastRunAt || "暂无"}</p>
                  <p>下次执行：{task.nextRunAt || "待调度"}</p>
                </div>
              ) : null}

              {task ? (
                <div className="rounded-xl border border-border bg-muted/40 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-foreground">最近执行记录</p>
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">
                      {history.length} runs
                    </span>
                  </div>
                  <div className="mt-4 space-y-3">
                    {history.length ? (
                      history.map((run) => (
                        <div className="rounded-lg border border-border bg-background p-4" key={run.id}>
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-xs font-semibold uppercase tracking-wide text-foreground">
                              {run.status}
                            </p>
                            <p className="text-xs text-muted-foreground">{run.createdAt}</p>
                          </div>
                          <p className="mt-2 break-all font-mono text-xs text-foreground">
                            {run.resolvedSuffix || run.errorMessage || "无 suffix"}
                          </p>
                          <p className="mt-2 text-xs text-muted-foreground">
                            应用结果：{run.applyStatus}
                            {run.applyErrorMessage ? ` · ${run.applyErrorMessage}` : ""}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">还没有换链接执行记录。</p>
                    )}
                  </div>
                </div>
              ) : null}
            </>
          )}

          {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

          <div className="flex flex-wrap justify-end gap-3">
            {canSwapNowTask ? (
              <button
                className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground disabled:opacity-60"
                disabled={loading || saving || enabling || disabling || swappingNow}
                onClick={handleSwapNowTask}
                type="button"
              >
                {swappingNow ? "执行中..." : "立即执行"}
              </button>
            ) : null}
            {canDisableTask ? (
              <button
                className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground disabled:opacity-60"
                disabled={loading || saving || enabling || disabling || swappingNow}
                onClick={handleDisableTask}
                type="button"
              >
                {disabling ? "停用中..." : "暂停任务"}
              </button>
            ) : null}
            {canEnableTask ? (
              <button
                className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground disabled:opacity-60"
                disabled={loading || saving || enabling || disabling || swappingNow}
                onClick={handleEnableTask}
                type="button"
              >
                {enabling ? "恢复中..." : "恢复任务"}
              </button>
            ) : null}
            <button
              className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground"
              onClick={onClose}
              type="button"
            >
              关闭
            </button>
            <button
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              disabled={loading || saving || enabling || disabling || swappingNow}
              type="submit"
            >
              {saving ? "保存中…" : "保存任务"}
            </button>
          </div>
        </form>
      ) : null}
    </ModalFrame>
  );
}
