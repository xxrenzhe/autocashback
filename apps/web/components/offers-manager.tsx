"use client";

import { formatDateTime } from "@/lib/format";

import {
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  useCallback
} from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { SheetFrame } from "./sheet-frame";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CirclePlus,
  Link2,
  MoreHorizontal,
  RefreshCcw,
  Search,
  Target,
  WalletCards
} from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";

import {
  PLATFORM_OPTIONS,
  type CashbackAccount,
  type OfferRecord
} from "@autocashback/domain";
import {
  EmptyState,
  PageHeader,
  ShortcutCard,
  StatCard,
  StatSkeleton,
  StatusBadge,
  TableSkeleton,
  cn,
  getStatusBadgeMeta
} from "@autocashback/ui";
import { toast } from "sonner";

import { ClickFarmTaskDialog } from "@/components/click-farm-task-dialog";
import { LinkSwapTaskDialog } from "@/components/link-swap-task-dialog";
import { fetchJson } from "@/lib/api-error-handler";
import {
  buildOffersConsole,
  type OfferConsoleSort
} from "@/lib/offers-console";
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

const sortOptions: Array<{ value: OfferConsoleSort; label: string }> = [
  { value: "recent", label: "按最新创建" },
  { value: "brand", label: "按品牌名称" },
  { value: "commission-progress", label: "按佣金进度" },
  { value: "remaining-cap", label: "按剩余额度" }
];
function offerStatusVariant(status: OfferRecord["status"]) {
  switch (status) {
    case "warning":
      return "warning" as const;
    case "active":
      return "running" as const;
    case "draft":
    default:
      return "pending" as const;
  }
}

export function OffersManager() {
  const [offers, setOffers] = useState<OfferRecord[]>([]);
  const [accounts, setAccounts] = useState<CashbackAccount[]>([]);
  const [form, setForm] = useState<OfferFormState>(initialForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
        const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [editorOpen, setEditorOpen] = useState(false);

  const [searchQuery, setSearchQueryState] = useState(searchParams.get("q") || "");
  const [platformFilter, setPlatformFilterState] = useState<OfferRecord["platformCode"] | "all">(
    (searchParams.get("platform") as OfferRecord["platformCode"]) || "all"
  );
  const [statusFilter, setStatusFilterState] = useState<OfferRecord["status"] | "all">(
    (searchParams.get("status") as OfferRecord["status"]) || "all"
  );
  const [countryFilter, setCountryFilterState] = useState(searchParams.get("country") || "all");
  const [resolutionFilter, setResolutionFilterState] = useState<"all" | "resolved" | "unresolved">(
    (searchParams.get("resolution") as "all" | "resolved" | "unresolved") || "all"
  );
  const [sort, setSortState] = useState<OfferConsoleSort>(
    (searchParams.get("sort") as OfferConsoleSort) || "recent"
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
  const setPlatformFilter = (val: OfferRecord["platformCode"] | "all") => {
    setPlatformFilterState(val);
    router.replace(pathname + "?" + createQueryString("platform", val), { scroll: false });
  };
  const setStatusFilter = (val: OfferRecord["status"] | "all") => {
    setStatusFilterState(val);
    router.replace(pathname + "?" + createQueryString("status", val), { scroll: false });
  };
  const setCountryFilter = (val: string) => {
    setCountryFilterState(val);
    router.replace(pathname + "?" + createQueryString("country", val), { scroll: false });
  };
  const setResolutionFilter = (val: "all" | "resolved" | "unresolved") => {
    setResolutionFilterState(val);
    router.replace(pathname + "?" + createQueryString("resolution", val), { scroll: false });
  };
  const setSort = (val: OfferConsoleSort) => {
    setSortState(val);
    router.replace(pathname + "?" + createQueryString("sort", val), { scroll: false });
  };
  const [activeClickFarmOffer, setActiveClickFarmOffer] = useState<OfferRecord | null>(null);
  const [activeLinkSwapOffer, setActiveLinkSwapOffer] = useState<OfferRecord | null>(null);
  const [taskActionLoading, setTaskActionLoading] = useState<string | null>(null);
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const filteredAccounts = useMemo(
    () => accounts.filter((account) => account.platformCode === form.platformCode),
    [accounts, form.platformCode]
  );

  const allConsole = useMemo(
    () =>
      buildOffersConsole(offers, accounts, {
        search: "",
        platformCode: "all",
        status: "all",
        targetCountry: "all",
        resolution: "all",
        sort: "recent"
      }),
    [accounts, offers]
  );

  const consoleData = useMemo(
    () =>
      buildOffersConsole(offers, accounts, {
        search: deferredSearchQuery,
        platformCode: platformFilter,
        status: statusFilter,
        targetCountry: countryFilter,
        resolution: resolutionFilter,
        sort
      }),
    [accounts, countryFilter, deferredSearchQuery, offers, platformFilter, resolutionFilter, sort, statusFilter]
  );

  const warningRows = useMemo(
    () => allConsole.rows.filter((row) => row.thresholdReached).slice(0, 3),
    [allConsole.rows]
  );
  const unresolvedRows = useMemo(
    () => allConsole.rows.filter((row) => !row.hasResolvedSuffix).slice(0, 3),
    [allConsole.rows]
  );

  const hasActiveFilters = Boolean(
    searchQuery.trim() ||
      platformFilter !== "all" ||
      statusFilter !== "all" ||
      countryFilter !== "all" ||
      resolutionFilter !== "all" ||
      sort !== "recent"
  );

  async function loadAll(options?: { background?: boolean; preserveNotice?: boolean }) {
    if (options?.background) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const [offersResult, accountsResult] = await Promise.all([
        fetchJson<{ offers: OfferRecord[] }>("/api/offers", { cache: "no-store" }),
        fetchJson<{ accounts: CashbackAccount[] }>("/api/cashback-accounts", { cache: "no-store" })
      ]);

      if (!offersResult.success) {
        throw new Error(offersResult.userMessage);
      }

      if (!accountsResult.success) {
        throw new Error(accountsResult.userMessage);
      }

      setOffers(offersResult.data.offers || []);
      setAccounts(accountsResult.data.accounts || []);
    } catch {
      toast.error("加载数据失败");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, []);

  

  function resetForm() {
    setForm(initialForm);
    setEditingId(null);
    setEditorOpen(false);
  }

  function startCreateOffer() {
    setForm(initialForm);
    setEditingId(null);
    setEditorOpen(true);
  }

  function applyFilters(next: Partial<{
    searchQuery: string;
    platformFilter: OfferRecord["platformCode"] | "all";
    statusFilter: OfferRecord["status"] | "all";
    countryFilter: string;
    resolutionFilter: "all" | "resolved" | "unresolved";
    sort: OfferConsoleSort;
  }>) {
    const params = new URLSearchParams(searchParams.toString());
    
    if (next.searchQuery !== undefined) {
      setSearchQueryState(next.searchQuery);
      if (next.searchQuery) params.set("q", next.searchQuery); else params.delete("q");
    }
    if (next.platformFilter !== undefined) {
      setPlatformFilterState(next.platformFilter);
      if (next.platformFilter !== "all") params.set("platform", next.platformFilter); else params.delete("platform");
    }
    if (next.statusFilter !== undefined) {
      setStatusFilterState(next.statusFilter);
      if (next.statusFilter !== "all") params.set("status", next.statusFilter); else params.delete("status");
    }
    if (next.countryFilter !== undefined) {
      setCountryFilterState(next.countryFilter);
      if (next.countryFilter !== "all") params.set("country", next.countryFilter); else params.delete("country");
    }
    if (next.resolutionFilter !== undefined) {
      setResolutionFilterState(next.resolutionFilter);
      if (next.resolutionFilter !== "all") params.set("resolution", next.resolutionFilter); else params.delete("resolution");
    }
    if (next.sort !== undefined) {
      setSortState(next.sort);
      if (next.sort !== "recent") params.set("sort", next.sort); else params.delete("sort");
    }
    
    router.replace(pathname + "?" + params.toString(), { scroll: false });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);

    if (!form.promoLink.trim()) {
      setPending(false);
      toast.error("请填写必填项");
      return;
    }

    if (!form.brandName.trim()) {
      setPending(false);
      toast.error("请填写必填项");
      return;
    }

    if (!form.cashbackAccountId) {
      setPending(false);
      toast.error("请选择返利网账号");
      return;
    }

    const payload = {
      ...form,
      promoLink: form.promoLink.trim(),
      brandName: form.brandName.trim(),
      campaignLabel: form.campaignLabel.trim(),
      cashbackAccountId: Number(form.cashbackAccountId),
      targetCountry: form.targetCountry.trim().toUpperCase(),
      commissionCapUsd: Number(form.commissionCapUsd),
      manualRecordedCommissionUsd: Number(form.manualRecordedCommissionUsd)
    };

    const result = await fetchJson<{ offer: OfferRecord }>("/api/offers", {
      method: editingId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editingId ? { id: editingId, ...payload } : payload)
    });

    setPending(false);

    if (!result.success) {
      toast.error(result.userMessage || "保存失败");
      return;
    }

    toast.success(editingId ? "Offer 已更新" : "Offer 已创建");
    resetForm();
    await loadAll({ background: true, preserveNotice: true });
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
            setEditorOpen(true);
  }

  async function handleDelete(offerId: number) {
    if (!window.confirm("删除 Offer 会同步删除换链接任务与执行日志，确认继续？")) {
      return;
    }

        
    const result = await fetchJson<{ success: boolean }>("/api/offers", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: offerId })
    });

    if (!result.success) {
      toast.error(result.userMessage || "删除失败");
      return;
    }

    if (editingId === offerId) {
      resetForm();
    }

    toast.success("Offer 已删除");
    await loadAll({ background: true, preserveNotice: true });
  }

  async function openClickFarmTask(offer: OfferRecord) {
    setTaskActionLoading(`click-farm-${offer.id}`);

    try {
      const { infoMessage } = await resolveClickFarmTaskMode(offer.id);
      if (infoMessage) {
        toast.info(infoMessage);
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
        toast.info(infoMessage);
      }
      setActiveLinkSwapOffer(offer);
    } finally {
      setTaskActionLoading(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <>
            <button
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white"
              onClick={startCreateOffer}
              type="button"
            >
              <CirclePlus className="h-4 w-4" />
              新建 Offer
            </button>
            <button
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground disabled:opacity-60"
              disabled={refreshing}
              onClick={() => void loadAll({ background: true, preserveNotice: true })}
              type="button"
            >
              <RefreshCcw className={cn("h-4 w-4", refreshing ? "animate-spin" : "")} />
              {refreshing ? "刷新中…" : "刷新列表"}
            </button>
          </>
        }
      />

      <section className="bg-card text-card-foreground rounded-xl border shadow-sm overflow-hidden p-0">
        <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
          <Link href="/accounts">
            <ShortcutCard
              description="维护返利平台账号、邮箱和平台归属，确保 Offer 可以正确绑定。"
              icon={WalletCards}
              title="账号管理"
              trailing={<ArrowRight className="h-4 w-4 text-muted-foreground/80 transition group-hover:text-primary" />}
            />
          </Link>
          <Link href="/link-swap">
            <ShortcutCard
              description="检查换链任务执行状态、suffix 历史和脚本接入是否正常。"
              icon={Link2}
              title="换链管理"
              trailing={<ArrowRight className="h-4 w-4 text-muted-foreground/80 transition group-hover:text-primary" />}
            />
          </Link>
          <Link href="/google-ads">
            <ShortcutCard
              description="确认 Google Ads 授权、客户号和账户映射是否齐备。"
              icon={Target}
              title="Google Ads"
              trailing={<ArrowRight className="h-4 w-4 text-muted-foreground/80 transition group-hover:text-primary" />}
            />
          </Link>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-4">
        {loading ? (
          <>
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
          </>
        ) : (
          <>
            <StatCard
              label="Offer 总数"
              note="当前账号下正在维护的全部 Offer。"
              tone="slate"
              value={String(allConsole.overview.totalOffers)}
            />
            <StatCard
              label="阈值预警"
              note="佣金已达到或超过上限，需要确认是否停投。"
              tone={allConsole.overview.warningOffers > 0 ? "amber" : "emerald"}
              value={String(allConsole.overview.warningOffers)}
            />
            <StatCard
              label="待解析 Suffix"
              note="尚未拿到最新 suffix 的 Offer，建议优先检查换链链路。"
              tone={allConsole.overview.unresolvedSuffixCount > 0 ? "amber" : "emerald"}
              value={String(allConsole.overview.unresolvedSuffixCount)}
            />
            <StatCard
              label="覆盖国家"
              note="当前 Offer 覆盖的投放国家数量。"
              tone="emerald"
              value={String(allConsole.overview.coveredCountryCount)}
            />
          </>
        )}
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr),420px]">
        <div className="space-y-6">
          <section className="bg-card text-card-foreground rounded-xl border shadow-sm p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">筛选与行动</p>
                <h3 className="mt-2 text-xl font-semibold tracking-tight text-foreground">先聚焦需要处理的 Offer</h3>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  支持按平台、状态、国家、suffix 完整度与佣金排序快速定位问题。
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {allConsole.overview.warningOffers > 0 ? (
                  <button
                    className="rounded-full bg-amber-500/10 px-4 py-2 text-xs font-semibold text-amber-600"
                    onClick={() =>
                      applyFilters({
                        statusFilter: "warning",
                        resolutionFilter: "all",
                        sort: "remaining-cap"
                      })
                    }
                    type="button"
                  >
                    查看阈值预警
                  </button>
                ) : null}
                {allConsole.overview.unresolvedSuffixCount > 0 ? (
                  <button
                    className="rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold text-foreground"
                    onClick={() =>
                      applyFilters({
                        resolutionFilter: "unresolved",
                        statusFilter: "all"
                      })
                    }
                    type="button"
                  >
                    查看待解析 suffix
                  </button>
                ) : null}
                {hasActiveFilters ? (
                  <button
                    className="rounded-full border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground"
                    onClick={() =>
                      applyFilters({
                        searchQuery: "",
                        platformFilter: "all",
                        statusFilter: "all",
                        countryFilter: "all",
                        resolutionFilter: "all",
                        sort: "recent"
                      })
                    }
                    type="button"
                  >
                    清空筛选
                  </button>
                ) : null}
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <label className="block text-sm font-medium text-foreground md:col-span-2 xl:col-span-1">
                搜索 Offer
                <div className="mt-2 flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2">
                  <Search className="h-4 w-4 text-muted-foreground/80" />
                  <input
                    className="w-full bg-transparent text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring placeholder:text-muted-foreground/80"
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="品牌、Campaign、账号、国家或链接"
                    value={searchQuery}
                  />
                </div>
              </label>

              <label className="block text-sm font-medium text-foreground">
                平台
                <select
                  className="mt-2 w-full rounded-lg border border-border bg-muted/40 px-3 py-2"
                  onChange={(event) =>
                    setPlatformFilter(event.target.value as OfferRecord["platformCode"] | "all")
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
                    setStatusFilter(event.target.value as OfferRecord["status"] | "all")
                  }
                  value={statusFilter}
                >
                  <option value="all">全部状态</option>
                  <option value="active">运行中</option>
                  <option value="warning">阈值预警</option>
                  <option value="draft">待完善</option>
                </select>
              </label>

              <label className="block text-sm font-medium text-foreground">
                国家
                <select
                  className="mt-2 w-full rounded-lg border border-border bg-muted/40 px-3 py-2"
                  onChange={(event) => setCountryFilter(event.target.value)}
                  value={countryFilter}
                >
                  <option value="all">全部国家</option>
                  {allConsole.countryOptions.map((country) => (
                    <option key={country} value={country}>
                      {country}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm font-medium text-foreground">
                Suffix 状态
                <select
                  className="mt-2 w-full rounded-lg border border-border bg-muted/40 px-3 py-2"
                  onChange={(event) =>
                    setResolutionFilter(event.target.value as "all" | "resolved" | "unresolved")
                  }
                  value={resolutionFilter}
                >
                  <option value="all">全部</option>
                  <option value="resolved">已解析</option>
                  <option value="unresolved">待解析</option>
                </select>
              </label>

              <label className="block text-sm font-medium text-foreground">
                排序
                <select
                  className="mt-2 w-full rounded-lg border border-border bg-muted/40 px-3 py-2"
                  onChange={(event) => setSort(event.target.value as OfferConsoleSort)}
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

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/40 p-4">
              <div>
                <p className="text-sm font-semibold text-foreground">当前结果 {consoleData.rows.length} 条</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {deferredSearchQuery !== searchQuery ? "正在整理列表..." : "筛选结果会保留所有现有任务操作入口。"}
                </p>
              </div>
              <span className="rounded-full bg-background px-3 py-1 text-xs font-semibold text-muted-foreground shadow-sm">
                绑定账号 {allConsole.overview.linkedAccountCount}
              </span>
            </div>
          </section>

          <section className="bg-card text-card-foreground rounded-xl border shadow-sm overflow-hidden p-0">
            <div className="border-b border-border/70 p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">Offer 列表</p>
              <h3 className="mt-2 text-xl font-semibold tracking-tight text-foreground">按健康度和动作入口管理 Offer</h3>
            </div>

            {loading ? (
              <TableSkeleton className="m-5" rows={6} />
            ) : consoleData.rows.length ? (
              <div className="overflow-x-auto p-5">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-muted-foreground font-medium text-xs border-b border-border sticky top-0 bg-background/95 backdrop-blur z-10">
                    <tr>
                      <th className="pb-3 pr-4">Offer</th>
                      <th className="pb-3 pr-4">账号</th>
                      <th className="pb-3 pr-4">佣金进度</th>
                      <th className="pb-3 pr-4">最新 suffix</th>
                      <th className="pb-3 pr-4">状态</th>
                      <th className="pb-3 text-right">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {consoleData.rows.map((row) => {
                      const { offer } = row;
                      const offerStatus = offerStatusVariant(offer.status);
                      const offerStatusMeta = getStatusBadgeMeta(offerStatus);

                      return (
                        <tr className="border-b border-border hover:bg-muted/30 transition-colors" key={offer.id}>
                          <td className="py-4 pr-4">
                            <div className="min-w-[240px]">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-semibold text-foreground">{offer.brandName}</p>
                                <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                                  {row.platformLabel}
                                </span>
                                <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                                  {offer.targetCountry}
                                </span>
                              </div>
                              <p className="mt-2 text-xs text-muted-foreground">
                                {offer.campaignLabel || "未填写 Campaign Label"}
                              </p>
                              <p className="mt-2 max-w-[340px] break-all text-xs leading-5 text-muted-foreground">
                                {offer.promoLink}
                              </p>
                            </div>
                          </td>

                          <td className="py-4 pr-4">
                            <div className="min-w-[180px]">
                              <p className="font-medium text-foreground">
                                {row.accountName || `账号 #${offer.cashbackAccountId}`}
                              </p>
                              <p className="mt-2 text-xs text-muted-foreground">
                                {row.accountStatus === "paused" ? "账号已暂停" : "账号状态正常"}
                              </p>
                            </div>
                          </td>

                          <td className="py-4 pr-4">
                            <div className="min-w-[180px]">
                              <p className="font-mono tabular-nums text-foreground">
                                {offer.manualRecordedCommissionUsd.toFixed(2)} / {offer.commissionCapUsd.toFixed(2)}
                              </p>
                              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-stone-200">
                                <div
                                  className={cn(
                                    "h-full rounded-full",
                                    row.thresholdReached ? "bg-amber-500/100" : "bg-primary"
                                  )}
                                  style={{ width: `${row.progressRatio}%` }}
                                />
                              </div>
                              <p className="mt-2 text-xs text-muted-foreground">
                                还可记录 {row.remainingCommissionUsd.toFixed(2)} USD
                              </p>
                            </div>
                          </td>

                          <td className="py-4 pr-4">
                            <div className="min-w-[220px]">
                              <p className="break-all font-mono tabular-nums text-xs text-muted-foreground">
                                {offer.latestResolvedSuffix || "尚未解析到 suffix"}
                              </p>
                              <p className="mt-2 text-xs text-muted-foreground">
                                最近解析：{formatDateTime(offer.lastResolvedAt)}
                              </p>
                            </div>
                          </td>

                          <td className="py-4 pr-4">
                            <StatusBadge label={offerStatusMeta.label} variant={offerStatus} />
                          </td>

                          <td className="py-4">
                            <div className="flex min-w-[220px] flex-wrap justify-end gap-2">
                              <button
                                className="rounded-full border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground"
                                onClick={() => handleEdit(offer)}
                                type="button"
                              >
                                编辑
                              </button>
                              <DropdownMenu.Root>
                                <DropdownMenu.Trigger asChild>
                                  <button
                                    className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground disabled:opacity-60"
                                    disabled={Boolean(taskActionLoading)}
                                    type="button"
                                  >
                                    <MoreHorizontal className="h-3.5 w-3.5" />
                                    更多
                                  </button>
                                </DropdownMenu.Trigger>
                                <DropdownMenu.Portal>
                                  <DropdownMenu.Content
                                    align="end"
                                    className="z-50 min-w-[180px] rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg"
                                    sideOffset={6}
                                  >
                                    <DropdownMenu.Item
                                      className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm outline-none hover:bg-muted focus:bg-muted data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50"
                                      disabled={taskActionLoading === `click-farm-${offer.id}`}
                                      onSelect={() => void openClickFarmTask(offer)}
                                    >
                                      {taskActionLoading === `click-farm-${offer.id}` ? "加载中..." : "补点击任务"}
                                    </DropdownMenu.Item>
                                    <DropdownMenu.Item
                                      className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm outline-none hover:bg-muted focus:bg-muted data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50"
                                      disabled={taskActionLoading === `link-swap-${offer.id}`}
                                      onSelect={() => void openLinkSwapTask(offer)}
                                    >
                                      {taskActionLoading === `link-swap-${offer.id}` ? "加载中..." : "换链任务"}
                                    </DropdownMenu.Item>
                                    <DropdownMenu.Separator className="my-1 h-px bg-border" />
                                    <DropdownMenu.Item
                                      className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-destructive outline-none hover:bg-destructive/10 focus:bg-destructive/10"
                                      onSelect={() => void handleDelete(offer.id)}
                                    >
                                      删除 Offer
                                    </DropdownMenu.Item>
                                  </DropdownMenu.Content>
                                </DropdownMenu.Portal>
                              </DropdownMenu.Root>
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
                        onClick={() =>
                          applyFilters({
                            searchQuery: "",
                            platformFilter: "all",
                            statusFilter: "all",
                            countryFilter: "all",
                            resolutionFilter: "all",
                            sort: "recent"
                          })
                        }
                        type="button"
                      >
                        清空筛选
                      </button>
                    ) : null}
                    <button
                      className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white"
                      onClick={startCreateOffer}
                      type="button"
                    >
                      新建 Offer
                    </button>
                  </div>
                }
                className="m-6"
                description={
                  hasActiveFilters
                    ? "可以放宽筛选条件，或者直接新建新的 Offer。"
                    : "先创建 Offer 并绑定返利账号，后续才能继续补点击或换链。"
                }
                icon={WalletCards}
                title={hasActiveFilters ? "当前筛选条件下没有 Offer" : "还没有 Offer"}
              />
            )}
          </section>
        </div>

        <div className="space-y-6">
          <SheetFrame
            open={editorOpen}
            onClose={resetForm}
            eyebrow={editingId ? "编辑 Offer" : "新建 Offer"}
            title={editingId ? "更新当前 Offer" : "补齐新的投放条目"}
            description="这里维护单个 Offer 的链接、归属平台、绑定账号和佣金阈值。保存后可以继续配置补点击或换链任务。"
          >
            <form className="space-y-4" onSubmit={handleSubmit}>
              <label className="block text-sm font-medium text-foreground">
                推广链接
                <textarea
                  className="mt-2 min-h-28 w-full rounded-lg border border-border bg-muted/40 px-3 py-2 transition placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring "
                  onChange={(event) => setForm({ ...form, promoLink: event.target.value })}
                  placeholder="填写返利站的推广链接"
                  value={form.promoLink}
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium text-foreground">
                  推广国家
                  <input
                    className="mt-2 w-full rounded-lg border border-border bg-muted/40 px-3 py-2 uppercase transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring "
                    maxLength={8}
                    onChange={(event) =>
                      setForm({ ...form, targetCountry: event.target.value.toUpperCase() })
                    }
                    value={form.targetCountry}
                  />
                </label>

                <label className="block text-sm font-medium text-foreground">
                  品牌名
                  <input
                    className="mt-2 w-full rounded-lg border border-border bg-muted/40 px-3 py-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring "
                    onChange={(event) => setForm({ ...form, brandName: event.target.value })}
                    value={form.brandName}
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium text-foreground">
                  返利网平台
                  <select
                    className="mt-2 w-full rounded-lg border border-border bg-muted/40 px-3 py-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring "
                    onChange={(event) =>
                      setForm({
                        ...form,
                        platformCode: event.target.value as OfferRecord["platformCode"],
                        cashbackAccountId: ""
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
                  返利网账号
                  <select
                    className="mt-2 w-full rounded-lg border border-border bg-muted/40 px-3 py-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring "
                    onChange={(event) => setForm({ ...form, cashbackAccountId: event.target.value })}
                    value={form.cashbackAccountId}
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

              {!filteredAccounts.length ? (
                <div className="rounded-xl border border-amber-200 bg-amber-500/10 p-4 text-sm text-amber-600">
                  当前平台下还没有可绑定的返利账号。请先去
                  {" "}
                  <Link className="font-semibold underline" href="/accounts">
                    账号管理
                  </Link>
                  {" "}
                  补齐账号。
                </div>
              ) : null}

              <label className="block text-sm font-medium text-foreground">
                Campaign Label
                <input
                  className="mt-2 w-full rounded-lg border border-border bg-muted/40 px-3 py-2 transition placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring "
                  onChange={(event) => setForm({ ...form, campaignLabel: event.target.value })}
                  placeholder="用于识别广告侧投放或内部命名"
                  value={form.campaignLabel}
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium text-foreground">
                  佣金阈值 USD
                  <input
                    className="mt-2 w-full rounded-lg border border-border bg-muted/40 px-3 py-2 font-mono tabular-nums transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring "
                    min={0}
                    onChange={(event) =>
                      setForm({ ...form, commissionCapUsd: Number(event.target.value) })
                    }
                    step="0.01"
                    type="number"
                    value={form.commissionCapUsd}
                  />
                </label>

                <label className="block text-sm font-medium text-foreground">
                  已记录佣金 USD
                  <input
                    className="mt-2 w-full rounded-lg border border-border bg-muted/40 px-3 py-2 font-mono tabular-nums transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring "
                    min={0}
                    onChange={(event) =>
                      setForm({ ...form, manualRecordedCommissionUsd: Number(event.target.value) })
                    }
                    step="0.01"
                    type="number"
                    value={form.manualRecordedCommissionUsd}
                  />
                </label>
              </div>

              {form.manualRecordedCommissionUsd >= form.commissionCapUsd ? (
                <div className="rounded-xl border border-amber-200 bg-amber-500/10 p-4 text-sm text-amber-600">
                  当前佣金已达到阈值，保存后 Offer 会进入预警状态，建议尽快核查是否需要停投。
                </div>
              ) : null}

              <div className="flex flex-wrap gap-3 pt-6">
                <button
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 w-full"
                  disabled={pending}
                  type="submit"
                >
                  {pending ? "保存中…" : editingId ? "更新 Offer" : "创建 Offer"}
                </button>
              </div>
            </form>
          </SheetFrame>
          <section className="bg-card text-card-foreground rounded-xl border shadow-sm p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">重点提醒</p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight text-foreground">优先处理这些 Offer</h3>

            <div className="mt-5 space-y-4">
              {warningRows.map((row) => (
                <button
                  className="w-full rounded-xl border border-border bg-background p-4 text-left transition hover:bg-muted/40"
                  key={`warning-${row.offer.id}`}
                  onClick={() => handleEdit(row.offer)}
                  type="button"
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
                      <AlertTriangle className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{row.offer.brandName}</p>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        佣金已达到 {row.offer.manualRecordedCommissionUsd.toFixed(2)} /{" "}
                        {row.offer.commissionCapUsd.toFixed(2)} USD，建议确认是否停投。
                      </p>
                    </div>
                  </div>
                </button>
              ))}

              {unresolvedRows.map((row) => (
                <button
                  className="w-full rounded-xl border border-border bg-background p-4 text-left transition hover:bg-muted/40"
                  key={`unresolved-${row.offer.id}`}
                  onClick={() => void openLinkSwapTask(row.offer)}
                  type="button"
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-foreground">
                      <Link2 className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{row.offer.brandName}</p>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        还没有解析到最新 suffix，可以直接打开换链任务继续处理。
                      </p>
                    </div>
                  </div>
                </button>
              ))}

              {!warningRows.length && !unresolvedRows.length ? (
                <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm leading-6 text-muted-foreground">
                  当前没有明显的 Offer 风险项，适合继续新增条目或补齐账号映射。
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </section>

      <ClickFarmTaskDialog
        offer={activeClickFarmOffer}
        open={Boolean(activeClickFarmOffer)}
        onClose={() => setActiveClickFarmOffer(null)}
        onSaved={() => void loadAll({ background: true, preserveNotice: true })}
      />
      <LinkSwapTaskDialog
        offer={activeLinkSwapOffer}
        open={Boolean(activeLinkSwapOffer)}
        onClose={() => setActiveLinkSwapOffer(null)}
        onSaved={() => void loadAll({ background: true, preserveNotice: true })}
      />
    </div>
  );
}
