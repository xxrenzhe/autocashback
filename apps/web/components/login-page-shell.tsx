"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useState } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";

import { BrandMark } from "@/components/brand-mark";
import { ContactQrDialog } from "@/components/contact-qr-dialog";
import { LoginForm } from "@/components/login-form";
import { OpsStructureIllustration } from "@/components/ops-structure-illustration";

const loginSignals = [
  "已开通账号可直接进入控制台。",
  "未开通时先申请试用或联系管理员。",
  "登录后继续账号、Offer 与换链操作。"
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

const securityNotes = [
  "管理员重置密码后，旧登录会话会自动失效。",
  "如果最近登录设备或 IP 异常，建议先联系管理员复核账号状态。",
  "没有账号时，先申请试用或联系开通，再使用统一入口登录。"
];

type FooterItem =
  | {
      type: "link";
      href: string;
      label: string;
    }
  | {
      type: "contact";
      label: string;
    };

const footerColumns: Array<{
  title: string;
  items: FooterItem[];
}> = [
  {
    title: "入口",
    items: [
      { type: "link", href: "/", label: "返回首页" },
      { type: "link", href: "/login", label: "账号登录" },
      { type: "contact", label: "申请试用" }
    ]
  },
  {
    title: "登录后",
    items: [
      { type: "link", href: "/", label: "查看产品结构" },
      { type: "contact", label: "联系开通" }
    ]
  },
  {
    title: "支持",
    items: [
      { type: "contact", label: "联系管理员" },
      { type: "contact", label: "申请试用" }
    ]
  }
];

function ContactButton(props: {
  children: ReactNode;
  className: string;
  onClick: () => void;
}) {
  return (
    <button className={props.className} onClick={props.onClick} type="button">
      {props.children}
    </button>
  );
}

function FooterItemLink(props: {
  item: FooterItem;
  onContactClick: () => void;
}) {
  if (props.item.type === "contact") {
    return (
      <ContactButton
        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
        onClick={props.onContactClick}
      >
        {props.item.label}
      </ContactButton>
    );
  }

  return (
    <Link className="text-sm text-muted-foreground transition-colors hover:text-foreground" href={props.item.href}>
      {props.item.label}
    </Link>
  );
}

export function LoginPageShell() {
  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false);

  return (
    <main className="marketing-shell min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-5 pt-6 lg:px-8">
        <header className="flex items-center justify-between border-b border-border/80 pb-5">
          <Link className="flex items-center gap-3" href="/">
            <BrandMark compact />
            <div>
              <p className="text-sm font-semibold text-foreground">AutoCashBack</p>
              <p className="text-xs text-muted-foreground">返利运营后台</p>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <ContactButton className="button-secondary hidden sm:inline-flex" onClick={() => setIsContactDialogOpen(true)}>
              申请试用
            </ContactButton>
            <Link className="button-secondary" href="/">
              返回首页
            </Link>
          </div>
        </header>
      </div>

      <div className="mx-auto grid max-w-7xl gap-10 px-5 pb-14 pt-10 lg:grid-cols-[0.92fr,1.08fr] lg:px-8 lg:pt-14">
        <section className="max-w-xl">
          <p className="label-kicker">账号入口</p>
          <h1 className="mt-5 font-display text-5xl font-semibold leading-tight tracking-[-0.05em] text-foreground lg:text-6xl">
            登录进入控制台，
            <span className="block text-primary">继续当天返利运营</span>
          </h1>
          <p className="mt-5 text-base leading-8 text-muted-foreground">
            页面只保留登录与进入路径。已有账号直接进入后台，没有账号时先申请试用或联系管理员开通。
          </p>

          <div className="surface-panel mt-8 overflow-hidden">
            <div className="border-b border-border/80 px-5 py-4">
              <p className="label-kicker">后台结构</p>
              <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-foreground">登录后继续这三类工作</h2>
            </div>
            <div className="space-y-5 px-5 py-5">
              <div className="grid gap-3 sm:grid-cols-3">
                {loginScopes.map((item) => (
                  <article className="rounded-2xl border border-border bg-secondary/40 p-4" key={item.title}>
                    <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.text}</p>
                  </article>
                ))}
              </div>
              <OpsStructureIllustration compact className="rounded-2xl border border-border bg-white/70 p-3" />
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1.05fr,0.95fr]">
            <div className="rounded-2xl border border-border bg-card/80 p-4">
              <p className="text-sm font-semibold text-foreground">进入前确认</p>
              <div className="mt-3 space-y-3">
                {loginSignals.map((item) => (
                  <p className="flex items-start gap-2 text-sm leading-6 text-muted-foreground" key={item}>
                    <ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-primary" />
                    <span>{item}</span>
                  </p>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-secondary/40 p-4">
              <p className="text-sm font-semibold text-foreground">安全提示</p>
              <div className="mt-3 space-y-3">
                {securityNotes.map((item) => (
                  <p className="flex items-start gap-2 text-sm leading-6 text-muted-foreground" key={item}>
                    <ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-primary" />
                    <span>{item}</span>
                  </p>
                ))}
              </div>
            </div>
          </div>
        </section>

        <div className="flex h-full w-full lg:justify-self-end">
          <div className="mx-auto flex h-full w-full max-w-[34rem] flex-col">
            <LoginForm className="h-full" onContactClick={() => setIsContactDialogOpen(true)} />
            <div className="mt-4 rounded-2xl border border-border bg-card/70 px-5 py-4 text-sm leading-6 text-muted-foreground">
              没有账号时，先通过客服微信申请试用或联系开通，再使用统一入口登录。
              <button
                className="mt-3 inline-flex items-center gap-2 font-medium text-foreground transition hover:text-primary"
                onClick={() => setIsContactDialogOpen(true)}
                type="button"
              >
                联系开通
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-5 pb-10 lg:px-8">
        <footer className="border-t border-border/80 py-8 text-sm text-muted-foreground">
          <div className="grid gap-8 lg:grid-cols-[1.1fr,1.9fr]">
            <div>
              <p className="font-medium text-foreground">AutoCashBack</p>
              <p className="mt-2 max-w-sm leading-6">
                统一登录入口。已有账号直接进入后台，没有账号时先联系管理员或申请试用。
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-3">
              {footerColumns.map((column) => (
                <div key={column.title}>
                  <p className="text-sm font-semibold text-foreground">{column.title}</p>
                  <div className="mt-3 flex flex-col gap-3">
                    {column.items.map((item) => (
                      <FooterItemLink
                        item={item}
                        key={`${column.title}-${item.label}`}
                        onContactClick={() => setIsContactDialogOpen(true)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </footer>
      </div>

      <ContactQrDialog onClose={() => setIsContactDialogOpen(false)} open={isContactDialogOpen} />
    </main>
  );
}
