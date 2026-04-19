"use client";

import {
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  useCallback
} from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  CirclePlus,
  CreditCard,
  RefreshCcw,
  Search,
  Target,
  WalletCards
} from "lucide-react";

import {
  PAYOUT_OPTIONS,
  PLATFORM_OPTIONS,
  type CashbackAccount,
  type OfferRecord
} from "@autocashback/domain";
import { EmptyState, PageHeader, StatCard, StatusBadge, TableSkeleton, cn } from "@autocashback/ui";
import { toast } from "sonner";

import { fetchJson } from "@/lib/api-error-handler";
import { SheetFrame } from "./sheet-frame";
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

export function AccountsManager() {
  const [accounts, setAccounts] = useState<CashbackAccount[]>([]);
  const [offers, setOffers] = useState<OfferRecord[]>([]);
  const [form, setForm] = useState<AccountFormState>(initialForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pending, setPending] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [searchQuery, setSearchQueryState] = useState(searchParams.get("q") || "");
  const [platformFilter, setPlatformFilterState] = useState<CashbackAccount["platformCode"] | "all">(
    (searchParams.get("platform") as CashbackAccount["platformCode"]) || "all"
  );
  const [statusFilter, setStatusFilterState] = useState<CashbackAccount["status"] | "all">(
    (searchParams.get("status") as CashbackAccount["status"]) || "all"
  );
  const [payoutFilter, setPayoutFilterState] = useState<CashbackAccount["payoutMethod"] | "all">(
    (searchParams.get("payout") as CashbackAccount["payoutMethod"]) || "all"
  );
  const [sort, setSortState] = useState<AccountsConsoleSort>(
    (searchParams.get("sort") as AccountsConsoleSort) || "recent"
  );

  const createQueryString = useCallback(
    (name: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value && value !== "all") {
        params.set(name, value);
      } else {
        params.delete(name);
      }
      return params.toString();
    },
    [searchParams]
  );

  const setSearchQuery = (val: string) => {
    setSearchQueryState(val);
    router.replace(pathname + "?" + createQueryString("q", val), { scroll: false });
  };
  const setPlatformFilter = (val: CashbackAccount["platformCode"] | "all") => {
    setPlatformFilterState(val);
    router.replace(pathname + "?" + createQueryString("platform", val), { scroll: false });
  };
  const setStatusFilter = (val: CashbackAccount["status"] | "all") => {
    setStatusFilterState(val);
    router.replace(pathname + "?" + createQueryString("status", val), { scroll: false });
  };
  const setPayoutFilter = (val: CashbackAccount["payoutMethod"] | "all") => {
    setPayoutFilterState(val);
    router.replace(pathname + "?" + createQueryString("payout", val), { scroll: false });
  };
  const setSort = (val: AccountsConsoleSort) => {
    setSortState(val);
    router.replace(pathname + "?" + createQueryString("sort", val), { scroll: false });
  };
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

  async function loadData(options?: { background?: boolean; preserveNotice?: boolean }) {
    if (options?.background) {
      setRefreshing(true);
    } else {
      setLoading(true);
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
    } catch {
      toast.error("加载数据失败");
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
    setEditorOpen(false);
  }

  function startCreateAccount() {
    setForm(initialForm);
    setEditingId(null);
    setEditorOpen(true);
  }

  function clearFilters() {
    startTransition(() => {
      setSearchQueryState("");
      setPlatformFilterState("all");
      setStatusFilterState("all");
      setPayoutFilterState("all");
      setSortState("recent");
      router.replace(pathname, { scroll: false });
    });
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);

    if (!form.accountName.trim()) {
      setPending(false);
      toast.error("请填写必填项");
      return;
    }

    if (!form.registerEmail.trim()) {
      setPending(false);
      toast.error("请填写必填项");
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
      toast.error(result.userMessage || "保存失败");
      return;
    }

    toast.success(editingId ? "账号已更新" : "账号已创建");
    resetForm();
    await loadData({ background: true, preserveNotice: true });
  }

  async function handleDelete(accountId: number) {
    if (!window.confirm("删除账号会同时删除其下 Offer 和换链接任务，确认继续？")) {
      return;
    }

    const result = await fetchJson<{ success: boolean }>("/api/cashback-accounts", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: accountId })
    });

    if (!result.success) {
      toast.error(result.userMessage || "删除失败");
      return;
    }

    if (editingId === accountId) {
      resetForm();
    }

    toast.success("账号已删除");
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
    setEditorOpen(true);
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
      <PageHeader
        actions={
          <div className="flex flex-wrap gap-3">
            <button
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white"
              onClick={startCreateAccount}
              type="button"
            >
              <CirclePlus className="h-4 w-4" />
              新建账号
            </button>
            <button
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground disabled:opacity-60"
              disabled={refreshing}
              onClick={() => void loadData({ background: true, preserveNotice: true })}
              type="button"
            >
              <RefreshCcw className={cn("h-4 w-4", refreshing ? "animate-spin" : "")} />
              {refreshing ? "刷新中…" : "刷新列表"}
            </button>
          </div>
        }
        eyebrow="Accounts"
        title={
          <span className="flex flex-wrap items-center gap-3">
            <span>返利账号控制台</span>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              {allConsole.overview.totalAccounts} accounts
            </span>
          </span>
        }
      />

      <section className="grid gap-4 xl:grid-cols-4">
        <StatCard
          icon={CreditCard}
          label="启用账号"
          note="当前可正常挂接 Offer 的返利平台账号。"
          tone="emerald"
          value={String(allConsole.overview.activeAccounts)}
        />
        <StatCard
          icon={CreditCard}
          label="暂停账号"
          note="已暂停的账号建议确认是否仍有 Offer 依赖。"
          tone={allConsole.overview.pausedAccounts > 0 ? "amber" : "emerald"}
          value={String(allConsole.overview.pausedAccounts)}
        />
        <StatCard
          icon={Target}
          label="挂接 Offer"
          note="所有账号下已绑定的 Offer 总数。"
          tone="slate"
          value={String(allConsole.overview.linkedOfferCount)}
        />
        <StatCard
          icon={WalletCards}
          label="平台覆盖"
          note="当前已经启用的返利平台类型数量。"
          tone="emerald"
          value={String(allConsole.overview.platformCount)}
        />
      </section>

      <section className="space-y-6">
          <section className="bg-card text-card-foreground rounded-xl border shadow-sm p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">筛选</p>
                <h3 className="mt-2 text-xl font-semibold tracking-tight text-foreground">按平台、状态和挂接规模筛选账号</h3>
              </div>
              {hasActiveFilters ? (
                <button
                  className="rounded-full border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground"
                  onClick={clearFilters}
                  type="button"
                >
                  清空筛选
                </button>
              ) : null}
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <label className="block text-sm font-medium text-foreground md:col-span-2 xl:col-span-1">
                搜索账号
                <div className="mt-2 flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2">
                  <Search className="h-4 w-4 text-muted-foreground/80" />
                  <input
                    className="w-full bg-transparent text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring placeholder:text-muted-foreground/80"
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="账号名、邮箱、备注、域名"
                    value={searchQuery}
                  />
                </div>
              </label>

              <label className="block text-sm font-medium text-foreground">
                平台
                <select
                  className="mt-2 w-full rounded-lg border border-border bg-muted/40 px-3 py-2"
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

              <label className="block text-sm font-medium text-foreground">
                状态
                <select
                  className="mt-2 w-full rounded-lg border border-border bg-muted/40 px-3 py-2"
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

              <label className="block text-sm font-medium text-foreground">
                提现方式
                <select
                  className="mt-2 w-full rounded-lg border border-border bg-muted/40 px-3 py-2"
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

              <label className="block text-sm font-medium text-foreground">
                排序
                <select
                  className="mt-2 w-full rounded-lg border border-border bg-muted/40 px-3 py-2"
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

          <section className="bg-card text-card-foreground rounded-xl border shadow-sm overflow-hidden p-0">
            <div className="border-b border-border/70 p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">账号列表</p>
              <h3 className="mt-2 text-xl font-semibold tracking-tight text-foreground">按平台、角色和挂接规模管理账号</h3>
            </div>

            {loading ? (
              <TableSkeleton className="m-5" rows={6} />
            ) : consoleData.rows.length ? (
              <div className="overflow-x-auto p-5">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-muted-foreground font-medium text-xs border-b border-border sticky top-0 bg-background/95 backdrop-blur z-10">
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
                      return (
                        <tr className="border-b border-border hover:bg-muted/30 transition-colors" key={row.account.id}>
                          <td className="py-4 pr-4">
                            <div className="min-w-[220px]">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-semibold text-foreground">{row.account.accountName}</p>
                                <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                                  {row.platformLabel}
                                </span>
                              </div>
                              <p className="mt-2 text-xs text-muted-foreground">
                                {row.account.notes?.trim() || "暂无运营备注"}
                              </p>
                            </div>
                          </td>

                          <td className="py-4 pr-4">
                            <div className="min-w-[140px]">
                              <p className="text-foreground">{row.platformLabel}</p>
                              <p className="mt-2 text-xs text-muted-foreground">{row.payoutLabel}</p>
                            </div>
                          </td>

                          <td className="py-4 pr-4">
                            <div className="min-w-[180px]">
                              <p className="text-foreground">{row.account.registerEmail}</p>
                              <p className="mt-2 text-xs text-muted-foreground">{row.emailDomain || "--"}</p>
                            </div>
                          </td>

                          <td className="py-4 pr-4">
                            <div className="min-w-[140px]">
                              <p className="font-mono tabular-nums text-foreground">{row.linkedOfferCount}</p>
                              <p className="mt-2 text-xs text-muted-foreground">
                                {row.linkedOfferCount > 0 ? "已挂接 Offer" : "尚未挂接 Offer"}
                              </p>
                            </div>
                          </td>

                          <td className="py-4 pr-4">
                            <StatusBadge
                              label={row.account.status === "active" ? "启用中" : "已暂停"}
                              variant={row.account.status === "active" ? "active" : "warning"}
                            />
                          </td>

                          <td className="py-4">
                            <div className="flex min-w-[160px] flex-wrap justify-end gap-2">
                              <button
                                className="rounded-full border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground"
                                onClick={() => handleEdit(row.account)}
                                type="button"
                              >
                                编辑
                              </button>
                              <button
                                className="rounded-full border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive"
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
              <EmptyState
                action={
                  <div className="flex flex-wrap justify-center gap-3">
                    {hasActiveFilters ? (
                      <button
                        className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground"
                        onClick={clearFilters}
                        type="button"
                      >
                        清空筛选
                      </button>
                    ) : null}
                    <button
                      className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white"
                      onClick={startCreateAccount}
                      type="button"
                    >
                      新建账号
                    </button>
                  </div>
                }
                description="创建账号后再挂接 Offer。"
                icon={WalletCards}
                title={hasActiveFilters ? "当前筛选条件下没有账号" : "还没有返利账号"}
              />
            )}
          </section>
        <SheetFrame
            open={editorOpen}
            onClose={resetForm}
            eyebrow={editingId ? "编辑账号" : "新建账号"}
            title={editingId ? "更新当前返利账号" : "补齐新的返利平台账号"}
          >
            <form className="space-y-4" onSubmit={submitForm}>
              <label className="block text-sm font-medium text-foreground">
                平台
                <select
                  className="mt-2 w-full rounded-lg border border-border bg-muted/40 px-3 py-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring "
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

              <label className="block text-sm font-medium text-foreground">
                账号名
                <input
                  className="mt-2 w-full rounded-lg border border-border bg-muted/40 px-3 py-2 transition placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring "
                  onChange={(event) => setForm({ ...form, accountName: event.target.value })}
                  placeholder="例如：TopCashback-US-Main"
                  value={form.accountName}
                />
              </label>

              <label className="block text-sm font-medium text-foreground">
                注册邮箱
                <input
                  className="mt-2 w-full rounded-lg border border-border bg-muted/40 px-3 py-2 transition placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring "
                  onChange={(event) => setForm({ ...form, registerEmail: event.target.value })}
                  placeholder="用于登录或收款确认的邮箱"
                  type="email"
                  value={form.registerEmail}
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium text-foreground">
                  提现方式
                  <select
                    className="mt-2 w-full rounded-lg border border-border bg-muted/40 px-3 py-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring "
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

                <label className="block text-sm font-medium text-foreground">
                  状态
                  <select
                    className="mt-2 w-full rounded-lg border border-border bg-muted/40 px-3 py-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring "
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

              <label className="block text-sm font-medium text-foreground">
                备注
                <textarea
                  className="mt-2 min-h-28 w-full rounded-lg border border-border bg-muted/40 px-3 py-2 transition placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring "
                  onChange={(event) => setForm({ ...form, notes: event.target.value })}
                  placeholder="记录收款规则、登录注意事项、账号负责人等"
                  value={form.notes}
                />
              </label>

              <div className="flex flex-wrap gap-3 pt-6">
                <button
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 w-full"
                  disabled={pending}
                  type="submit"
                >
                  {pending ? "保存中…" : editingId ? "更新账号" : "创建账号"}
                </button>
              </div>
            </form>
          </SheetFrame>
      </section>
    </div>
  );
}
