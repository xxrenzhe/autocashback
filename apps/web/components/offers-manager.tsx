"use client";

import { useEffect, useState } from "react";

import type { CashbackAccount, OfferRecord } from "@autocashback/domain";

const initialForm = {
  promoLink: "",
  targetCountry: "US",
  brandName: "",
  platformCode: "topcashback",
  cashbackAccountId: "",
  campaignLabel: "",
  commissionCapUsd: 200,
  manualRecordedCommissionUsd: 0
};

export function OffersManager() {
  const [offers, setOffers] = useState<OfferRecord[]>([]);
  const [accounts, setAccounts] = useState<CashbackAccount[]>([]);
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");

  async function loadAll() {
    const [offersResponse, accountsResponse] = await Promise.all([
      fetch("/api/offers"),
      fetch("/api/cashback-accounts")
    ]);
    const offersPayload = await offersResponse.json();
    const accountsPayload = await accountsResponse.json();
    setOffers(offersPayload.offers || []);
    setAccounts(accountsPayload.accounts || []);
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const response = await fetch("/api/offers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        cashbackAccountId: Number(form.cashbackAccountId),
        commissionCapUsd: Number(form.commissionCapUsd),
        manualRecordedCommissionUsd: Number(form.manualRecordedCommissionUsd)
      })
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error || "创建 Offer 失败");
      return;
    }
    setForm(initialForm);
    await loadAll();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[400px,1fr]">
      <form className="surface-panel p-6" onSubmit={handleSubmit}>
        <p className="eyebrow">手工创建 Offer</p>
        <div className="mt-5 space-y-4">
          <label className="block text-sm text-slate-700">
            推广链接
            <textarea
              className="mt-2 min-h-24 w-full rounded-2xl border border-brand-line bg-stone-50 px-4 py-3"
              value={form.promoLink}
              onChange={(event) => setForm({ ...form, promoLink: event.target.value })}
            />
          </label>
          <label className="block text-sm text-slate-700">
            推广国家
            <input
              className="mt-2 w-full rounded-2xl border border-brand-line bg-stone-50 px-4 py-3"
              value={form.targetCountry}
              onChange={(event) => setForm({ ...form, targetCountry: event.target.value.toUpperCase() })}
            />
          </label>
          <label className="block text-sm text-slate-700">
            品牌名
            <input
              className="mt-2 w-full rounded-2xl border border-brand-line bg-stone-50 px-4 py-3"
              value={form.brandName}
              onChange={(event) => setForm({ ...form, brandName: event.target.value })}
            />
          </label>
          <label className="block text-sm text-slate-700">
            返利网平台
            <input
              className="mt-2 w-full rounded-2xl border border-brand-line bg-stone-50 px-4 py-3"
              value={form.platformCode}
              onChange={(event) => setForm({ ...form, platformCode: event.target.value })}
            />
          </label>
          <label className="block text-sm text-slate-700">
            返利网账号
            <select
              className="mt-2 w-full rounded-2xl border border-brand-line bg-stone-50 px-4 py-3"
              value={form.cashbackAccountId}
              onChange={(event) => setForm({ ...form, cashbackAccountId: event.target.value })}
            >
              <option value="">请选择账号</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.accountName} · {account.platformCode}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm text-slate-700">
            Campaign Label
            <input
              className="mt-2 w-full rounded-2xl border border-brand-line bg-stone-50 px-4 py-3"
              value={form.campaignLabel}
              onChange={(event) => setForm({ ...form, campaignLabel: event.target.value })}
            />
          </label>
        </div>
        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
        <button className="mt-5 rounded-2xl bg-brand-emerald px-5 py-3 text-sm font-semibold text-white" type="submit">
          创建 Offer
        </button>
      </form>

      <div className="surface-panel p-6">
        <p className="eyebrow">Offer 列表</p>
        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-slate-500">
              <tr>
                <th className="pb-3">品牌</th>
                <th className="pb-3">国家</th>
                <th className="pb-3">平台</th>
                <th className="pb-3">标签</th>
                <th className="pb-3">状态</th>
              </tr>
            </thead>
            <tbody>
              {offers.length ? (
                offers.map((offer) => (
                  <tr className="border-t border-brand-line/60" key={offer.id}>
                    <td className="py-4 font-medium text-slate-900">{offer.brandName}</td>
                    <td className="py-4">{offer.targetCountry}</td>
                    <td className="py-4">{offer.platformCode}</td>
                    <td className="py-4">{offer.campaignLabel}</td>
                    <td className="py-4">
                      <span className="rounded-full bg-stone-100 px-3 py-1 text-xs uppercase tracking-wide text-slate-600">
                        {offer.status}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="py-4 text-slate-500" colSpan={5}>
                    还没有 Offer，请先创建并绑定账号。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
