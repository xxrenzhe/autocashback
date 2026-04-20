"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useState } from "react";
import { ShieldCheck } from "lucide-react";

import { BrandMark } from "@/components/brand-mark";
import { ContactQrDialog } from "@/components/contact-qr-dialog";
import { LoginForm } from "@/components/login-form";

const loginSignals = [
  "已开通账号可直接进入控制台",
  "未开通时先申请试用或联系管理员",
  "登录后继续账号、Offer 与换链操作"
];

const loginScopes = [
  {
    title: "账号",
    text: "维护平台账号、国家覆盖和状态备注。"
  },
  {
    title: "Offer",
    text: "查看佣金阈值、品牌状态和当天重点项。"
  },
  {
    title: "链接",
    text: "进入换链与复核流程，减少旧链和漏改。"
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
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">账号入口</p>
          <h1 className="mt-5 max-w-4xl text-5xl font-semibold leading-tight tracking-tight text-foreground lg:text-6xl">
            登录进入控制台，
            <span className="block text-primary">继续当天返利运营</span>
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
            页面只保留登录与进入路径。已有账号直接进入后台，没有账号时先申请试用或联系管理员开通。
          </p>

          <div className="mt-7 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
            {loginSignals.map((item) => (
              <p className="inline-flex items-start gap-2" key={item}>
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>{item}</span>
              </p>
            ))}
          </div>

          <div className="mt-8 rounded-xl border border-border bg-background/70 px-4 py-3">
            <dl className="grid gap-3 sm:grid-cols-3">
              {loginScopes.map((item) => (
                <div className="border-l border-border pl-3 first:border-l-0 first:pl-0 sm:first:border-l sm:first:pl-3" key={item.title}>
                  <dt className="text-sm font-semibold text-foreground">{item.title}</dt>
                  <dd className="mt-1 text-xs leading-6 text-muted-foreground">{item.text}</dd>
                </div>
              ))}
            </dl>
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
