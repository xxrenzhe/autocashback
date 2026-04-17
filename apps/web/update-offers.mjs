import fs from 'fs';
const file = 'components/offers-manager.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add missing imports
content = content.replace(
  'import {\n  startTransition,\n  useDeferredValue,\n  useEffect,\n  useMemo,\n  useState,\n  type FormEvent\n} from "react";',
  'import {\n  startTransition,\n  useDeferredValue,\n  useEffect,\n  useMemo,\n  useState,\n  type FormEvent,\n  useCallback\n} from "react";\nimport { useRouter, usePathname, useSearchParams } from "next/navigation";\nimport { SheetFrame } from "./sheet-frame";'
);

// 2. Replace state init with URL Search params
const stateRegex = /const \[searchQuery, setSearchQuery\] = useState\(""\);\n  const \[platformFilter, setPlatformFilter\] = useState<OfferRecord\["platformCode"\] \| "all"\>\("all"\);\n  const \[statusFilter, setStatusFilter\] = useState<OfferRecord\["status"\] \| "all"\>\("all"\);\n  const \[countryFilter, setCountryFilter\] = useState\("all"\);\n  const \[resolutionFilter, setResolutionFilter\] = useState<"all" \| "resolved" \| "unresolved"\>\("all"\);\n  const \[sort, setSort\] = useState<OfferConsoleSort>\("recent"\);/;

const newStateInit = `const router = useRouter();
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
  };`;

content = content.replace(stateRegex, newStateInit);

// 3. Update form/modal toggles
content = content.replace(
  /function resetForm\(\) \{[\s\S]*?setError\(""\);\n  \}/,
  `function resetForm() {\n    setForm(initialForm);\n    setEditingId(null);\n    setError("");\n    setEditorOpen(false);\n  }`
);
content = content.replace(
  /function startCreateOffer\(\) \{[\s\S]*?scrollEditorIntoView\(\);\n  \}/,
  `function startCreateOffer() {\n    setForm(initialForm);\n    setEditingId(null);\n    setError("");\n    setEditorOpen(true);\n  }`
);
content = content.replace(
  /function handleEdit[\s\S]*?scrollEditorIntoView\(\);\n  \}/,
  `function handleEdit(offer: OfferRecord) {\n    setEditingId(offer.id);\n    setForm({\n      promoLink: offer.promoLink,\n      targetCountry: offer.targetCountry,\n      brandName: offer.brandName,\n      platformCode: offer.platformCode,\n      cashbackAccountId: String(offer.cashbackAccountId),\n      campaignLabel: offer.campaignLabel,\n      commissionCapUsd: offer.commissionCapUsd,\n      manualRecordedCommissionUsd: offer.manualRecordedCommissionUsd\n    });\n    setError("");\n    setMessage("");\n    setEditorOpen(true);\n  }`
);

// 4. applyFilters fix for routing
content = content.replace(
  /function applyFilters\([^)]*\) \{[\s\S]*?\}\);\n  \}/,
  `function applyFilters(next: Partial<{
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
  }`
);

// 5. Replace inline <section id="offer-editor"> with <SheetFrame>
const regex = /<section className="bg-card text-card-foreground rounded-xl border shadow-sm p-5" id="offer-editor">[\s\S]*?(?=          <section className="bg-card text-card-foreground rounded-xl border shadow-sm p-5">\n            <p className="text-xs font-semibold uppercase tracking-wider text-primary">重点提醒<\/p>)/;

const newSheet = `<SheetFrame
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
          </SheetFrame>\n`;

content = content.replace(regex, newSheet);

fs.writeFileSync(file, content);
console.log("Updated offers-manager");
