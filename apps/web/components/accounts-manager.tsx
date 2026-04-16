"use client";

import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  type FormEvent
} from "react";
import Link from "next/link";
import {
  ArrowRight,
  CirclePlus,
  CreditCard,
  RefreshCcw,
  Search,
  Settings2,
  Target,
  WalletCards
} from "lucide-react";

import {
  PAYOUT_OPTIONS,
  PLATFORM_OPTIONS,
  type CashbackAccount,
  type OfferRecord
} from "@autocashback/domain";
import { cn } from "@autocashback/ui";

import { fetchJson } from "@/lib/api-error-handler";
import {
  buildAccountsConsole,
  type AccountsConsoleSort
} from "@/lib/accounts-console";

type AccountFormState = {
  platformCode: CashbackAccount["platformCode"];
  accountName: string;
  registerEmail: string;
  payoutMethod: CashbackAccount["payoutMethod"];
  notes: string;
  status: CashbackAccount["status"];
};

type MessageTone = "success" | "info";

const initialForm: AccountFormState = {
  platformCode: "topcashback",
  accountName: "",
  registerEmail: "",
  payoutMethod: "paypal",
  notes: "",
  status: "active"
};

const sortOptions: Array<{ value: AccountsConsoleSort; label: string }> = [
  { value: "recent", label: "按最新创建" },
  { value: "name", label: "按账号名" },
  { value: "platform", label: "按平台" },
  { value: "linked-offers", label: "按挂接 Offer 数" }
];

function OverviewCard({
  label,
  note,
  tone,
  value
}: {
  label: string;
  note: string;
  tone: "emerald" | "amber" | "slate";
  value: string;
}) {
  const toneStyles = {
    emerald: {
      badge: "bg-brand-mist text-brand-emerald",
      value: "text-brand-emerald"
    },
    amber: {
      badge: "bg-amber-50 text-amber-700",
      value: "text-amber-700"
    },
    slate: {
      badge: "bg-slate-100 text-slate-700",
      value: "text-slate-900"
    }
  } as const;

  return (
    <div className="surface-panel p-5">
      <span className={cn("inline-flex rounded-full px-3 py-1 text-xs font-semibold", toneStyles[tone].badge)}>
        {label}
      </span>
      <p className={cn("mt-5 font-mono text-4xl font-semibold", toneStyles[tone].value)}>{value}</p>
      <p className="mt-3 text-sm leading-6 text-slate-600">{note}</p>
    </div>
  );
}

function ShortcutCard({
  description,
  href,
  icon: Icon,
  title
}: {
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
}) {
  return (
    <Link
      className="group rounded-[24px] border border-brand-line bg-white/90 px-4 py-4 transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-editorial motion-reduce:transform-none"
      href={href}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-mist text-brand-emerald">
          <Icon className="h-5 w-5" />
        </span>
        <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:text-brand-emerald" />
      </div>
      <p className="mt-4 text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
    </Link>
  );
}

function statusMeta(status: CashbackAccount["status"]) {
  return status === "active"
    ? {
        label: "启用中",
        className: "bg-brand-mist text-brand-emerald"
      }
    : {
        label: "已暂停",
        className: "bg-amber-50 text-amber-700"
      };
}

export function AccountsManager() {
  const [accounts, setAccounts] = useState<CashbackAccount[]>([]);
  const [offers, setOffers] = useState<OfferRecord[]>([]);
  const [form, setForm] = useState<AccountFormState>(initialForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<MessageTone>("success");
  const [searchQuery, setSearchQuery] = useState("");
  const [platformFilter, setPlatformFilter] = useState<CashbackAccount["platformCode"] | "all">("all");
  const [statusFilter, setStatusFilter] = useState<CashbackAccount["status"] | "all">("all");
  const [payoutFilter, setPayoutFilter] = useState<CashbackAccount["payoutMethod"] | "all">("all");
  const [sort, setSort] = useState<AccountsConsoleSort>("recent");
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const allConsole = useMemo(
    () =>
      buildAccountsConsole(accounts, offers, {
        search: "",
        platformCode: "all",
        status: "all",
        payoutMethod: "all",
        sort: "recent"
      }),
    [accounts, offers]
  );

  const consoleData = useMemo(
    () =>
      buildAccountsConsole(accounts, offers, {
        search: deferredSearchQuery,
        platformCode: platformFilter,
        status: statusFilter,
        payoutMethod: payoutFilter,
        sort
      }),
    [accounts, deferredSearchQuery, offers, payoutFilter, platformFilter, sort, statusFilter]
  );

  const pausedRows = useMemo(
    () => allConsole.rows.filter((row) => row.account.status === "paused").slice(0, 3),
    [allConsole.rows]
  );
  const denseRows = useMemo(
    () => allConsole.rows.filter((row) => row.linkedOfferCount >= 2).slice(0, 3),
    [allConsole.rows]
  );

  async function loadData(options?: { background?: boolean; preserveNotice?: boolean }) {
    if (options?.background) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    if (!options?.preserveNotice) {
      setError("");
      setMessage("");
    }

    try {
      const [accountsResult, offersResult] = await Promise.all([
        fetchJson<{ accounts: CashbackAccount[] }>("/api/cashback-accounts", { cache: "no-store" }),
        fetchJson<{ offers: OfferRecord[] }>("/api/offers", { cache: "no-store" })
      ]);

      if (!accountsResult.success) {
        throw new Error(accountsResult.userMessage);
      }

      if (!offersResult.success) {
        throw new Error(offersResult.userMessage);
      }

      setAccounts(accountsResult.data.accounts || []);
      setOffers(offersResult.data.offers || []);
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : "加载账号数据失败");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  function resetForm() {
    setForm(initialForm);
    setEditingId(null);
    setError("");
  }

  function scrollEditorIntoView() {
    document.getElementById("account-editor")?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  function startCreateAccount() {
    resetForm();
    scrollEditorIntoView();
  }

  function clearFilters() {
    startTransition(() => {
      setSearchQuery("");
      setPlatformFilter("all");
      setStatusFilter("all");
      setPayoutFilter("all");
      setSort("recent");
    });
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setMessage("");

    if (!form.accountName.trim()) {
      setPending(false);
      setError("请填写账号名");
      return;
    }

    if (!form.registerEmail.trim()) {
      setPending(false);
      setError("请填写注册邮箱");
      return;
    }

    const result = await fetchJson<{ account: CashbackAccount }>("/api/cashback-accounts", {
      method: editingId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        editingId
          ? {
              id: editingId,
              ...form,
              accountName: form.accountName.trim(),
              registerEmail: form.registerEmail.trim(),
              notes: form.notes.trim()
            }
          : {
              ...form,
              accountName: form.accountName.trim(),
              registerEmail: form.registerEmail.trim(),
              notes: form.notes.trim()
            }
      )
    });

    setPending(false);

    if (!result.success) {
      setError(result.userMessage || "保存失败");
      return;
    }

    setMessageTone("success");
    setMessage(editingId ? "账号已更新。" : "账号已创建，可以继续去挂接 Offer。");
    resetForm();
    await loadData({ background: true, preserveNotice: true });
  }

  async function handleDelete(accountId: number) {
    if (!window.confirm("删除账号会同时删除其下 Offer 和换链接任务，确认继续？")) {
      return;
    }

    setError("");
    setMessage("");

    const result = await fetchJson<{ success: boolean }>("/api/cashback-accounts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: accountId })
    });

    if (!result.success) {
      setError(result.userMessage || "删除失败");
      return;
    }

    if (editingId === accountId) {
      resetForm();
    }

    setMessageTone("success");
    setMessage("账号已删除。");
    await loadData({ background: true, preserveNotice: true });
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
    scrollEditorIntoView();
  }

  const hasActiveFilters = Boolean(
    searchQuery.trim() ||
      platformFilter !== "all" ||
      statusFilter !== "all" ||
      payoutFilter !== "all" ||
      sort !== "recent"
  );

  return (
    <div className="space-y-6">
      <section className="surface-panel overflow-hidden p-0">
        <div className="border-b border-brand-line/70 px-6 py-6">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <p className="eyebrow">Accounts</p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <h2 className="text-3xl font-semibold text-slate-900">返利账号控制台</h2>
                <span className="rounded-full bg-brand-mist px-3 py-1 text-xs font-semibold text-brand-emerald">
                  {allConsole.overview.totalAccounts} accounts
                </span>
              </div>
              <p className="mt-4 text-sm leading-7 text-slate-600">
                在这里统一维护返利平台账号、收款方式和挂接的 Offer。先看账号覆盖，再补齐平台和投放归属。
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-brand-emerald px-5 py-3 text-sm font-semibold text-white"
                onClick={startCreateAccount}
                type="button"
              >
                <CirclePlus className="h-4 w-4" />
                新建账号
              </button>
              <button
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-brand-line bg-white px-5 py-3 text-sm font-semibold text-slate-700 disabled:opacity-60"
                disabled={refreshing}
                onClick={() => void loadData({ background: true, preserveNotice: true })}
                type="button"
              >
                <RefreshCcw className={cn("h-4 w-4", refreshing ? "animate-spin" : "")} />
                {refreshing ? "刷新中..." : "刷新列表"}
              </button>
            </div>
          </div>

          {error ? (
            <div className="mt-5 rounded-[24px] border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {message ? (
            <div
              className={cn(
                "mt-5 rounded-[24px] px-4 py-4 text-sm",
                messageTone === "success"
                  ? "border border-emerald-200 bg-brand-mist text-brand-emerald"
                  : "border border-slate-200 bg-stone-50 text-slate-700"
              )}
            >
              {message}
            </div>
          ) : null}
        </div>

        <div className="grid gap-4 px-6 py-6 md:grid-cols-2 xl:grid-cols-3">
          <ShortcutCard
            description="账号创建后通常下一步就是挂接 Offer，方便后续进入换链或补点击流程。"
            href="/offers"
            icon={Target}
            title="Offer 管理"
          />
          <ShortcutCard
            description="提现方式、平台备注和代理策略需要协同维护，避免后续任务执行出错。"
            href="/settings"
            icon={Settings2}
            title="系统设置"
          />
          <ShortcutCard
            description="Google Ads 已连接后，可以更快完成账号与投放侧的联动排查。"
            href="/google-ads"
            icon={WalletCards}
            title="Google Ads"
          />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-4">
        <OverviewCard
          label="启用账号"
          note="当前可正常挂接 Offer 的返利平台账号。"
          tone="emerald"
          value={String(allConsole.overview.activeAccounts)}
        />
        <OverviewCard
          label="暂停账号"
          note="已暂停的账号建议确认是否仍有 Offer 依赖。"
          tone={allConsole.overview.pausedAccounts > 0 ? "amber" : "emerald"}
          value={String(allConsole.overview.pausedAccounts)}
        />
        <OverviewCard
          label="挂接 Offer"
          note="所有账号下已绑定的 Offer 总数。"
          tone="slate"
          value={String(allConsole.overview.linkedOfferCount)}
        />
        <OverviewCard
          label="平台覆盖"
          note="当前已经启用的返利平台类型数量。"
          tone="emerald"
          value={String(allConsole.overview.platformCount)}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr),420px]">
        <div className="space-y-6">
          <section className="surface-panel p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="eyebrow">筛选与查看</p>
                <h3 className="mt-2 text-2xl font-semibold text-slate-900">先看账号覆盖，再决定补齐哪一类账号</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  支持按平台、状态、提现方式和挂接规模快速筛选，方便你优先处理关键账号。
                </p>
              </div>
              {hasActiveFilters ? (
                <button
                  className="rounded-full border border-brand-line bg-white px-4 py-2 text-xs font-semibold text-slate-700"
                  onClick={clearFilters}
                  type="button"
                >
                  清空筛选
                </button>
              ) : null}
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <label className="block text-sm font-medium text-slate-700 md:col-span-2 xl:col-span-1">
                搜索账号
                <div className="mt-2 flex items-center gap-3 rounded-2xl border border-brand-line bg-stone-50 px-4 py-3">
                  <Search className="h-4 w-4 text-slate-400" />
                  <input
                    className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="账号名、邮箱、备注、域名"
                    value={searchQuery}
                  />
                </div>
              </label>

              <label className="block text-sm font-medium text-slate-700">
                平台
                <select
                  className="mt-2 w-full rounded-2xl border border-brand-line bg-stone-50 px-4 py-3"
                  onChange={(event) =>
                    setPlatformFilter(event.target.value as CashbackAccount["platformCode"] | "all")
                  }
                  value={platformFilter}
                >
                  <option value="all">全部平台</option>
                  {PLATFORM_OPTIONS.map((option) => (
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
                  onChange={(event) =>
                    setStatusFilter(event.target.value as CashbackAccount["status"] | "all")
                  }
                  value={statusFilter}
                >
                  <option value="all">全部状态</option>
                  <option value="active">启用中</option>
                  <option value="paused">已暂停</option>
                </select>
              </label>

              <label className="block text-sm font-medium text-slate-700">
                提现方式
                <select
                  className="mt-2 w-full rounded-2xl border border-brand-line bg-stone-50 px-4 py-3"
                  onChange={(event) =>
                    setPayoutFilter(event.target.value as CashbackAccount["payoutMethod"] | "all")
                  }
                  value={payoutFilter}
                >
                  <option value="all">全部提现方式</option>
                  {PAYOUT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm font-medium text-slate-700">
                排序
                <select
                  className="mt-2 w-full rounded-2xl border border-brand-line bg-stone-50 px-4 py-3"
                  onChange={(event) => setSort(event.target.value as AccountsConsoleSort)}
                  value={sort}
                >
                  {sortOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          <section className="surface-panel overflow-hidden p-0">
            <div className="border-b border-brand-line/70 px-6 py-5">
              <p className="eyebrow">账号列表</p>
              <h3 className="mt-2 text-2xl font-semibold text-slate-900">按平台、角色和挂接规模管理账号</h3>
            </div>

            {loading ? (
              <div className="space-y-4 px-6 py-6">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div className="rounded-[24px] border border-brand-line bg-stone-50 px-4 py-5" key={index}>
                    <div className="h-4 w-32 animate-pulse rounded-full bg-stone-200" />
                    <div className="mt-4 h-4 w-full animate-pulse rounded-full bg-stone-200" />
                    <div className="mt-3 h-4 w-5/6 animate-pulse rounded-full bg-stone-200" />
                  </div>
                ))}
              </div>
            ) : consoleData.rows.length ? (
              <div className="overflow-x-auto px-6 py-6">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-slate-500">
                    <tr>
                      <th className="pb-3 pr-4">账号</th>
                      <th className="pb-3 pr-4">平台 / 提现</th>
                      <th className="pb-3 pr-4">邮箱</th>
                      <th className="pb-3 pr-4">挂接</th>
                      <th className="pb-3 pr-4">状态</th>
                      <th className="pb-3 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {consoleData.rows.map((row) => {
                      const currentStatus = statusMeta(row.account.status);

                      return (
                        <tr className="border-t border-brand-line/60 align-top" key={row.account.id}>
                          <td className="py-4 pr-4">
                            <div className="min-w-[220px]">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-semibold text-slate-900">{row.account.accountName}</p>
                                <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                                  {row.platformLabel}
                                </span>
                              </div>
                              <p className="mt-2 text-xs text-slate-500">
                                {row.account.notes?.trim() || "暂无运营备注"}
                              </p>
                            </div>
                          </td>

                          <td className="py-4 pr-4">
                            <div className="min-w-[140px]">
                              <p className="text-slate-700">{row.platformLabel}</p>
                              <p className="mt-2 text-xs text-slate-500">{row.payoutLabel}</p>
                            </div>
                          </td>

                          <td className="py-4 pr-4">
                            <div className="min-w-[180px]">
                              <p className="text-slate-700">{row.account.registerEmail}</p>
                              <p className="mt-2 text-xs text-slate-500">{row.emailDomain || "--"}</p>
                            </div>
                          </td>

                          <td className="py-4 pr-4">
                            <div className="min-w-[140px]">
                              <p className="font-mono text-slate-700">{row.linkedOfferCount}</p>
                              <p className="mt-2 text-xs text-slate-500">
                                {row.linkedOfferCount > 0 ? "已挂接 Offer" : "尚未挂接 Offer"}
                              </p>
                            </div>
                          </td>

                          <td className="py-4 pr-4">
                            <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", currentStatus.className)}>
                              {currentStatus.label}
                            </span>
                          </td>

                          <td className="py-4">
                            <div className="flex min-w-[160px] flex-wrap justify-end gap-2">
                              <button
                                className="rounded-full border border-brand-line bg-white px-3 py-2 text-xs font-semibold text-slate-700"
                                onClick={() => handleEdit(row.account)}
                                type="button"
                              >
                                编辑
                              </button>
                              <button
                                className="rounded-full border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600"
                                onClick={() => void handleDelete(row.account.id)}
                                type="button"
                              >
                                删除
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="px-6 py-10 text-center">
                <p className="text-base font-semibold text-slate-900">
                  {hasActiveFilters ? "当前筛选条件下没有账号" : "还没有返利账号"}
                </p>
                <p className="mt-3 text-sm leading-6 text-slate-500">
                  先创建返利平台账号，再继续挂接 Offer 和自动化任务。
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-3">
                  {hasActiveFilters ? (
                    <button
                      className="rounded-2xl border border-brand-line bg-white px-5 py-3 text-sm font-semibold text-slate-700"
                      onClick={clearFilters}
                      type="button"
                    >
                      清空筛选
                    </button>
                  ) : null}
                  <button
                    className="rounded-2xl bg-brand-emerald px-5 py-3 text-sm font-semibold text-white"
                    onClick={startCreateAccount}
                    type="button"
                  >
                    新建账号
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <section className="surface-panel p-6" id="account-editor">
            <p className="eyebrow">{editingId ? "编辑账号" : "新建账号"}</p>
            <h3 className="mt-2 text-2xl font-semibold text-slate-900">
              {editingId ? "更新当前返利账号" : "补齐新的返利平台账号"}
            </h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              建议按运营人、平台角色或国家维度命名，后续在 Offer 和任务页更容易识别。
            </p>

            <form className="mt-6 space-y-4" onSubmit={submitForm}>
              <label className="block text-sm font-medium text-slate-700">
                平台
                <select
                  className="mt-2 w-full rounded-2xl border border-brand-line bg-stone-50 px-4 py-3 outline-none transition focus:border-brand-emerald focus:bg-white"
                  onChange={(event) =>
                    setForm({
                      ...form,
                      platformCode: event.target.value as CashbackAccount["platformCode"]
                    })
                  }
                  value={form.platformCode}
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
                  className="mt-2 w-full rounded-2xl border border-brand-line bg-stone-50 px-4 py-3 outline-none transition placeholder:text-slate-400 focus:border-brand-emerald focus:bg-white"
                  onChange={(event) => setForm({ ...form, accountName: event.target.value })}
                  placeholder="例如：TopCashback-US-Main"
                  value={form.accountName}
                />
              </label>

              <label className="block text-sm font-medium text-slate-700">
                注册邮箱
                <input
                  className="mt-2 w-full rounded-2xl border border-brand-line bg-stone-50 px-4 py-3 outline-none transition placeholder:text-slate-400 focus:border-brand-emerald focus:bg-white"
                  onChange={(event) => setForm({ ...form, registerEmail: event.target.value })}
                  placeholder="用于登录或收款确认的邮箱"
                  type="email"
                  value={form.registerEmail}
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium text-slate-700">
                  提现方式
                  <select
                    className="mt-2 w-full rounded-2xl border border-brand-line bg-stone-50 px-4 py-3 outline-none transition focus:border-brand-emerald focus:bg-white"
                    onChange={(event) =>
                      setForm({
                        ...form,
                        payoutMethod: event.target.value as CashbackAccount["payoutMethod"]
                      })
                    }
                    value={form.payoutMethod}
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
                    className="mt-2 w-full rounded-2xl border border-brand-line bg-stone-50 px-4 py-3 outline-none transition focus:border-brand-emerald focus:bg-white"
                    onChange={(event) =>
                      setForm({
                        ...form,
                        status: event.target.value as CashbackAccount["status"]
                      })
                    }
                    value={form.status}
                  >
                    <option value="active">启用中</option>
                    <option value="paused">已暂停</option>
                  </select>
                </label>
              </div>

              <label className="block text-sm font-medium text-slate-700">
                备注
                <textarea
                  className="mt-2 min-h-28 w-full rounded-2xl border border-brand-line bg-stone-50 px-4 py-3 outline-none transition placeholder:text-slate-400 focus:border-brand-emerald focus:bg-white"
                  onChange={(event) => setForm({ ...form, notes: event.target.value })}
                  placeholder="记录收款规则、登录注意事项、账号负责人等"
                  value={form.notes}
                />
              </label>

              <div className="flex flex-wrap gap-3 pt-2">
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
          </section>

          <section className="surface-panel p-6">
            <p className="eyebrow">重点提醒</p>
            <h3 className="mt-2 text-2xl font-semibold text-slate-900">优先检查这些账号</h3>

            <div className="mt-5 space-y-4">
              {pausedRows.map((row) => (
                <button
                  className="w-full rounded-[24px] border border-brand-line bg-white px-4 py-4 text-left transition hover:bg-stone-50"
                  key={`paused-${row.account.id}`}
                  onClick={() => handleEdit(row.account)}
                  type="button"
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
                      <CreditCard className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">{row.account.accountName}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        当前账号已暂停，建议确认是否仍有挂接 Offer 或是否需要重新启用。
                      </p>
                    </div>
                  </div>
                </button>
              ))}

              {denseRows.map((row) => (
                <button
                  className="w-full rounded-[24px] border border-brand-line bg-white px-4 py-4 text-left transition hover:bg-stone-50"
                  key={`dense-${row.account.id}`}
                  onClick={() => handleEdit(row.account)}
                  type="button"
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl bg-brand-mist text-brand-emerald">
                      <WalletCards className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">{row.account.accountName}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        当前已挂接 {row.linkedOfferCount} 个 Offer，属于核心账号，建议保证备注和收款方式信息完整。
                      </p>
                    </div>
                  </div>
                </button>
              ))}

              {!pausedRows.length && !denseRows.length ? (
                <div className="rounded-[24px] border border-brand-line bg-stone-50 px-4 py-4 text-sm leading-6 text-slate-600">
                  当前没有明显需要优先处理的账号，可以继续补齐新的平台账号。
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}
