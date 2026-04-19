"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  Coins,
  Link2,
  Radar,
  ShieldCheck,
  WalletCards,
  Workflow
} from "lucide-react";

import { BrandMark } from "@/components/brand-mark";
import { ContactQrDialog } from "@/components/contact-qr-dialog";

const navLinks = [
  { href: "#workflow", label: "接入流程" },
  { href: "#features", label: "核心模块" },
  { href: "#faq", label: "常见问题" }
];

const heroSignals = [
  "先开通试用账号，再进入后台",
  "账号、Offer、佣金和换链统一收口",
  "适合多平台、多账号、多国家协作",
  "高频变更时先看状态，再做动作"
];

const workflowSteps = [
  {
    title: "开通账号",
    text: "先申请试用或联系管理员开通，统一进入后台。"
  },
  {
    title: "维护账号和 Offer",
    text: "把平台账号、国家覆盖、Offer 链接和佣金状态收进同一处。"
  },
  {
    title: "执行换链与日常动作",
    text: "直接从控制台进入换链、补点击和复核流程。"
  }
];

const modules = [
  {
    icon: WalletCards,
    title: "账号管理",
    text: "多平台、多账号、多收款方式统一留档。"
  },
  {
    icon: Coins,
    title: "Offer 管理",
    text: "品牌、国家、佣金阈值和状态集中维护。"
  },
  {
    icon: Link2,
    title: "换链接执行",
    text: "终链变化后集中更新，减少漏改和旧链。"
  },
  {
    icon: Radar,
    title: "风险提醒",
    text: "把异常、预警和需要跟进的项提前暴露出来。"
  }
];

const faqItems = [
  {
    question: "适合什么样的团队？",
    answer: "适合需要同时维护多个返利账号、多个 Offer 和高频链接更新的返利团队。"
  },
  {
    question: "能替代表格协作吗？",
    answer: "可以，核心目标就是把分散在表格和聊天里的记录收回统一后台。"
  },
  {
    question: "怎么开始使用？",
    answer: "先申请试用或联系开通，账号创建后直接登录进入控制台。"
  }
];

function ContactButton({
  children,
  className,
  onClick
}: {
  children: React.ReactNode;
  className: string;
  onClick: () => void;
}) {
  return (
    <button className={className} onClick={onClick} type="button">
      {children}
    </button>
  );
}

export default function MarketingHomePage() {
  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.16),transparent_28%),radial-gradient(circle_at_top_right,rgba(245,158,11,0.14),transparent_24%),linear-gradient(180deg,#fafaf9_0%,#f5f5f4_100%)]">
      <header className="fixed inset-x-0 top-0 z-50">
        <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
          <div className="flex h-[4.5rem] items-center justify-between rounded-full border border-border/80 bg-background/88 px-4 backdrop-blur sm:px-5 sm:shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
            <Link className="flex items-center gap-3" href="/">
              <BrandMark compact />
              <div>
                <p className="text-sm font-semibold text-foreground">AutoCashBack</p>
                <p className="text-xs text-muted-foreground">返利运营后台</p>
              </div>
            </Link>

            <nav aria-label="首页导航" className="hidden items-center gap-8 lg:flex">
              {navLinks.map((item) => (
                <a
                  className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
                  href={item.href}
                  key={item.href}
                >
                  {item.label}
                </a>
              ))}
            </nav>

            <div className="flex items-center gap-2 sm:gap-3">
              <ContactButton
                className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-emerald-700/20 transition hover:-translate-y-0.5 hover:bg-emerald-500 motion-reduce:transform-none"
                onClick={() => setIsContactDialogOpen(true)}
              >
                申请试用
              </ContactButton>
              <Link
                className="hidden text-sm font-semibold text-foreground transition-colors hover:text-primary md:inline-flex"
                href="/login"
              >
                账号登录
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 pb-12 pt-24 lg:px-8 lg:pt-28">
        <section className="grid gap-6 pb-10 pt-4 lg:grid-cols-[1.06fr,0.94fr] lg:items-start lg:pt-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">返利运营后台</p>
            <h1 className="mt-5 max-w-4xl text-5xl font-semibold leading-tight tracking-tight text-foreground lg:text-7xl">
              把返利运营
              <span className="block text-primary">收回一个后台</span>
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground lg:text-lg lg:leading-8">
              AutoCashBack 把账号、Offer、佣金状态和换链接动作收进同一工作台，让团队先看关键状态，再进入当天要处理的任务。
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <ContactButton
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-base font-semibold text-white shadow-md shadow-emerald-700/20 transition hover:-translate-y-0.5 hover:bg-emerald-500 motion-reduce:transform-none sm:w-auto"
                onClick={() => setIsContactDialogOpen(true)}
              >
                申请试用
                <ArrowRight className="h-4 w-4" />
              </ContactButton>
              <Link
                className="inline-flex w-full items-center justify-center rounded-full border border-border bg-background px-6 py-3 text-base font-semibold text-foreground transition hover:border-primary hover:text-primary sm:w-auto"
                href="/login"
              >
                进入后台
              </Link>
            </div>

            <div className="mt-6 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
              {heroSignals.map((item) => (
                <p className="inline-flex items-start gap-2" key={item}>
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>{item}</span>
                </p>
              ))}
            </div>
          </div>

          <section className="rounded-xl border bg-card p-4 text-card-foreground shadow-sm" id="workflow">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">接入流程</p>
                <h2 className="mt-1 text-lg font-semibold tracking-tight text-foreground">最常见的启动路径</h2>
              </div>
              <span className="rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-semibold text-muted-foreground">
                3 steps
              </span>
            </div>

            <div className="mt-4 grid gap-3">
              {workflowSteps.map((item, index) => (
                <article className="rounded-lg border border-border bg-background px-4 py-3" key={item.title}>
                  <div className="flex items-start gap-3">
                    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold text-primary">
                      {index + 1}
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.text}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </section>

        <section className="grid scroll-mt-28 gap-4 py-6 lg:grid-cols-4" id="features">
          {modules.map((module) => {
            const Icon = module.icon;

            return (
              <article className="rounded-xl border bg-card p-4 text-card-foreground shadow-sm" key={module.title}>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-foreground">{module.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{module.text}</p>
              </article>
            );
          })}
        </section>

        <section className="grid gap-4 py-6 lg:grid-cols-[1.08fr,0.92fr]">
          <div className="rounded-xl border bg-card p-4 text-card-foreground shadow-sm">
            <div className="flex items-center gap-3">
              <Workflow className="h-4 w-4 text-primary" />
              <h2 className="text-base font-semibold tracking-tight text-foreground">为什么更接近日常运营</h2>
            </div>
            <div className="mt-4 space-y-3 text-sm leading-7 text-muted-foreground">
              <p>如果团队仍在多个表格、聊天和临时文档之间切换，最容易出现链接漏改、佣金状态不同步和交接信息丢失。</p>
              <p>AutoCashBack 的重点不是展示更多卡片，而是让账号、Offer、佣金和换链动作回到同一套固定工作流里。</p>
            </div>
          </div>

          <div className="rounded-xl border bg-card p-4 text-card-foreground shadow-sm" id="faq">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">常见问题</p>
            <div className="mt-4 space-y-3">
              {faqItems.map((item) => (
                <article className="rounded-lg border border-border bg-background px-4 py-3" key={item.question}>
                  <h3 className="text-sm font-semibold text-foreground">{item.question}</h3>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.answer}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="py-6" id="cta">
          <div className="flex flex-col gap-5 rounded-xl border bg-card px-5 py-6 text-card-foreground shadow-sm lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">快速开始</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
                先开通，再进入后台继续当天返利运营
              </h2>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                适合希望把账号、Offer、佣金和链接更新统一管理起来的返利团队。
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <ContactButton
                className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500"
                onClick={() => setIsContactDialogOpen(true)}
              >
                联系开通
                <ArrowRight className="h-4 w-4" />
              </ContactButton>
              <Link
                className="rounded-full border border-border bg-background px-6 py-3 text-sm font-semibold text-foreground transition hover:border-primary hover:text-primary"
                href="/login"
              >
                进入后台
              </Link>
            </div>
          </div>
        </section>

        <footer className="border-t border-border/70 py-6 text-sm text-muted-foreground">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-medium text-foreground">AutoCashBack</p>
              <p className="mt-1">返利运营后台</p>
            </div>
            <div className="flex flex-wrap items-center gap-5">
              <ContactButton
                className="text-sm text-muted-foreground transition-colors hover:text-primary"
                onClick={() => setIsContactDialogOpen(true)}
              >
                申请试用
              </ContactButton>
              <Link className="text-sm text-muted-foreground transition-colors hover:text-primary" href="/login">
                账号登录
              </Link>
            </div>
          </div>
        </footer>
      </div>

      <ContactQrDialog onClose={() => setIsContactDialogOpen(false)} open={isContactDialogOpen} />
    </main>
  );
}
