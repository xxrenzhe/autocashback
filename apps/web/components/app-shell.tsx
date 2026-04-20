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

import { cn } from "@autocashback/ui";
import { Toaster } from "sonner";
import type { CurrentUser } from "@autocashback/domain";
import { BrandMark } from "@/components/brand-mark";

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
  "/dashboard": "先看当天状态与优先动作，再进入执行。",
  "/accounts": "集中维护平台账号、状态与挂接关系。",
  "/offers": "按 Offer 查看佣金阈值、suffix 和绑定账号。",
  "/link-swap": "管理换链任务、执行记录与异常重试。",
  "/google-ads": "管理授权账号、客户列表和广告侧配置。",
  "/click-farm": "查看补点击任务分布、执行状态与历史。",
  "/settings": "统一维护代理、脚本、账号安全和平台配置。",
  "/queue": "检查调度器健康、队列积压与运行窗口。",
  "/admin/users": "维护后台账号、权限和异常用户状态。"
};

function isActivePath(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavSection({
  items,
  label,
  pathname,
  collapsed
}: {
  items: NavItem[];
  label: string;
  pathname: string;
  collapsed: boolean;
}) {
  return (
    <div>
      {!collapsed ? (
        <div className="flex items-center gap-2 px-3 pb-2">
          <Circle className="h-2.5 w-2.5 fill-current text-primary" />
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
        </div>
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
                "group flex items-center border-l-[3px] px-3 py-2 text-sm font-medium transition-colors",
                collapsed ? "justify-center rounded-md border-l-transparent" : "gap-3 rounded-r-md",
                active
                  ? "border-l-primary bg-primary/8 text-foreground"
                  : "border-l-transparent text-muted-foreground hover:bg-primary/5 hover:text-foreground"
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon
                className={cn(
                  "h-4 w-4 flex-shrink-0",
                  active ? "text-primary" : "text-muted-foreground group-hover:text-current"
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
  const currentNavItem = [...userLinks, ...(user.role === "admin" ? adminLinks : [])].find((item) =>
    isActivePath(pathname, item.href)
  );
  const currentDescription = pageDescriptions[currentNavItem?.href ?? "/dashboard"] ?? "继续今天的返利后台运营工作。";
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
      className: "bg-primary",
      label: "系统健康"
    },
    loading: {
      className: "bg-muted-foreground",
      label: "检查中"
    },
    stale: {
      className: "bg-amber-600",
      label: "调度心跳延迟"
    },
    unhealthy: {
      className: "bg-destructive",
      label: "系统异常"
    }
  }[healthStatus];

  return (
    <div className="console-shell min-h-screen bg-background">
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
          "console-sidebar fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r bg-background transition-transform duration-300 lg:z-40",
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
            <BrandMark compact />
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
              <NavSection collapsed={!sidebarOpen} items={adminLinks} label="系统管理" pathname={pathname} />
            ) : null}
          </div>

          <div className="mt-4 border-t pt-4">
            <Link
              href="/settings#account-security-settings"
              className={cn(
                "mb-2 flex items-center rounded-lg border border-transparent px-3 py-2 transition-colors hover:border-border hover:bg-background/50",
                sidebarOpen ? "justify-between" : "justify-center"
              )}
              title={!sidebarOpen ? "打开账号设置" : undefined}
            >
              <div className={cn("flex items-center gap-2", sidebarOpen ? "" : "justify-center")}>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-primary/15 bg-primary/10 text-sm font-medium text-primary shadow-sm">
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
                "flex w-full items-center rounded-lg border border-transparent px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-destructive/15 hover:bg-destructive/10 hover:text-destructive",
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
        <header className="console-topbar sticky top-0 z-30 flex min-h-[4.75rem] items-center justify-between border-b bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/60 sm:px-6 lg:px-8">
          <div className="flex items-start gap-4">
            <button
              aria-label="打开导航菜单"
              className="mt-1 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden"
              onClick={() => setMobileNavOpen(true)}
              type="button"
            >
              <Menu className="h-5 w-5" />
            </button>
            <button
              aria-label={sidebarOpen ? "收起侧边栏" : "展开侧边栏"}
              className="mt-1 hidden rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:block"
              onClick={() => setSidebarOpen((current) => !current)}
              type="button"
            >
              {sidebarOpen ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
            </button>
            <div className="min-w-0">
              <p className="hidden text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground lg:block">
                运营控制台
              </p>
              <p className="truncate text-base font-semibold tracking-[-0.02em] text-foreground">
                {currentNavItem?.label || "控制台"}
              </p>
              <p className="hidden truncate text-sm text-muted-foreground lg:block">{currentDescription}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden text-right lg:block">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{roleLabel}</p>
              <p className="text-sm font-medium text-foreground">{displayName}</p>
            </div>
            <span className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground" title={healthMeta.label}>
              <span className={cn("h-2.5 w-2.5 rounded-sm", healthMeta.className)} />
              {healthMeta.label}
            </span>
          </div>
        </header>

        <main className="console-main flex-1 p-4 sm:p-5 lg:p-8">
          <div className="console-content mx-auto max-w-7xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
