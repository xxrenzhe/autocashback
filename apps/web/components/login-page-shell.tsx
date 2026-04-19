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
        <header className="flex h-[4.5rem] items-center justify-between rounded-full border border-border/80 bg-background/88 px-4 backdrop-blur sm:px-5 sm:shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          <Link className="flex items-center gap-3" href="/">
            <BrandMark compact />
            <div>
              <p className="text-sm font-semibold text-foreground">AutoCashBack</p>
              <p className="text-xs text-muted-foreground">返利运营后台</p>
            </div>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <ContactButton
              className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-emerald-700/20 transition hover:-translate-y-0.5 hover:bg-emerald-500 motion-reduce:transform-none"
              onClick={() => setIsContactDialogOpen(true)}
            >
              申请试用
            </ContactButton>
            <Link
              className="hidden text-sm font-semibold text-foreground transition-colors hover:text-primary md:inline-flex"
              href="/"
            >
              返回首页
            </Link>
          </div>
        </header>
      </div>

      <div className="mx-auto grid min-h-[calc(100vh-6rem)] max-w-7xl items-start gap-8 px-5 pb-10 pt-10 lg:grid-cols-[0.96fr,1.04fr] lg:items-stretch lg:px-8 lg:pt-12">
        <section className="flex h-full max-w-2xl flex-col">
          <h1 className="max-w-4xl text-5xl font-semibold leading-tight tracking-tight text-foreground lg:text-6xl">
            登录后，
            <span className="block text-primary">继续当天返利运营</span>
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
            已有账号直接进入控制台；没有账号时，申请试用或联系管理员开通。
          </p>

          <div className="mt-8 rounded-xl border bg-card p-4 text-card-foreground shadow-sm">
            <p className="text-sm font-semibold text-foreground">常用入口</p>
            <div className="mt-4 grid gap-2">
              {loginActions.map((item) => {
                const Icon = item.icon;

                return (
                  <div className="flex items-start gap-3 rounded-lg border border-border bg-background px-3 py-2.5" key={item.title}>
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">{item.title}</p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">{item.text}</p>
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
          </div>
        </div>
      </div>

      <ContactQrDialog onClose={() => setIsContactDialogOpen(false)} open={isContactDialogOpen} />
    </main>
  );
}
