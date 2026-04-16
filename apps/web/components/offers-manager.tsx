"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  PLATFORM_OPTIONS,
  type CashbackAccount,
  type OfferRecord
} from "@autocashback/domain";

import { ClickFarmTaskDialog } from "@/components/click-farm-task-dialog";
import { LinkSwapTaskDialog } from "@/components/link-swap-task-dialog";
import {
  resolveClickFarmTaskMode,
  resolveLinkSwapTaskMode
} from "@/lib/task-modal-helpers";

type OfferFormState = {
  promoLink: string;
  targetCountry: string;
  brandName: string;
  platformCode: OfferRecord["platformCode"];
  cashbackAccountId: string;
  campaignLabel: string;
  commissionCapUsd: number;
  manualRecordedCommissionUsd: number;
};

const initialForm: OfferFormState = {
  promoLink: "",
  targetCountry: "US",
  brandName: "",
  platformCode: "topcashback",
  cashbackAccountId: "",
  campaignLabel: "",
  commissionCapUsd: 200,
  manualRecordedCommissionUsd: 0
};

const platformLabelMap = Object.fromEntries(PLATFORM_OPTIONS.map((option) => [option.value, option.label]));

export function OffersManager() {
  const router = useRouter();
  const [offers, setOffers] = useState<OfferRecord[]>([]);
  const [accounts, setAccounts] = useState<CashbackAccount[]>([]);
  const [form, setForm] = useState<OfferFormState>(initialForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [activeClickFarmOffer, setActiveClickFarmOffer] = useState<OfferRecord | null>(null);
  const [activeLinkSwapOffer, setActiveLinkSwapOffer] = useState<OfferRecord | null>(null);
  const [taskActionLoading, setTaskActionLoading] = useState<string | null>(null);

  const filteredAccounts = useMemo(
    () => accounts.filter((account) => account.platformCode === form.platformCode),
    [accounts, form.platformCode]
  );

  async function loadAll() {
    setLoading(true);
    const [offersResponse, accountsResponse] = await Promise.all([
      fetch("/api/offers"),
      fetch("/api/cashback-accounts")
    ]);
    const offersPayload = await offersResponse.json();
    const accountsPayload = await accountsResponse.json();
    setOffers(offersPayload.offers || []);
    setAccounts(accountsPayload.accounts || []);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
  }, []);

  function resetForm() {
    setForm(initialForm);
    setEditingId(null);
    setError("");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setMessage("");

    const payload = {
      ...form,
      cashbackAccountId: Number(form.cashbackAccountId),
      targetCountry: form.targetCountry.toUpperCase(),
      commissionCapUsd: Number(form.commissionCapUsd),
      manualRecordedCommissionUsd: Number(form.manualRecordedCommissionUsd)
    };

    const response = await fetch("/api/offers", {
      method: editingId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editingId ? { id: editingId, ...payload } : payload)
    });
    const result = await response.json();
    setPending(false);

    if (!response.ok) {
      setError(result.error || "保存失败");
      return;
    }

    setMessage(editingId ? "Offer 已更新" : "Offer 已创建");
    resetForm();
    await loadAll();
  }

  function handleEdit(offer: OfferRecord) {
    setEditingId(offer.id);
    setForm({
      promoLink: offer.promoLink,
      targetCountry: offer.targetCountry,
      brandName: offer.brandName,
      platformCode: offer.platformCode,
      cashbackAccountId: String(offer.cashbackAccountId),
      campaignLabel: offer.campaignLabel,
      commissionCapUsd: offer.commissionCapUsd,
      manualRecordedCommissionUsd: offer.manualRecordedCommissionUsd
    });
    setError("");
    setMessage("");
  }

  async function handleDelete(offerId: number) {
    if (!window.confirm("删除 Offer 会同步删除换链接任务与执行日志，确认继续？")) {
      return;
    }

    setError("");
    setMessage("");

    const response = await fetch("/api/offers", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: offerId })
    });
    const result = await response.json();

    if (!response.ok) {
      setError(result.error || "删除失败");
      return;
    }

    if (editingId === offerId) {
      resetForm();
    }

    setMessage("Offer 已删除");
    await loadAll();
  }

  async function openClickFarmTask(offer: OfferRecord) {
    setTaskActionLoading(`click-farm-${offer.id}`);

    try {
      const { infoMessage } = await resolveClickFarmTaskMode(offer.id);
      if (infoMessage) {
        setMessage(infoMessage);
      }
      setActiveClickFarmOffer(offer);
    } finally {
      setTaskActionLoading(null);
    }
  }

  async function openLinkSwapTask(offer: OfferRecord) {
    setTaskActionLoading(`link-swap-${offer.id}`);

    try {
      const { infoMessage } = await resolveLinkSwapTaskMode(offer.id);
      if (infoMessage) {
        setMessage(infoMessage);
      }
      setActiveLinkSwapOffer(offer);
    } finally {
      setTaskActionLoading(null);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[440px,1fr]">
      <form className="surface-panel p-6" onSubmit={handleSubmit}>
        <p className="eyebrow">{editingId ? "编辑 Offer" : "手工创建 Offer"}</p>
        <h3 className="mt-3 text-2xl font-semibold text-slate-900">Offer 管理</h3>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          录入推广链接、绑定返利网账号，并手工维护佣金进度。达到阈值后系统会自动标记为预警。
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            className="rounded-full border border-brand-line bg-white px-4 py-2 text-xs font-semibold text-slate-700"
            onClick={() => router.push("/google-ads")}
            type="button"
          >
            查看 Google Ads 账号
          </button>
          <button
            className="rounded-full border border-brand-line bg-white px-4 py-2 text-xs font-semibold text-slate-700"
            onClick={() => router.push("/link-swap")}
            type="button"
          >
            查看换链接总览
          </button>
        </div>

        <div className="mt-6 space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            推广链接
            <textarea
              className="mt-2 min-h-28 w-full rounded-2xl border border-brand-line bg-stone-50 px-4 py-3"
              value={form.promoLink}
              onChange={(event) => setForm({ ...form, promoLink: event.target.value })}
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              推广国家
              <input
                className="mt-2 w-full rounded-2xl border border-brand-line bg-stone-50 px-4 py-3 uppercase"
                maxLength={8}
                value={form.targetCountry}
                onChange={(event) =>
                  setForm({ ...form, targetCountry: event.target.value.toUpperCase() })
                }
              />
            </label>

            <label className="block text-sm font-medium text-slate-700">
              品牌名
              <input
                className="mt-2 w-full rounded-2xl border border-brand-line bg-stone-50 px-4 py-3"
                value={form.brandName}
                onChange={(event) => setForm({ ...form, brandName: event.target.value })}
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              返利网平台
              <select
                className="mt-2 w-full rounded-2xl border border-brand-line bg-stone-50 px-4 py-3"
                value={form.platformCode}
                onChange={(event) =>
                  setForm({
                    ...form,
                    platformCode: event.target.value as OfferRecord["platformCode"],
                    cashbackAccountId: ""
                  })
                }
              >
                {PLATFORM_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-medium text-slate-700">
              返利网账号
              <select
                className="mt-2 w-full rounded-2xl border border-brand-line bg-stone-50 px-4 py-3"
                value={form.cashbackAccountId}
                onChange={(event) => setForm({ ...form, cashbackAccountId: event.target.value })}
              >
                <option value="">请选择账号</option>
                {filteredAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.accountName}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block text-sm font-medium text-slate-700">
            Campaign Label
            <input
              className="mt-2 w-full rounded-2xl border border-brand-line bg-stone-50 px-4 py-3"
              placeholder="Google Ads 标签名"
              value={form.campaignLabel}
              onChange={(event) => setForm({ ...form, campaignLabel: event.target.value })}
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              佣金阈值 USD
              <input
                className="mt-2 w-full rounded-2xl border border-brand-line bg-stone-50 px-4 py-3 font-mono"
                min={0}
                step="0.01"
                type="number"
                value={form.commissionCapUsd}
                onChange={(event) =>
                  setForm({ ...form, commissionCapUsd: Number(event.target.value) })
                }
              />
            </label>

            <label className="block text-sm font-medium text-slate-700">
              已记录佣金 USD
              <input
                className="mt-2 w-full rounded-2xl border border-brand-line bg-stone-50 px-4 py-3 font-mono"
                min={0}
                step="0.01"
                type="number"
                value={form.manualRecordedCommissionUsd}
                onChange={(event) =>
                  setForm({ ...form, manualRecordedCommissionUsd: Number(event.target.value) })
                }
              />
            </label>
          </div>
        </div>

        {form.manualRecordedCommissionUsd >= form.commissionCapUsd ? (
          <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            当前佣金已达到阈值，保存后 Offer 会进入 warning 状态，需人工确认是否停投。
          </p>
        ) : null}

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
        {message ? <p className="mt-4 text-sm text-brand-emerald">{message}</p> : null}

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            className="rounded-2xl bg-brand-emerald px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
            disabled={pending}
            type="submit"
          >
            {pending ? "保存中..." : editingId ? "更新 Offer" : "创建 Offer"}
          </button>
          {editingId ? (
            <button
              className="rounded-2xl border border-brand-line bg-white px-5 py-3 text-sm font-semibold text-slate-700"
              onClick={resetForm}
              type="button"
            >
              取消编辑
            </button>
          ) : null}
        </div>
      </form>

      <div className="surface-panel p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="eyebrow">Offer 列表</p>
            <h3 className="mt-2 text-2xl font-semibold text-slate-900">当前运营中的 Offer</h3>
          </div>
          <span className="rounded-full bg-stone-100 px-3 py-2 font-mono text-xs text-slate-600">
            {offers.length} offers
          </span>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-slate-500">
              <tr>
                <th className="pb-3">品牌</th>
                <th className="pb-3">国家</th>
                <th className="pb-3">平台</th>
                <th className="pb-3">账号</th>
                <th className="pb-3">佣金进度</th>
                <th className="pb-3">终链 Suffix</th>
                <th className="pb-3">状态</th>
                <th className="pb-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="py-4 text-slate-500" colSpan={8}>
                    正在加载 Offer...
                  </td>
                </tr>
              ) : offers.length ? (
                offers.map((offer) => {
                  const account = accounts.find((item) => item.id === offer.cashbackAccountId);
                  const ratio = offer.commissionCapUsd
                    ? Math.min(100, (offer.manualRecordedCommissionUsd / offer.commissionCapUsd) * 100)
                    : 0;

                  return (
                    <tr className="border-t border-brand-line/60 align-top" key={offer.id}>
                      <td className="py-4 font-medium text-slate-900">
                        <p>{offer.brandName}</p>
                        <p className="mt-1 text-xs text-slate-500">{offer.campaignLabel}</p>
                      </td>
                      <td className="py-4">{offer.targetCountry}</td>
                      <td className="py-4">{platformLabelMap[offer.platformCode] || offer.platformCode}</td>
                      <td className="py-4">{account?.accountName || `#${offer.cashbackAccountId}`}</td>
                      <td className="py-4">
                        <p className="font-mono text-slate-700">
                          {offer.manualRecordedCommissionUsd.toFixed(2)} / {offer.commissionCapUsd.toFixed(2)}
                        </p>
                        <div className="mt-2 h-2 w-32 overflow-hidden rounded-full bg-stone-200">
                          <div
                            className={`h-full rounded-full ${
                              ratio >= 100 ? "bg-amber-500" : "bg-brand-emerald"
                            }`}
                            style={{ width: `${ratio}%` }}
                          />
                        </div>
                      </td>
                      <td className="py-4">
                        <p className="max-w-[220px] break-all font-mono text-xs text-slate-600">
                          {offer.latestResolvedSuffix || "尚未解析"}
                        </p>
                      </td>
                      <td className="py-4">
                        <span
                          className={`rounded-full px-3 py-1 text-xs uppercase tracking-wide ${
                            offer.status === "warning"
                              ? "bg-amber-50 text-amber-700"
                              : "bg-stone-100 text-slate-600"
                          }`}
                        >
                          {offer.status}
                        </span>
                      </td>
                      <td className="py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            className="rounded-full border border-brand-line bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                            onClick={() => handleEdit(offer)}
                            type="button"
                          >
                            编辑
                          </button>
                          <button
                            className="rounded-full border border-brand-line bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                            disabled={taskActionLoading === `click-farm-${offer.id}`}
                            onClick={() => void openClickFarmTask(offer)}
                            type="button"
                          >
                            {taskActionLoading === `click-farm-${offer.id}` ? "加载中..." : "补点击任务"}
                          </button>
                          <button
                            className="rounded-full border border-brand-line bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                            disabled={taskActionLoading === `link-swap-${offer.id}`}
                            onClick={() => void openLinkSwapTask(offer)}
                            type="button"
                          >
                            {taskActionLoading === `link-swap-${offer.id}` ? "加载中..." : "换链接任务"}
                          </button>
                          <button
                            className="rounded-full border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600"
                            onClick={() => handleDelete(offer.id)}
                            type="button"
                          >
                            删除 Offer
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td className="py-6 text-slate-500" colSpan={8}>
                    还没有 Offer，请先创建并绑定账号。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ClickFarmTaskDialog
        offer={activeClickFarmOffer}
        open={Boolean(activeClickFarmOffer)}
        onClose={() => setActiveClickFarmOffer(null)}
        onSaved={loadAll}
      />
      <LinkSwapTaskDialog
        offer={activeLinkSwapOffer}
        open={Boolean(activeLinkSwapOffer)}
        onClose={() => setActiveLinkSwapOffer(null)}
        onSaved={loadAll}
      />
    </div>
  );
}
