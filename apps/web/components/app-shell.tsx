"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Link2, Settings, Shield, UserCircle2, Users2, WalletCards } from "lucide-react";

import { cn } from "@autocashback/ui";
import type { CurrentUser } from "@autocashback/domain";

const userLinks = [
  { href: "/dashboard", label: "仪表盘", icon: LayoutDashboard },
  { href: "/accounts", label: "账号管理", icon: Users2 },
  { href: "/offers", label: "Offer 管理", icon: WalletCards },
  { href: "/link-swap", label: "换链接管理", icon: Link2 },
  { href: "/settings", label: "系统设置", icon: Settings }
];

const adminLinks = [{ href: "/admin/users", label: "用户管理", icon: Shield }];

export function AppShell({
  user,
  children
}: {
  user: CurrentUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7f4ec_0%,#fbfaf6_100%)]">
      <div className="mx-auto grid min-h-screen max-w-[1600px] lg:grid-cols-[280px,1fr]">
        <aside className="border-r border-brand-line/70 bg-white/80 px-5 py-6 backdrop-blur">
          <div className="surface-subtle px-5 py-5">
            <p className="eyebrow">AutoCashBack</p>
            <h1 className="mt-3 font-display text-3xl font-semibold text-brand-ink">
              稳定管理返利链接与账号
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              V1 聚焦手工平台运营，把账号、Offer、终链解析和 MCC 脚本管理放到同一个后台。
            </p>
          </div>

          <div className="mt-8">
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
          <div className="surface-subtle flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">AutoCashBack Console</p>
              <h2 className="mt-1 text-2xl font-semibold text-slate-900">返利网管理后台</h2>
            </div>
            <div className="flex items-center gap-3 rounded-2xl bg-stone-100 px-4 py-3 text-sm text-slate-700">
              <UserCircle2 className="h-4 w-4" />
              <span>{user.username}</span>
              <span className="rounded-full bg-white px-2 py-1 text-xs uppercase tracking-wide text-slate-500">
                {user.role}
              </span>
              <button className="rounded-full border border-brand-line bg-white px-3 py-1 text-xs font-semibold text-slate-700" onClick={logout} type="button">
                退出
              </button>
            </div>
          </div>
          <div className="mt-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
