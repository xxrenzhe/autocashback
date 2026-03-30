"use client";

import { useEffect, useState } from "react";

import { PLATFORM_OPTIONS, PAYOUT_OPTIONS, type CashbackAccount } from "@autocashback/domain";

const initialForm = {
  platformCode: "topcashback",
  accountName: "",
  registerEmail: "",
  payoutMethod: "paypal",
  notes: ""
};

export function AccountsManager() {
  const [accounts, setAccounts] = useState<CashbackAccount[]>([]);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadAccounts() {
    setLoading(true);
    const response = await fetch("/api/cashback-accounts");
    const payload = await response.json();
    setAccounts(payload.accounts || []);
    setLoading(false);
  }

  useEffect(() => {
    loadAccounts();
  }, []);

  async function submitForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const response = await fetch("/api/cashback-accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    });

    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error || "保存失败");
      return;
    }

    setForm(initialForm);
    await loadAccounts();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[360px,1fr]">
      <form className="surface-panel p-6" onSubmit={submitForm}>
        <p className="eyebrow">新增账号</p>
        <h3 className="mt-3 text-2xl font-semibold text-slate-900">返利网账号管理</h3>
        <div className="mt-5 space-y-4">
          <label className="block text-sm text-slate-700">
            平台
            <select
              className="mt-2 w-full rounded-2xl border border-brand-line bg-stone-50 px-4 py-3"
              value={form.platformCode}
              onChange={(event) => setForm({ ...form, platformCode: event.target.value })}
            >
              {PLATFORM_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm text-slate-700">
            账号名
            <input
              className="mt-2 w-full rounded-2xl border border-brand-line bg-stone-50 px-4 py-3"
              value={form.accountName}
              onChange={(event) => setForm({ ...form, accountName: event.target.value })}
            />
          </label>
          <label className="block text-sm text-slate-700">
            注册邮箱
            <input
              className="mt-2 w-full rounded-2xl border border-brand-line bg-stone-50 px-4 py-3"
              type="email"
              value={form.registerEmail}
              onChange={(event) => setForm({ ...form, registerEmail: event.target.value })}
            />
          </label>
          <label className="block text-sm text-slate-700">
            提现方式
            <select
              className="mt-2 w-full rounded-2xl border border-brand-line bg-stone-50 px-4 py-3"
              value={form.payoutMethod}
              onChange={(event) => setForm({ ...form, payoutMethod: event.target.value })}
            >
              {PAYOUT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm text-slate-700">
            备注
            <textarea
              className="mt-2 min-h-28 w-full rounded-2xl border border-brand-line bg-stone-50 px-4 py-3"
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
            />
          </label>
        </div>
        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
        <button className="mt-5 rounded-2xl bg-brand-emerald px-5 py-3 text-sm font-semibold text-white" type="submit">
          保存账号
        </button>
      </form>

      <div className="surface-panel p-6">
        <p className="eyebrow">账号列表</p>
        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-slate-500">
              <tr>
                <th className="pb-3">平台</th>
                <th className="pb-3">账号名</th>
                <th className="pb-3">注册邮箱</th>
                <th className="pb-3">提现方式</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="py-4 text-slate-500" colSpan={4}>
                    正在加载账号...
                  </td>
                </tr>
              ) : accounts.length ? (
                accounts.map((account) => (
                  <tr className="border-t border-brand-line/60" key={account.id}>
                    <td className="py-4">{account.platformCode}</td>
                    <td className="py-4 font-medium text-slate-900">{account.accountName}</td>
                    <td className="py-4">{account.registerEmail}</td>
                    <td className="py-4">{account.payoutMethod}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="py-4 text-slate-500" colSpan={4}>
                    还没有返利网账号，请先创建。
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
