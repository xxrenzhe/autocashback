"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import type { ClickFarmTask, OfferRecord } from "@autocashback/domain";

import { ClickFarmTaskDialog } from "@/components/click-farm-task-dialog";

type ClickFarmStats = {
  totalTasks: number;
  activeTasks: number;
  totalClicks: number;
  successClicks: number;
  failedClicks: number;
};

const emptyStats: ClickFarmStats = {
  totalTasks: 0,
  activeTasks: 0,
  totalClicks: 0,
  successClicks: 0,
  failedClicks: 0
};

export function ClickFarmManager() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialOfferId = Number(searchParams.get("offerId") || 0);

  const [tasks, setTasks] = useState<ClickFarmTask[]>([]);
  const [offers, setOffers] = useState<OfferRecord[]>([]);
  const [stats, setStats] = useState<ClickFarmStats>(emptyStats);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [selectedOffer, setSelectedOffer] = useState<OfferRecord | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bootstrappedFromQuery, setBootstrappedFromQuery] = useState(false);

  const offersMap = new Map(offers.map((offer) => [offer.id, offer]));

  async function loadAll() {
    setLoading(true);

    try {
      const [tasksResponse, offersResponse, statsResponse] = await Promise.all([
        fetch("/api/click-farm/tasks"),
        fetch("/api/offers"),
        fetch("/api/click-farm/stats")
      ]);
      const tasksPayload = await tasksResponse.json();
      const offersPayload = await offersResponse.json();
      const statsPayload = await statsResponse.json();

      if (!tasksResponse.ok) {
        throw new Error(tasksPayload.error || "加载补点击任务失败");
      }

      setTasks(tasksPayload.tasks || []);
      setOffers(offersPayload.offers || []);
      setStats(statsPayload.stats || emptyStats);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "加载补点击数据失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (bootstrappedFromQuery || !offers.length || !initialOfferId) {
      return;
    }

    const matchedOffer = offers.find((item) => item.id === initialOfferId) || null;
    if (matchedOffer) {
      setSelectedOffer(matchedOffer);
      setDialogOpen(true);
    }
    setBootstrappedFromQuery(true);
  }, [bootstrappedFromQuery, initialOfferId, offers]);

  function openDialogForOffer(offer: OfferRecord) {
    setSelectedOffer(offer);
    setDialogOpen(true);
    router.replace("/click-farm");
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-5">
        <StatCard label="总任务数" value={stats.totalTasks} />
        <StatCard label="运行中" value={stats.activeTasks} />
        <StatCard label="总点击" value={stats.totalClicks} />
        <StatCard label="成功点击" value={stats.successClicks} />
        <StatCard label="失败点击" value={stats.failedClicks} />
      </section>

      <section className="surface-panel p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="eyebrow">任务总览</p>
            <h3 className="mt-2 text-2xl font-semibold text-slate-900">补点击任务</h3>
          </div>

          <div className="flex flex-wrap gap-3">
            <select
              className="rounded-2xl border border-brand-line bg-white px-4 py-3 text-sm text-slate-700"
              value={selectedOffer?.id || ""}
              onChange={(event) => {
                const offerId = Number(event.target.value);
                const nextOffer = offers.find((item) => item.id === offerId) || null;
                setSelectedOffer(nextOffer);
              }}
            >
              <option value="">选择 Offer 后新建</option>
              {offers.map((offer) => (
                <option key={offer.id} value={offer.id}>
                  {offer.brandName} · {offer.targetCountry}
                </option>
              ))}
            </select>
            <button
              className="rounded-2xl bg-brand-emerald px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
              disabled={!selectedOffer}
              onClick={() => selectedOffer && openDialogForOffer(selectedOffer)}
              type="button"
            >
              新建 / 编辑任务
            </button>
          </div>
        </div>

        {message ? <p className="mt-4 text-sm text-slate-600">{message}</p> : null}

        <div className="mt-5 grid gap-3">
          {loading ? (
            <p className="rounded-2xl bg-stone-50 px-4 py-5 text-sm text-slate-500">正在加载任务...</p>
          ) : tasks.length ? (
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
                        {offer?.targetCountry || "--"} · {task.timezone}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                        {task.status}
                      </span>
                      {offer ? (
                        <button
                          className="rounded-full border border-brand-line bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                          onClick={() => openDialogForOffer(offer)}
                          type="button"
                        >
                          编辑任务
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-2 xl:grid-cols-4">
                    <p>每日点击：{task.dailyClickCount}</p>
                    <p>
                      运行窗口：{task.startTime} - {task.endTime}
                    </p>
                    <p>任务进度：{task.progress}%</p>
                    <p>下次执行：{task.nextRunAt || "待调度"}</p>
                  </div>

                  <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-3">
                    <p>总点击：{task.totalClicks}</p>
                    <p>成功：{task.successClicks}</p>
                    <p>失败：{task.failedClicks}</p>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="rounded-2xl bg-stone-50 px-4 py-5 text-sm text-slate-500">
              还没有补点击任务。你可以从 Offer 列表进入，或者先在这里选择 Offer 创建任务。
            </p>
          )}
        </div>
      </section>

      <ClickFarmTaskDialog
        offer={selectedOffer}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={loadAll}
      />
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
