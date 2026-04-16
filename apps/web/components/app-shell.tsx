"use client";

import { useEffect, useState } from "react";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Boxes,
  ChevronLeft,
  ChevronRight,
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
  "/dashboard": "总览返利账号、Offer、换链任务与最近执行状态。",
  "/accounts": "集中维护返利平台账号、注册邮箱与支付方式。",
  "/offers": "管理 Offer 投放信息、佣金阈值和运营状态。",
  "/link-swap": "查看换链接任务、解析结果与脚本对接状态。",
  "/google-ads": "统一处理 Google Ads 授权、诊断与账户关联。",
  "/click-farm": "管理补点击任务、节奏分布与执行结果。",
  "/settings": "维护代理、账号安全和系统基础配置。",
  "/queue": "观察调度队列、并发状态与系统运行压力。",
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
  tone
}: {
  items: NavItem[];
  label: string;
  pathname: string;
  collapsed: boolean;
  tone: "user" | "admin";
}) {
  return (
    <div>
      {!collapsed ? (
        <p className="px-3 text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-400">
          {label}
        </p>
      ) : null}
      <nav className={cn("space-y-1", collapsed ? "" : "mt-3")}>
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActivePath(pathname, item.href);
          const activeStyles =
            tone === "admin"
              ? "bg-amber-50 text-amber-700 shadow-sm shadow-amber-100/80"
              : "bg-brand-mist text-brand-emerald shadow-sm shadow-emerald-100/80";
          const activeIconStyles = tone === "admin" ? "text-amber-600" : "text-brand-emerald";
          const activeDotStyles = tone === "admin" ? "bg-amber-500" : "bg-brand-emerald";

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center rounded-2xl px-3 py-3 text-sm font-medium transition duration-200",
                collapsed ? "justify-center" : "gap-3",
                active ? activeStyles : "text-slate-600 hover:bg-stone-100 hover:text-slate-900"
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon
                className={cn(
                  "h-5 w-5 flex-shrink-0 transition-colors",
                  active ? activeIconStyles : "text-slate-400 group-hover:text-slate-600"
                )}
              />
              {!collapsed ? (
                <>
                  <span className="truncate">{item.label}</span>
                  {active ? <span className={cn("ml-auto h-2 w-2 rounded-full", activeDotStyles)} /> : null}
                </>
              ) : null}
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

  const displayName = user.username || user.email;
  const userInitial = displayName.slice(0, 1).toUpperCase();
  const roleLabel = roleLabels[user.role] ?? user.role;
  const currentNav = resolveCurrentNav(pathname);
  const pageTitle = currentNav?.label ?? "返利网管理后台";
  const pageDescription = pageDescriptions[currentNav?.href ?? "/dashboard"] ?? pageDescriptions["/dashboard"];

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fafaf9_0%,#f5f5f4_48%,#f0fdf4_100%)]">
      {mobileNavOpen ? (
        <button
          aria-label="关闭导航菜单"
          className="fixed inset-0 z-40 bg-slate-950/30 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileNavOpen(false)}
          type="button"
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-brand-line/70 bg-white/92 backdrop-blur-xl transition-transform duration-300 lg:z-40",
          mobileNavOpen ? "translate-x-0" : "-translate-x-full",
          "lg:translate-x-0",
          sidebarOpen ? "lg:w-72" : "lg:w-24"
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-brand-line/70 px-4">
          <Link
            className={cn(
              "inline-flex items-center gap-3 text-brand-ink transition",
              sidebarOpen ? "justify-start" : "mx-auto justify-center"
            )}
            href="/dashboard"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-mist text-sm font-semibold text-brand-emerald">
              AC
            </span>
            {sidebarOpen ? (
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-slate-900">AutoCashBack</span>
                <span className="block text-xs text-slate-500">Editorial Cashback Ops</span>
              </span>
            ) : null}
          </Link>

          <button
            aria-label="关闭导航"
            className="rounded-xl p-2 text-slate-500 transition hover:bg-stone-100 hover:text-slate-700 lg:hidden"
            onClick={() => setMobileNavOpen(false)}
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-1 flex-col overflow-hidden px-3 py-4">
          <Link
            className={cn(
              "rounded-[28px] border border-brand-line bg-[linear-gradient(180deg,rgba(236,253,245,0.95)_0%,rgba(255,255,255,0.98)_100%)] shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-editorial motion-reduce:transform-none",
              sidebarOpen ? "p-4" : "flex justify-center px-0 py-4"
            )}
            href="/settings"
            title="个人中心"
          >
            <div className={cn("flex items-center", sidebarOpen ? "gap-3" : "justify-center")}>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-brand-emerald to-emerald-700 text-base font-semibold text-white shadow-sm shadow-emerald-900/20">
                {userInitial}
              </div>
              {sidebarOpen ? (
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">个人中心</p>
                  <p className="mt-1 truncate text-base font-semibold text-slate-900">{displayName}</p>
                  <p className="truncate text-sm text-slate-500">{user.email}</p>
                </div>
              ) : null}
            </div>

            {sidebarOpen ? (
              <>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-brand-emerald ring-1 ring-emerald-100">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    在线
                  </span>
                  <span className="rounded-full border border-brand-line bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                    {roleLabel}
                  </span>
                </div>
                <div className="mt-4 rounded-2xl border border-brand-line/80 bg-white/90 px-4 py-3 text-sm text-slate-600">
                  账号安全、代理配置和系统参数入口统一收纳到这里。
                </div>
              </>
            ) : null}
          </Link>

          <div className="mt-6 flex-1 space-y-6 overflow-y-auto pb-4">
            <NavSection collapsed={!sidebarOpen} items={userLinks} label="用户区域" pathname={pathname} tone="user" />

            {user.role === "admin" ? (
              <NavSection
                collapsed={!sidebarOpen}
                items={adminLinks}
                label="管理员区域"
                pathname={pathname}
                tone="admin"
              />
            ) : null}
          </div>

          <div className="border-t border-brand-line/70 pt-3">
            <button
              className={cn(
                "group flex w-full items-center rounded-2xl px-3 py-3 text-sm font-semibold text-slate-600 transition hover:bg-red-50 hover:text-red-700",
                sidebarOpen ? "gap-3" : "justify-center"
              )}
              onClick={logout}
              type="button"
            >
              <LogOut className="h-5 w-5 text-slate-400 transition group-hover:text-red-600" />
              {sidebarOpen ? <span>退出登录</span> : null}
            </button>
          </div>
        </div>
      </aside>

      <div className={cn("min-h-screen transition-[padding] duration-300", sidebarOpen ? "lg:pl-72" : "lg:pl-24")}>
        <header className="sticky top-0 z-30 border-b border-brand-line/70 bg-white/86 backdrop-blur-xl">
          <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button
                aria-label="打开导航菜单"
                className="rounded-xl p-2 text-slate-600 transition hover:bg-stone-100 lg:hidden"
                onClick={() => setMobileNavOpen(true)}
                type="button"
              >
                <Menu className="h-5 w-5" />
              </button>
              <button
                aria-label={sidebarOpen ? "收起侧边栏" : "展开侧边栏"}
                className="hidden rounded-xl p-2 text-slate-500 transition hover:bg-stone-100 hover:text-slate-700 lg:inline-flex"
                onClick={() => setSidebarOpen((current) => !current)}
                type="button"
              >
                {sidebarOpen ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
              </button>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
                  AutoCashBack Console
                </p>
                <h1 className="truncate text-base font-semibold text-slate-900 sm:text-lg">{pageTitle}</h1>
              </div>
            </div>

            <div className="hidden items-center gap-2 sm:flex">
              <span className="rounded-full bg-brand-mist px-3 py-1 text-xs font-semibold text-brand-emerald">
                绿色运营台
              </span>
              <span className="rounded-full border border-brand-line bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                {roleLabel}
              </span>
            </div>
          </div>

          <div className="border-t border-brand-line/70 px-4 py-3 sm:px-6 lg:px-8">
            <p className="text-sm leading-6 text-slate-500">{pageDescription}</p>
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-[1480px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
