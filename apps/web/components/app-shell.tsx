"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Boxes,
  ChevronLeft,
  ChevronRight,
  Circle,
  LayoutDashboard,
  Link2,
  ListOrdered,
  LogOut,
  Menu,
  Settings,
  Shield,
  Target,
  Users2,
  WalletCards,
  X
} from "lucide-react";

import { cn, PageHeaderProvider } from "@autocashback/ui";
import { Toaster } from "sonner";
import type { CurrentUser } from "@autocashback/domain";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const userLinks: NavItem[] = [
  { href: "/dashboard", label: "仪表盘", icon: LayoutDashboard },
  { href: "/accounts", label: "账号管理", icon: Users2 },
  { href: "/offers", label: "Offer 管理", icon: WalletCards },
  { href: "/link-swap", label: "换链接管理", icon: Link2 },
  { href: "/google-ads", label: "Google Ads", icon: Target },
  { href: "/click-farm", label: "补点击任务", icon: Boxes },
  { href: "/settings", label: "系统设置", icon: Settings }
];

const adminLinks: NavItem[] = [
  { href: "/queue", label: "任务队列", icon: ListOrdered },
  { href: "/admin/users", label: "用户管理", icon: Shield }
];

const roleLabels = {
  admin: "管理员",
  user: "普通用户"
} as const;

const pageDescriptions: Record<string, string> = {
  "/dashboard": "先确认 Offer、换链和账号的核心状态，再进入对应模块处理动作和风险。",
  "/accounts": "在这里统一维护返利平台账号、收款方式和挂接的 Offer。先看账号覆盖，再补齐平台和投放归属。",
  "/offers": "管理 Offer 投放信息、佣金阈值和运营状态。",
  "/link-swap": "查看换链接任务、解析结果与脚本对接状态。",
  "/google-ads": "先确认基础配置、OAuth 状态和可访问账号数量，再决定是去设置页补参数，还是直接同步和诊断。",
  "/click-farm": "统一查看补点击任务的节奏、成功率和暂停原因。先处理异常任务，再补齐新的 Offer 任务。",
  "/settings": "先确认代理、Google Ads、平台备注和脚本是否就绪，再进入对应分组修改具体配置。",
  "/queue": "先看队列并发、调度器状态和系统运行压力，再进入业务运营面板处理具体风险。",
  "/admin/users": "管理后台用户、权限与跨账号运营边界。"
};

function isActivePath(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function resolveCurrentNav(pathname: string) {
  return [...userLinks, ...adminLinks]
    .filter((item) => isActivePath(pathname, item.href))
    .sort((left, right) => right.href.length - left.href.length)[0];
}

function NavSection({
  items,
  label,
  pathname,
  collapsed,
  variant = "default"
}: {
  items: NavItem[];
  label: string;
  pathname: string;
  collapsed: boolean;
  variant?: "admin" | "default";
}) {
  const activeClassName =
    variant === "admin"
      ? "bg-violet-500/10 text-violet-700"
      : "bg-primary/10 text-primary";
  const iconActiveClassName = variant === "admin" ? "text-violet-700" : "text-primary";
  const labelClassName =
    variant === "admin"
      ? "flex items-center gap-2 px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-violet-700"
      : "px-3 pb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider";

  return (
    <div>
      {!collapsed ? (
        <p className={labelClassName}>
          {variant === "admin" ? <Shield className="h-3 w-3" /> : null}
          {label}
        </p>
      ) : null}
      <nav className="space-y-1">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActivePath(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors",
                collapsed ? "justify-center" : "gap-3",
                active ? activeClassName : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon
                className={cn(
                  "h-4 w-4 flex-shrink-0",
                  active ? iconActiveClassName : "text-muted-foreground group-hover:text-foreground"
                )}
                aria-hidden="true"
              />
              {!collapsed ? <span className="truncate">{item.label}</span> : null}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function AppShell({
  user,
  children
}: {
  user: CurrentUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [healthStatus, setHealthStatus] = useState<"healthy" | "loading" | "stale" | "unhealthy">("loading");

  const displayName = user.username || user.email;
  const userInitial = displayName.slice(0, 1).toUpperCase();
  const roleLabel = roleLabels[user.role] ?? user.role;
  const currentNav = resolveCurrentNav(pathname);
  const pageTitle = currentNav?.label ?? "管理后台";
  const pageDescription = pageDescriptions[currentNav?.href ?? "/dashboard"] ?? pageDescriptions["/dashboard"];

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;

    async function loadHealth() {
      try {
        const response = await fetch("/api/health", { cache: "no-store" });
        const payload = (await response.json()) as { checks?: { scheduler?: string }; status?: string };
        if (cancelled) {
          return;
        }

        if (payload.checks?.scheduler === "stale") {
          setHealthStatus("stale");
          return;
        }

        setHealthStatus(payload.status === "healthy" ? "healthy" : "unhealthy");
      } catch {
        if (!cancelled) {
          setHealthStatus("unhealthy");
        }
      }
    }

    void loadHealth();
    const timer = window.setInterval(() => {
      void loadHealth();
    }, 60_000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const healthMeta = {
    healthy: {
      className: "text-primary",
      label: "系统健康"
    },
    loading: {
      className: "text-slate-300",
      label: "正在检查系统状态"
    },
    stale: {
      className: "text-amber-500",
      label: "调度心跳延迟"
    },
    unhealthy: {
      className: "text-destructive",
      label: "系统异常"
    }
  }[healthStatus];

  return (
    <div className="min-h-screen bg-muted/30">
      <Toaster position="bottom-right" richColors />
      {/* Mobile Nav Overlay */}
      {mobileNavOpen ? (
        <button
          aria-label="关闭导航菜单"
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileNavOpen(false)}
          type="button"
        />
      ) : null}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r bg-background transition-transform duration-300 lg:z-40",
          mobileNavOpen ? "translate-x-0" : "-translate-x-full",
          "lg:translate-x-0",
          sidebarOpen ? "lg:w-64" : "lg:w-20"
        )}
      >
        <div className="flex h-14 items-center justify-between border-b px-4">
          <Link
            className={cn(
              "flex items-center gap-2 transition-opacity hover:opacity-80",
              sidebarOpen ? "justify-start" : "mx-auto justify-center"
            )}
            href="/dashboard"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded bg-primary text-primary-foreground font-bold">
              AC
            </div>
            {sidebarOpen ? (
              <span className="font-semibold tracking-tight">AutoCashBack</span>
            ) : null}
          </Link>

          <button
            aria-label="关闭导航"
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden"
            onClick={() => setMobileNavOpen(false)}
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-1 flex-col overflow-hidden px-3 py-4">
          <div className="flex-1 space-y-6 overflow-y-auto">
            <NavSection collapsed={!sidebarOpen} items={userLinks} label="运营中心" pathname={pathname} />

            {user.role === "admin" ? (
              <NavSection
                collapsed={!sidebarOpen}
                items={adminLinks}
                label="系统管理"
                pathname={pathname}
                variant="admin"
              />
            ) : null}
          </div>

          <div className="mt-4 border-t pt-4">
            <Link
              href="/settings#account-security-settings"
              className={cn(
                "mb-2 flex items-center rounded-md px-3 py-2 transition-colors hover:bg-muted",
                sidebarOpen ? "justify-between" : "justify-center"
              )}
              title={!sidebarOpen ? "打开账号设置" : undefined}
            >
              <div className={cn("flex items-center gap-2", sidebarOpen ? "" : "justify-center")}>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                  {userInitial}
                </div>
                {sidebarOpen ? (
                  <div className="flex flex-col min-w-0">
                    <span className="truncate text-sm font-medium text-foreground">{displayName}</span>
                    <span className="truncate text-xs text-muted-foreground">{roleLabel}</span>
                  </div>
                ) : null}
              </div>
            </Link>

            <button
              className={cn(
                "flex w-full items-center rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive",
                sidebarOpen ? "gap-3" : "justify-center"
              )}
              onClick={logout}
              type="button"
            >
              <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
              {sidebarOpen ? <span>退出登录</span> : null}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className={cn("min-h-screen transition-[padding] duration-300", sidebarOpen ? "lg:pl-64" : "lg:pl-20")}>
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <button
              aria-label="打开导航菜单"
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden"
              onClick={() => setMobileNavOpen(true)}
              type="button"
            >
              <Menu className="h-5 w-5" />
            </button>
            <button
              aria-label={sidebarOpen ? "收起侧边栏" : "展开侧边栏"}
              className="hidden rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:block"
              onClick={() => setSidebarOpen((current) => !current)}
              type="button"
            >
              {sidebarOpen ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
            </button>
          </div>
          <div className="flex items-center gap-3">
            <span
              aria-label={healthMeta.label}
              className="inline-flex h-2.5 w-2.5 rounded-full"
              title={healthMeta.label}
            >
              <Circle className={cn("h-2.5 w-2.5 fill-current", healthMeta.className)} />
            </span>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-5 lg:p-8">
          <div className="mx-auto max-w-7xl">
            <PageHeaderProvider value={{ title: pageTitle, description: pageDescription }}>{children}</PageHeaderProvider>
          </div>
        </main>
      </div>
    </div>
  );
}
