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
  const [status, setStatus] = useState<QueueTaskStatus | "all">("all");
  const [type, setType] = useState<QueueTaskType | "all">("all");
  const [message, setMessage] = useState("");

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

      const [statsResponse, tasksResponse] = await Promise.all([
        fetch("/api/queue/stats"),
        fetch(`/api/queue/tasks?${query.toString()}`)
      ]);
      const statsPayload = await statsResponse.json();
      const tasksPayload = await tasksResponse.json();

      if (!statsResponse.ok) {
        throw new Error(statsPayload.error || "加载队列统计失败");
      }

      if (!tasksResponse.ok) {
        throw new Error(tasksPayload.error || "加载队列任务失败");
      }

      setStats(statsPayload.stats || emptyStats);
      setTasks(tasksPayload.tasks || []);
      setMessage("");
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "加载队列数据失败");
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
