"use client";

import { useEffect, useState } from "react";

import { PLATFORM_OPTIONS, PAYOUT_OPTIONS, type CashbackAccount } from "@autocashback/domain";

type AccountFormState = {
  platformCode: CashbackAccount["platformCode"];
  accountName: string;
  registerEmail: string;
  payoutMethod: CashbackAccount["payoutMethod"];
  notes: string;
  status: CashbackAccount["status"];
};

const initialForm: AccountFormState = {
  platformCode: "topcashback",
  accountName: "",
  registerEmail: "",
  payoutMethod: "paypal",
  notes: "",
  status: "active"
};

const payoutLabelMap = Object.fromEntries(PAYOUT_OPTIONS.map((option) => [option.value, option.label]));
const platformLabelMap = Object.fromEntries(PLATFORM_OPTIONS.map((option) => [option.value, option.label]));

export function AccountsManager() {
  const [accounts, setAccounts] = useState<CashbackAccount[]>([]);
  const [form, setForm] = useState<AccountFormState>(initialForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

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

  function resetForm() {
    setForm(initialForm);
    setEditingId(null);
    setError("");
  }

  async function submitForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setMessage("");

    const response = await fetch("/api/cashback-accounts", {
      method: editingId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editingId ? { id: editingId, ...form } : form)
    });

    const payload = await response.json();
    setPending(false);

    if (!response.ok) {
      setError(payload.error || "保存失败");
      return;
    }

    setMessage(editingId ? "账号已更新" : "账号已创建");
    resetForm();
    await loadAccounts();
  }

  async function handleDelete(accountId: number) {
    if (!window.confirm("删除账号会同时删除其下 Offer 和换链接任务，确认继续？")) {
      return;
    }

    setError("");
    setMessage("");

    const response = await fetch("/api/cashback-accounts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: accountId })
    });
    const payload = await response.json();

    if (!response.ok) {
      setError(payload.error || "删除失败");
      return;
    }

    if (editingId === accountId) {
      resetForm();
    }

    setMessage("账号已删除");
    await loadAccounts();
  }

  function handleEdit(account: CashbackAccount) {
    setEditingId(account.id);
    setForm({
      platformCode: account.platformCode,
      accountName: account.accountName,
      registerEmail: account.registerEmail,
      payoutMethod: account.payoutMethod,
      notes: account.notes || "",
      status: account.status
    });
    setMessage("");
    setError("");
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[420px,1fr]">
      <form className="surface-panel p-6" onSubmit={submitForm}>
        <p className="eyebrow">{editingId ? "编辑账号" : "新增账号"}</p>
        <h3 className="mt-3 text-2xl font-semibold text-slate-900">返利网账号管理</h3>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          支持同平台多账号。建议按运营人、收款方式或投放国家命名，方便区分。
        </p>

        <div className="mt-6 space-y-4">
          <label className="block text-sm font-medium text-slate-700">
            平台
            <select
              className="mt-2 w-full rounded-2xl border border-brand-line bg-stone-50 px-4 py-3"
              value={form.platformCode}
              onChange={(event) =>
                setForm({ ...form, platformCode: event.target.value as CashbackAccount["platformCode"] })
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
            账号名
            <input
              className="mt-2 w-full rounded-2xl border border-brand-line bg-stone-50 px-4 py-3"
              placeholder="例如：TopCashback-US-Main"
              value={form.accountName}
              onChange={(event) => setForm({ ...form, accountName: event.target.value })}
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            注册邮箱
            <input
              className="mt-2 w-full rounded-2xl border border-brand-line bg-stone-50 px-4 py-3"
              type="email"
              value={form.registerEmail}
              onChange={(event) => setForm({ ...form, registerEmail: event.target.value })}
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            提现方式
            <select
              className="mt-2 w-full rounded-2xl border border-brand-line bg-stone-50 px-4 py-3"
              value={form.payoutMethod}
              onChange={(event) =>
                setForm({ ...form, payoutMethod: event.target.value as CashbackAccount["payoutMethod"] })
              }
            >
              {PAYOUT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-medium text-slate-700">
            状态
            <select
              className="mt-2 w-full rounded-2xl border border-brand-line bg-stone-50 px-4 py-3"
              value={form.status}
              onChange={(event) =>
                setForm({ ...form, status: event.target.value as CashbackAccount["status"] })
              }
            >
              <option value="active">active</option>
              <option value="paused">paused</option>
            </select>
          </label>

          <label className="block text-sm font-medium text-slate-700">
            备注
            <textarea
              className="mt-2 min-h-28 w-full rounded-2xl border border-brand-line bg-stone-50 px-4 py-3"
              placeholder="记录收款规则、登录注意事项、账号负责人等"
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
            />
          </label>
        </div>

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
        {message ? <p className="mt-4 text-sm text-brand-emerald">{message}</p> : null}

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            className="rounded-2xl bg-brand-emerald px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
            disabled={pending}
            type="submit"
          >
            {pending ? "保存中..." : editingId ? "更新账号" : "创建账号"}
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
            <p className="eyebrow">账号列表</p>
            <h3 className="mt-2 text-2xl font-semibold text-slate-900">已录入返利网账号</h3>
          </div>
          <span className="rounded-full bg-stone-100 px-3 py-2 font-mono text-xs text-slate-600">
            {accounts.length} accounts
          </span>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-slate-500">
              <tr>
                <th className="pb-3">平台</th>
                <th className="pb-3">账号名</th>
                <th className="pb-3">注册邮箱</th>
                <th className="pb-3">提现方式</th>
                <th className="pb-3">状态</th>
                <th className="pb-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="py-4 text-slate-500" colSpan={6}>
                    正在加载账号...
                  </td>
                </tr>
              ) : accounts.length ? (
                accounts.map((account) => (
                  <tr className="border-t border-brand-line/60 align-top" key={account.id}>
                    <td className="py-4">{platformLabelMap[account.platformCode] || account.platformCode}</td>
                    <td className="py-4 font-medium text-slate-900">
                      <p>{account.accountName}</p>
                      {account.notes ? <p className="mt-1 max-w-xs text-xs text-slate-500">{account.notes}</p> : null}
                    </td>
                    <td className="py-4">{account.registerEmail}</td>
                    <td className="py-4">{payoutLabelMap[account.payoutMethod] || account.payoutMethod}</td>
                    <td className="py-4">
                      <span className="rounded-full bg-stone-100 px-3 py-1 text-xs uppercase tracking-wide text-slate-600">
                        {account.status}
                      </span>
                    </td>
                    <td className="py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          className="rounded-full border border-brand-line bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                          onClick={() => handleEdit(account)}
                          type="button"
                        >
                          编辑
                        </button>
                        <button
                          className="rounded-full border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600"
                          onClick={() => handleDelete(account.id)}
                          type="button"
                        >
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="py-6 text-slate-500" colSpan={6}>
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
