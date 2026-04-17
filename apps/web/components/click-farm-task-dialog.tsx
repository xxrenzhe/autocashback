"use client";

import { useEffect, useState } from "react";

import type { ClickFarmTask, OfferRecord } from "@autocashback/domain";

import { ModalFrame } from "@/components/modal-frame";

type ClickFarmTaskDialogProps = {
  open: boolean;
  offer: OfferRecord | null;
  onClose: () => void;
  onSaved?: () => Promise<void> | void;
};

type RefererType = "none" | "random" | "specific" | "custom";

type FormState = {
  dailyClickCount: number;
  startTime: string;
  endTime: string;
  durationDays: number;
  scheduledStartDate: string;
  timezone: string;
  refererType: RefererType;
  refererValue: string;
};

function getTodayDateString() {
  return new Date().toISOString().slice(0, 10);
}

function buildDistribution(dailyClickCount: number, startTime: string, endTime: string) {
  const startHour = Math.max(0, Number(startTime.split(":")[0] || 0));
  const rawEndHour = Number(endTime.split(":")[0] || 24);
  const endHour = Math.min(24, rawEndHour === 0 ? 24 : rawEndHour);
  const activeHours = Math.max(1, endHour - startHour);
  const base = Math.floor(dailyClickCount / activeHours);
  const remainder = dailyClickCount - base * activeHours;
  const distribution = Array.from({ length: 24 }, () => 0);

  for (let hour = startHour; hour < endHour; hour += 1) {
    distribution[hour] = base;
  }

  for (let index = 0; index < remainder; index += 1) {
    const hour = startHour + (index % activeHours);
    distribution[hour] += 1;
  }

  return distribution;
}

function toFormState(task: ClickFarmTask | null): FormState {
  return {
    dailyClickCount: task?.dailyClickCount ?? 216,
    startTime: task?.startTime ?? "06:00",
    endTime: task?.endTime ?? "24:00",
    durationDays: task?.durationDays ?? 14,
    scheduledStartDate: task?.scheduledStartDate ?? getTodayDateString(),
    timezone: task?.timezone ?? "UTC",
    refererType: task?.refererConfig?.type ?? "none",
    refererValue: task?.refererConfig?.referer ?? ""
  };
}

export function ClickFarmTaskDialog(props: ClickFarmTaskDialogProps) {
  const { offer, onClose, onSaved, open } = props;
  const [task, setTask] = useState<ClickFarmTask | null>(null);
  const [form, setForm] = useState<FormState>(toFormState(null));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!open || !offer) {
      return;
    }

    const currentOffer = offer;
    let cancelled = false;

    async function loadTask() {
      setLoading(true);
      setMessage("");

      try {
        const response = await fetch(`/api/offers/${currentOffer.id}/click-farm-task`);
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error || "加载补点击任务失败");
        }

        if (cancelled) {
          return;
        }

        const nextTask = (payload.task || null) as ClickFarmTask | null;
        setTask(nextTask);
        setForm(toFormState(nextTask));
      } catch (error: unknown) {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : "加载补点击任务失败");
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

  async function submitForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!offer) return;

    setSaving(true);
    setMessage("");

    try {
      const response = await fetch("/api/click-farm/tasks", {
        method: task ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: task?.id,
          offerId: offer.id,
          targetCountry: offer.targetCountry,
          dailyClickCount: Number(form.dailyClickCount),
          startTime: form.startTime,
          endTime: form.endTime,
          durationDays: Number(form.durationDays),
          scheduledStartDate: form.scheduledStartDate,
          timezone: form.timezone,
          hourlyDistribution: buildDistribution(
            Number(form.dailyClickCount),
            form.startTime,
            form.endTime
          ),
          refererConfig:
            form.refererType === "none"
              ? null
              : {
                  type: form.refererType,
                  referer: form.refererValue.trim() || undefined
                }
        })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "保存失败");
      }

      setTask(payload.task as ClickFarmTask);
      setMessage(task ? "补点击任务已更新" : "补点击任务已创建");
      await onSaved?.();
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function runTaskAction(action: "stop" | "restart" | "delete") {
    if (!task) return;

    setSaving(true);
    setMessage("");

    try {
      const endpoint =
        action === "delete"
          ? `/api/click-farm/tasks/${task.id}`
          : `/api/click-farm/tasks/${task.id}/${action}`;
      const response = await fetch(endpoint, {
        method: action === "delete" ? "DELETE" : "POST"
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "操作失败");
      }

      if (action === "delete") {
        setTask(null);
        setForm(toFormState(null));
        setMessage("补点击任务已删除");
      } else {
        setTask((payload.task || null) as ClickFarmTask | null);
        setMessage(action === "stop" ? "补点击任务已暂停" : "补点击任务已恢复");
      }

      await onSaved?.();
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "操作失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalFrame
      description="补点击任务会按目标国家时区和小时分布执行请求，缺少代理时会自动暂停，恢复后可继续运行。"
      onClose={onClose}
      open={open}
      title={offer ? `${offer.brandName} 的补点击任务` : "补点击任务"}
    >
      {offer ? (
        <form className="space-y-5" onSubmit={submitForm}>
          <div className="rounded-xl border border-border bg-muted/40 p-5">
            <p className="text-sm font-semibold text-foreground">{offer.brandName}</p>
            <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
              {offer.targetCountry} · {offer.campaignLabel || "未设置 Campaign Label"}
            </p>
            <p className="mt-3 break-all font-mono text-xs text-muted-foreground">{offer.promoLink}</p>
          </div>

          {loading ? (
            <p className="rounded-lg bg-muted/40 px-4 py-5 text-sm text-muted-foreground">正在加载任务...</p>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium text-foreground">
                  每日点击数
                  <input
                    className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono"
                    min={1}
                    step={1}
                    type="number"
                    value={form.dailyClickCount}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        dailyClickCount: Number(event.target.value)
                      }))
                    }
                  />
                </label>

                <label className="block text-sm font-medium text-foreground">
                  时区
                  <input
                    className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2"
                    value={form.timezone}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        timezone: event.target.value
                      }))
                    }
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <label className="block text-sm font-medium text-foreground">
                  开始时间
                  <input
                    className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono"
                    type="time"
                    value={form.startTime}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        startTime: event.target.value
                      }))
                    }
                  />
                </label>

                <label className="block text-sm font-medium text-foreground">
                  结束时间
                  <input
                    className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono"
                    type="time"
                    value={form.endTime === "24:00" ? "23:59" : form.endTime}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        endTime: event.target.value === "23:59" ? "24:00" : event.target.value
                      }))
                    }
                  />
                </label>

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

                <label className="block text-sm font-medium text-foreground">
                  开始日期
                  <input
                    className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 font-mono"
                    type="date"
                    value={form.scheduledStartDate}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        scheduledStartDate: event.target.value
                      }))
                    }
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-[180px,1fr]">
                <label className="block text-sm font-medium text-foreground">
                  Referer 模式
                  <select
                    className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2"
                    value={form.refererType}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        refererType: event.target.value as RefererType
                      }))
                    }
                  >
                    <option value="none">留空</option>
                    <option value="random">随机社交流量</option>
                    <option value="specific">固定来源</option>
                    <option value="custom">自定义</option>
                  </select>
                </label>

                <label className="block text-sm font-medium text-foreground">
                  Referer 值
                  <input
                    className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2"
                    disabled={form.refererType === "none" || form.refererType === "random"}
                    placeholder={
                      form.refererType === "specific"
                        ? "https://www.facebook.com/"
                        : "https://example.com/path"
                    }
                    value={form.refererValue}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        refererValue: event.target.value
                      }))
                    }
                  />
                </label>
              </div>

              <div className="rounded-xl border border-border bg-muted/40 p-5 text-sm leading-6 text-muted-foreground">
                系统会根据时段自动生成 24 小时分布。默认按活跃时段平均拆分，调度器每次执行单个点击请求，并根据剩余目标量自动计算下次运行时间。
              </div>

              {task ? (
                <div className="grid gap-3 rounded-xl border border-border bg-muted/40 p-5 text-sm text-muted-foreground sm:grid-cols-2">
                  <p>当前状态：{task.status}</p>
                  <p>任务进度：{task.progress}%</p>
                  <p>总点击：{task.totalClicks}</p>
                  <p>成功点击：{task.successClicks}</p>
                  <p>失败点击：{task.failedClicks}</p>
                  <p>下次执行：{task.nextRunAt || "待调度"}</p>
                </div>
              ) : null}
            </>
          )}

          {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

          <div className="flex flex-wrap justify-between gap-3">
            <div className="flex flex-wrap gap-3">
              {task ? (
                <>
                  <button
                    className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground disabled:opacity-60"
                    disabled={saving || task.status === "stopped"}
                    onClick={() => runTaskAction("stop")}
                    type="button"
                  >
                    暂停任务
                  </button>
                  <button
                    className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground disabled:opacity-60"
                    disabled={saving || (task.status !== "paused" && task.status !== "stopped")}
                    onClick={() => runTaskAction("restart")}
                    type="button"
                  >
                    恢复任务
                  </button>
                  <button
                    className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-2 text-sm font-semibold text-destructive disabled:opacity-60"
                    disabled={saving}
                    onClick={() => runTaskAction("delete")}
                    type="button"
                  >
                    删除任务
                  </button>
                </>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground"
                onClick={onClose}
                type="button"
              >
                关闭
              </button>
              <button
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                disabled={loading || saving}
                type="submit"
              >
                {saving ? "保存中…" : task ? "更新任务" : "创建任务"}
              </button>
            </div>
          </div>
        </form>
      ) : null}
    </ModalFrame>
  );
}
