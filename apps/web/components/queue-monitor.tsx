"use client";

import { useEffect, useState } from "react";

import type { QueueStats, QueueTaskRecord, QueueTaskStatus, QueueTaskType } from "@autocashback/domain";

const emptyStats: QueueStats = {
  total: 0,
  pending: 0,
  running: 0,
  completed: 0,
  failed: 0,
  byType: {
    "click-farm-trigger": 0,
    "click-farm-batch": 0,
    "click-farm": 0,
    "url-swap": 0
  }
};

export function QueueMonitor() {
  const [stats, setStats] = useState<QueueStats>(emptyStats);
  const [tasks, setTasks] = useState<QueueTaskRecord[]>([]);
  const [schedulerStatus, setSchedulerStatus] = useState<{
    mode: string;
    heartbeatAt: string | null;
    lastTickAt: string | null;
    lastTickSummary: Record<string, unknown> | null;
    note: string;
    clickFarmScheduler: {
      status: "healthy" | "warning" | "error";
      message: string;
      metrics: {
        enabledTasks: number;
        overdueTasks: number;
        recentQueuedTasks: number;
        lastQueuedAt: string | null;
        checkInterval: string;
      };
    };
    urlSwapScheduler: {
      status: "healthy" | "warning" | "error";
      message: string;
      metrics: {
        enabledTasks: number;
        overdueTasks: number;
        recentQueuedTasks: number;
        lastQueuedAt: string | null;
        checkInterval: string;
      };
    };
  } | null>(null);
  const [status, setStatus] = useState<QueueTaskStatus | "all">("all");
  const [type, setType] = useState<QueueTaskType | "all">("all");
  const [message, setMessage] = useState("");
  const [schedulerMessage, setSchedulerMessage] = useState("");
  const [schedulerLoading, setSchedulerLoading] = useState(false);

  async function loadAll() {
    try {
      const query = new URLSearchParams();
      if (status !== "all") {
        query.set("status", status);
      }
      if (type !== "all") {
        query.set("type", type);
      }
      query.set("limit", "100");

      const [statsResponse, tasksResponse, schedulerResponse] = await Promise.all([
        fetch("/api/queue/stats"),
        fetch(`/api/queue/tasks?${query.toString()}`),
        fetch("/api/queue/scheduler")
      ]);
      const statsPayload = await statsResponse.json();
      const tasksPayload = await tasksResponse.json();
      const schedulerPayload = await schedulerResponse.json();

      if (!statsResponse.ok) {
        throw new Error(statsPayload.error || "加载队列统计失败");
      }

      if (!tasksResponse.ok) {
        throw new Error(tasksPayload.error || "加载队列任务失败");
      }

      if (!schedulerResponse.ok) {
        throw new Error(schedulerPayload.error || "加载调度器状态失败");
      }

      setStats(statsPayload.stats || emptyStats);
      setTasks(tasksPayload.tasks || []);
      setSchedulerStatus(schedulerPayload.data || null);
      setMessage("");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "加载队列数据失败");
    }
  }

  async function triggerScheduler() {
    setSchedulerLoading(true);
    setSchedulerMessage("");

    try {
      const response = await fetch("/api/queue/scheduler", { method: "POST" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "手动触发调度器失败");
      }

      setSchedulerMessage(payload.message || "调度器已手动触发");
      await loadAll();
    } catch (error: unknown) {
      setSchedulerMessage(error instanceof Error ? error.message : "手动触发调度器失败");
    } finally {
      setSchedulerLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, [status, type]);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-5">
        <StatCard label="总任务数" value={stats.total} />
        <StatCard label="待执行" value={stats.pending} />
        <StatCard label="运行中" value={stats.running} />
        <StatCard label="已完成" value={stats.completed} />
        <StatCard label="失败" value={stats.failed} />
      </section>

      <section className="surface-panel p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="eyebrow">调度器状态</p>
            <h3 className="mt-2 text-2xl font-semibold text-slate-900">编排中心健康度</h3>
          </div>
          <button
            className="rounded-2xl bg-brand-emerald px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
            disabled={schedulerLoading}
            onClick={triggerScheduler}
            type="button"
          >
            {schedulerLoading ? "触发中..." : "手动触发"}
          </button>
        </div>

        {schedulerStatus ? (
          <>
            <p className="mt-4 text-sm text-slate-600">{schedulerStatus.note}</p>
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <SchedulerCard
                label="补点击调度器"
                value={schedulerStatus.clickFarmScheduler.status}
                message={schedulerStatus.clickFarmScheduler.message}
                metrics={schedulerStatus.clickFarmScheduler.metrics}
              />
              <SchedulerCard
                label="换链接调度器"
                value={schedulerStatus.urlSwapScheduler.status}
                message={schedulerStatus.urlSwapScheduler.message}
                metrics={schedulerStatus.urlSwapScheduler.metrics}
              />
            </div>
            <div className="mt-5 grid gap-3 text-sm text-slate-600 sm:grid-cols-2 xl:grid-cols-4">
              <p>最近心跳：{schedulerStatus.heartbeatAt || "--"}</p>
              <p>最近编排：{schedulerStatus.lastTickAt || "--"}</p>
              <p>调度模式：{schedulerStatus.mode}</p>
              <p>
                最近摘要：
                {schedulerStatus.lastTickSummary
                  ? ` processed=${schedulerStatus.lastTickSummary.processed || 0}, inserted=${schedulerStatus.lastTickSummary.inserted || 0}`
                  : " --"}
              </p>
            </div>
          </>
        ) : (
          <p className="mt-4 rounded-2xl bg-stone-50 px-4 py-5 text-sm text-slate-500">正在加载调度器状态...</p>
        )}

        {schedulerMessage ? <p className="mt-4 text-sm text-slate-600">{schedulerMessage}</p> : null}
      </section>

      <section className="surface-panel p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="eyebrow">统一队列</p>
            <h3 className="mt-2 text-2xl font-semibold text-slate-900">任务编排中心</h3>
          </div>

          <div className="flex flex-wrap gap-3">
            <select
              className="rounded-2xl border border-brand-line bg-white px-4 py-3 text-sm text-slate-700"
              value={type}
              onChange={(event) => setType(event.target.value as QueueTaskType | "all")}
            >
              <option value="all">全部类型</option>
              <option value="click-farm-trigger">click-farm-trigger</option>
              <option value="click-farm-batch">click-farm-batch</option>
              <option value="click-farm">click-farm</option>
              <option value="url-swap">url-swap</option>
            </select>
            <select
              className="rounded-2xl border border-brand-line bg-white px-4 py-3 text-sm text-slate-700"
              value={status}
              onChange={(event) => setStatus(event.target.value as QueueTaskStatus | "all")}
            >
              <option value="all">全部状态</option>
              <option value="pending">pending</option>
              <option value="running">running</option>
              <option value="completed">completed</option>
              <option value="failed">failed</option>
            </select>
            <button
              className="rounded-2xl bg-brand-emerald px-5 py-3 text-sm font-semibold text-white"
              onClick={loadAll}
              type="button"
            >
              刷新
            </button>
          </div>
        </div>

        {message ? <p className="mt-4 text-sm text-slate-600">{message}</p> : null}

        <div className="mt-5 grid gap-3 text-sm text-slate-600 sm:grid-cols-2 xl:grid-cols-4">
          <p>换链接：{stats.byType["url-swap"]}</p>
          <p>补点击触发：{stats.byType["click-farm-trigger"]}</p>
          <p>补点击批次：{stats.byType["click-farm-batch"]}</p>
          <p>补点击执行：{stats.byType["click-farm"]}</p>
        </div>

        <div className="mt-5 grid gap-3">
          {tasks.length ? (
            tasks.map((task) => (
              <div className="rounded-[28px] border border-brand-line bg-stone-50 p-5" key={task.id}>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="font-mono text-xs text-slate-500">{task.id}</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">{task.type}</p>
                    <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">
                      user #{task.userId} · {task.priority} · {task.status}
                    </p>
                  </div>
                  <div className="grid gap-2 text-right text-xs text-slate-500">
                    <p>可执行时间：{task.availableAt}</p>
                    <p>开始时间：{task.startedAt || "--"}</p>
                    <p>完成时间：{task.completedAt || "--"}</p>
                  </div>
                </div>

                {task.errorMessage ? (
                  <p className="mt-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-xs text-red-700">
                    {task.errorMessage}
                  </p>
                ) : null}
              </div>
            ))
          ) : (
            <p className="rounded-2xl bg-stone-50 px-4 py-5 text-sm text-slate-500">
              当前筛选条件下没有队列任务。
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function StatCard(props: { label: string; value: number }) {
  return (
    <div className="surface-panel p-5">
      <p className="text-sm text-slate-500">{props.label}</p>
      <p className="mt-3 font-mono text-3xl font-semibold text-slate-900">{props.value}</p>
    </div>
  );
}

function SchedulerCard(props: {
  label: string;
  value: "healthy" | "warning" | "error";
  message: string;
  metrics: {
    enabledTasks: number;
    overdueTasks: number;
    recentQueuedTasks: number;
    lastQueuedAt: string | null;
    checkInterval: string;
  };
}) {
  const tone =
    props.value === "healthy"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : props.value === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-red-200 bg-red-50 text-red-700";

  return (
    <div className={`rounded-[28px] border p-5 ${tone}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">{props.label}</p>
        <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold uppercase">
          {props.value}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6">{props.message}</p>
      <div className="mt-4 grid gap-2 text-xs sm:grid-cols-2">
        <p>检查周期：{props.metrics.checkInterval}</p>
        <p>启用任务：{props.metrics.enabledTasks}</p>
        <p>待调度：{props.metrics.overdueTasks}</p>
        <p>最近入队：{props.metrics.recentQueuedTasks}</p>
        <p className="sm:col-span-2">最后入队时间：{props.metrics.lastQueuedAt || "--"}</p>
      </div>
    </div>
  );
}
