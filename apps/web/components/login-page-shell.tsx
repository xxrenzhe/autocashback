"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useState } from "react";
import { Coins, Link2, WalletCards, Workflow } from "lucide-react";

import { BrandMark } from "@/components/brand-mark";
import { ContactQrDialog } from "@/components/contact-qr-dialog";
import { LoginForm } from "@/components/login-form";

const loginActions = [
  {
    icon: WalletCards,
    title: "继续维护返利账号",
    text: "进入控制台后继续处理账号状态、国家覆盖和平台备注。"
  },
  {
    icon: Coins,
    title: "查看 Offer 与佣金进度",
    text: "快速确认当天重点 Offer、阈值状态和需要跟进的变更。"
  },
  {
    icon: Link2,
    title: "执行换链与链接复核",
    text: "把最新终链更新到系统，减少活动链路切换时的漏改风险。"
  },
  {
    icon: Workflow,
    title: "承接交接与日常协作",
    text: "从总览继续进入账号、Offer 或任务处理，不需要回头翻表。"
  }
];

const loginSignals = [
  {
    label: "账号开通",
    value: "管理员统一创建",
    note: "试用账号和正式账号都从后台统一开通。"
  },
  {
    label: "登录后入口",
    value: "直接进入控制台",
    note: "继续处理账号、Offer 和换链等日常动作。"
  }
];

function ContactButton(props: {
  className: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button className={props.className} onClick={props.onClick} type="button">
      {props.children}
    </button>
  );
}

export function LoginPageShell() {
  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.16),transparent_26%),radial-gradient(circle_at_top_right,rgba(245,158,11,0.12),transparent_22%),linear-gradient(180deg,#fafaf9_0%,#f5f5f4_100%)]">
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
          <h1 className="max-w-4xl font-display text-5xl font-semibold leading-tight text-slate-900 lg:text-6xl">
            登录后，
            <span className="block text-brand-emerald">继续当天返利运营</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            已有账号可直接进入控制台，继续处理账号、Offer、佣金和换链任务。还没有账号时，先申请试用或联系管理员统一开通。
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {loginSignals.map((item) => (
              <article className="surface-panel p-5" key={item.label}>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{item.label}</p>
                <p className="mt-4 text-2xl font-semibold text-slate-900">{item.value}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.note}</p>
              </article>
            ))}
          </div>

          <div className="surface-panel mt-8 p-6">
            <p className="text-sm font-semibold text-slate-900">登录后通常会先继续这些动作：</p>
            <div className="mt-5 grid gap-3">
              {loginActions.map((item) => {
                const Icon = item.icon;

                return (
                  <div className="flex items-start gap-3 rounded-[22px] bg-stone-50 px-4 py-4" key={item.title}>
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-mist text-brand-emerald">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-600">{item.text}</p>
                    </div>
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

      <ContactQrDialog onClose={() => setIsContactDialogOpen(false)} open={isContactDialogOpen} />
    </main>
  );
}
