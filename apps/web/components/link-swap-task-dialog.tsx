"use client";

import { useEffect, useState } from "react";

import {
  LINK_SWAP_ALLOWED_INTERVALS_MINUTES,
  LINK_SWAP_INTERVAL_OPTIONS,
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
  const [message, setMessage] = useState("");
  const [proxyWarning, setProxyWarning] = useState("");

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

    if (proxyWarning) {
      setMessage(proxyWarning);
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const response = await fetch("/api/link-swap/tasks", {
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

      setTask(payload.task as LinkSwapTaskRecord);
      setMessage("换链接任务已保存");
      await onSaved?.();
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
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
          <div className="rounded-[28px] border border-brand-line bg-stone-50 p-5">
            <p className="text-sm font-semibold text-slate-900">{offer.brandName}</p>
            <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">
              {offer.targetCountry} · {offer.campaignLabel || "未设置 Campaign Label"}
            </p>
            <p className="mt-3 break-all font-mono text-xs text-slate-600">
              最近 Suffix: {offer.latestResolvedSuffix || "尚未解析"}
            </p>
          </div>

          {proxyWarning ? (
            <div className="rounded-[28px] border border-red-200 bg-red-50 p-5 text-sm leading-6 text-red-700">
              <p>{proxyWarning}</p>
              <button
                className="mt-3 rounded-full border border-red-200 bg-white px-4 py-2 text-xs font-semibold text-red-700"
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
            <p className="rounded-2xl bg-stone-50 px-4 py-5 text-sm text-slate-500">正在加载任务...</p>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium text-slate-700">
                  执行模式
                  <select
                    className="mt-2 w-full rounded-2xl border border-brand-line bg-white px-4 py-3"
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

                <label className="block text-sm font-medium text-slate-700">
                  执行间隔（分钟）
                  <select
                    className="mt-2 w-full rounded-2xl border border-brand-line bg-white px-4 py-3 font-mono"
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
                <label className="block text-sm font-medium text-slate-700">
                  持续天数
                  <select
                    className="mt-2 w-full rounded-2xl border border-brand-line bg-white px-4 py-3"
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

                <label className="flex items-end gap-3 rounded-[28px] border border-brand-line bg-stone-50 px-4 py-4 text-sm font-medium text-slate-700">
                  <input
                    checked={form.enabled}
                    className="h-4 w-4 rounded border-brand-line"
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
                  <label className="block text-sm font-medium text-slate-700">
                    Customer ID
                    <input
                      className="mt-2 w-full rounded-2xl border border-brand-line bg-white px-4 py-3 font-mono"
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

                  <label className="block text-sm font-medium text-slate-700">
                    Campaign ID
                    <input
                      className="mt-2 w-full rounded-2xl border border-brand-line bg-white px-4 py-3 font-mono"
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
                <div className="rounded-[28px] border border-brand-line bg-stone-50 p-5 text-sm leading-6 text-slate-600">
                  脚本模式仍通过 `/api/script/link-swap/snapshot` 向 MCC 脚本提供只读快照。只要 Offer 配置了
                  `campaignLabel`，脚本就会匹配并更新对应 Campaign。
                </div>
              )}

              {task ? (
                <div className="grid gap-3 rounded-[28px] border border-brand-line bg-stone-50 p-5 text-sm text-slate-600 sm:grid-cols-2">
                  <p>当前状态：{task.status}</p>
                  <p>连续失败：{task.consecutiveFailures}</p>
                  <p>上次执行：{task.lastRunAt || "暂无"}</p>
                  <p>下次执行：{task.nextRunAt || "待调度"}</p>
                </div>
              ) : null}
            </>
          )}

          {message ? <p className="text-sm text-slate-600">{message}</p> : null}

          <div className="flex flex-wrap justify-end gap-3">
            <button
              className="rounded-2xl border border-brand-line bg-white px-5 py-3 text-sm font-semibold text-slate-700"
              onClick={onClose}
              type="button"
            >
              关闭
            </button>
            <button
              className="rounded-2xl bg-brand-emerald px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
              disabled={loading || saving}
              type="submit"
            >
              {saving ? "保存中..." : "保存任务"}
            </button>
          </div>
        </form>
      ) : null}
    </ModalFrame>
  );
}
