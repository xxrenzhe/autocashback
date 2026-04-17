import fs from 'fs';
const file = 'components/accounts-manager.tsx';
let content = fs.readFileSync(file, 'utf8');

// Add imports
content = content.replace(
  'import {\n  startTransition,\n  useDeferredValue,\n  useEffect,\n  useMemo,\n  useState,\n  type FormEvent\n} from "react";\nimport Link from "next/link";',
  `import {\n  startTransition,\n  useDeferredValue,\n  useEffect,\n  useMemo,\n  useState,\n  type FormEvent,\n  useCallback\n} from "react";\nimport Link from "next/link";\nimport { useRouter, usePathname, useSearchParams } from "next/navigation";`
);

// Replace state initialization with searchParams reading
const stateInitRegex = /const \[searchQuery, setSearchQuery\] = useState\(""\);\n  const \[platformFilter, setPlatformFilter\] = useState<CashbackAccount\["platformCode"\] \| "all"\>\("all"\);\n  const \[statusFilter, setStatusFilter\] = useState<CashbackAccount\["status"\] \| "all"\>\("all"\);\n  const \[payoutFilter, setPayoutFilter\] = useState<CashbackAccount\["payoutMethod"\] \| "all"\>\("all"\);\n  const \[sort, setSort\] = useState<AccountsConsoleSort>\("recent"\);/;

const newStateInit = `const router = useRouter();
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
  };`;

content = content.replace(stateInitRegex, newStateInit);

// Update clearFilters
content = content.replace(/function clearFilters\(\) {[\s\S]*?setSort\("recent"\);\n    \}\);\n  \}/, `function clearFilters() {
    startTransition(() => {
      setSearchQueryState("");
      setPlatformFilterState("all");
      setStatusFilterState("all");
      setPayoutFilterState("all");
      setSortState("recent");
      router.replace(pathname, { scroll: false });
    });
  }`);

fs.writeFileSync(file, content);
console.log("Updated URL state sync in accounts-manager");
