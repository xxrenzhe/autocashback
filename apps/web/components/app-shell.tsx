"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Boxes,
  LayoutDashboard,
  Link2,
  ListOrdered,
  LogOut,
  Settings,
  Shield,
  Target,
  Users2,
  WalletCards
} from "lucide-react";

import { cn } from "@autocashback/ui";
import type { CurrentUser } from "@autocashback/domain";

const userLinks = [
  { href: "/dashboard", label: "仪表盘", icon: LayoutDashboard },
  { href: "/accounts", label: "账号管理", icon: Users2 },
  { href: "/offers", label: "Offer 管理", icon: WalletCards },
  { href: "/link-swap", label: "换链接管理", icon: Link2 },
  { href: "/google-ads", label: "Google Ads", icon: Target },
  { href: "/click-farm", label: "补点击任务", icon: Boxes },
  { href: "/settings", label: "系统设置", icon: Settings }
];

const adminLinks = [
  { href: "/queue", label: "任务队列", icon: ListOrdered },
  { href: "/admin/users", label: "用户管理", icon: Shield }
];

const roleLabels = {
  admin: "管理员",
  user: "普通用户"
} as const;

export function AppShell({
  user,
  children
}: {
  user: CurrentUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const displayName = user.username || user.email;
  const userInitial = displayName.slice(0, 1).toUpperCase();
  const roleLabel = roleLabels[user.role] ?? user.role;

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fafaf9_0%,#f5f5f4_100%)]">
      <div className="mx-auto grid min-h-screen max-w-[1600px] lg:grid-cols-[280px,1fr]">
        <aside className="border-r border-brand-line/70 bg-white/80 px-5 py-6 backdrop-blur">
          <div className="surface-subtle px-4 py-4">
            <button
              className="w-full rounded-[24px] border border-transparent text-left transition hover:border-brand-line/80 hover:bg-stone-50/70"
              onClick={() => {
                window.location.href = "/settings";
              }}
              type="button"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-brand-emerald to-emerald-700 text-base font-semibold text-white shadow-sm shadow-emerald-900/20">
                  {userInitial}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                    个人中心
                  </p>
                  <p className="mt-1 truncate text-base font-semibold text-slate-900">{displayName}</p>
                  <p className="truncate text-sm text-slate-500">{user.email}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  在线
                </span>
                <span className="rounded-full border border-brand-line bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                  {roleLabel}
                </span>
              </div>
            </button>

            <div className="mt-4 grid gap-2">
              <Link
                className="rounded-2xl border border-brand-line bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-stone-50"
                href="/settings"
              >
                账号与安全
              </Link>
              <button
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-100"
                onClick={logout}
                type="button"
              >
                <LogOut className="h-4 w-4" />
                退出登录
              </button>
            </div>
          </div>

          <div className="mt-6">
            <p className="eyebrow">用户区域</p>
            <nav className="mt-3 space-y-2">
              {userLinks.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition",
                      active
                        ? "bg-brand-mist text-brand-emerald"
                        : "text-slate-700 hover:bg-stone-100"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {user.role === "admin" ? (
            <div className="mt-8">
              <p className="eyebrow">管理员区域</p>
              <nav className="mt-3 space-y-2">
                {adminLinks.map((item) => {
                  const Icon = item.icon;
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition",
                        active
                          ? "bg-amber-50 text-amber-700"
                          : "text-slate-700 hover:bg-stone-100"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>
          ) : null}
        </aside>

        <main className="px-5 py-6 lg:px-10">
          <div className="surface-subtle px-5 py-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">AutoCashBack Console</p>
              <h2 className="mt-1 text-2xl font-semibold text-slate-900">返利网管理后台</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                聚焦返利账号、Offer、换链接和投放辅助任务的日常管理。
              </p>
            </div>
          </div>
          <div className="mt-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
