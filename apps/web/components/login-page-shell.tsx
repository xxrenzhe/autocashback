"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useState } from "react";
import { Coins, Link2, ShieldCheck, WalletCards, Workflow } from "lucide-react";

import { BrandMark } from "@/components/brand-mark";
import { ContactQrDialog } from "@/components/contact-qr-dialog";
import { LoginForm } from "@/components/login-form";

const loginActions = [
  {
    icon: WalletCards,
    text: "继续维护返利账号、收款方式与运营备注"
  },
  {
    icon: Coins,
    text: "查看 Offer 进度与佣金状态变化"
  },
  {
    icon: Link2,
    text: "同步更新推广链接，保持投放口径一致"
  },
  {
    icon: Workflow,
    text: "承接团队协作与日常运营交接"
  }
];

function ContactButton(props: {
  className: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button type="button" className={props.className} onClick={props.onClick}>
      {props.children}
    </button>
  );
}

export function LoginPageShell() {
  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(209,250,229,0.82),transparent_26%),radial-gradient(circle_at_top_right,rgba(254,240,138,0.75),transparent_22%),linear-gradient(180deg,#fafaf9_0%,#f5f5f4_100%)]">
      <div className="mx-auto max-w-7xl px-5 pt-5 lg:px-8">
        <header className="flex h-[4.5rem] items-center justify-between rounded-full border border-brand-line/80 bg-white/88 px-4 backdrop-blur sm:px-5 sm:shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <Link className="flex items-center gap-3" href="/">
            <BrandMark compact />
            <div>
              <p className="text-sm font-semibold text-slate-900">AutoCashBack</p>
              <p className="text-xs text-slate-500">返利运营后台</p>
            </div>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <ContactButton
              className="inline-flex items-center justify-center rounded-full bg-brand-emerald px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-emerald-700/20 transition hover:-translate-y-0.5 hover:bg-emerald-500 motion-reduce:transform-none"
              onClick={() => setIsContactDialogOpen(true)}
            >
              申请试用
            </ContactButton>
            <Link
              className="hidden text-sm font-semibold text-slate-700 transition-colors hover:text-brand-emerald md:inline-flex"
              href="/"
            >
              返回首页
            </Link>
          </div>
        </header>
      </div>

      <div className="mx-auto grid min-h-[calc(100vh-6rem)] max-w-7xl items-start gap-10 px-5 pb-10 pt-10 lg:grid-cols-[1.02fr,0.98fr] lg:items-stretch lg:px-8 lg:pt-12">
        <section className="flex h-full max-w-2xl flex-col">
          <p className="inline-flex items-center gap-2 rounded-full border border-brand-line bg-white/80 px-4 py-2 text-sm font-semibold text-slate-700">
            <ShieldCheck className="h-4 w-4 text-brand-emerald" />
            AutoCashBack 账号入口
          </p>
          <h1 className="mt-6 max-w-4xl font-display text-5xl font-semibold leading-tight text-slate-900 lg:text-6xl">账号登录</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            先咨询开通试用账号，再登录使用系统。已有账号可直接进入控制台，继续管理账号、Offer、佣金与链接更新。
          </p>

          <div className="surface-panel mt-8 flex-1 p-6">
            <p className="text-sm font-semibold text-slate-900">登录后你可直接继续这些动作：</p>
            <div className="mt-5 grid gap-3">
              {loginActions.map((item) => {
                const Icon = item.icon;

                return (
                  <div className="flex items-start gap-3 rounded-[22px] bg-stone-50 px-4 py-4" key={item.text}>
                    <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-brand-mist text-brand-emerald">
                      <Icon className="h-4 w-4" />
                    </div>
                    <p className="text-sm leading-6 text-slate-600">{item.text}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <div className="flex h-full w-full lg:justify-self-end">
          <div className="mx-auto flex h-full w-full max-w-[34rem] flex-col">
            <LoginForm className="h-full" onContactClick={() => setIsContactDialogOpen(true)} />
            <p className="mt-4 text-center text-sm text-slate-500">试用账号与正式账号均由管理员统一开通。</p>
          </div>
        </div>
      </div>

      <ContactQrDialog open={isContactDialogOpen} onClose={() => setIsContactDialogOpen(false)} />
    </main>
  );
}
