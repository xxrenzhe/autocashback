"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useState } from "react";
import {
  ArrowRight,
  Coins,
  Globe2,
  Link2,
  Radar,
  ShieldCheck,
  Sparkles,
  Target,
  WalletCards,
  Workflow
} from "lucide-react";

import { BrandMark } from "@/components/brand-mark";
import { ContactQrDialog } from "@/components/contact-qr-dialog";

const navLinks = [
  { href: "#signals", label: "运营信号" },
  { href: "#workflow", label: "接入流程" },
  { href: "#features", label: "核心能力" },
  { href: "#scenarios", label: "适合场景" },
  { href: "#faq", label: "常见问题" }
];

const heroSignals = [
  "先开通试用账号，再进入后台继续日常返利运营",
  "账号、Offer、佣金和链接更新都能回到一个工作台",
  "适合多平台、多账号和多国家的返利协作场景",
  "关键风险和例行操作都有固定入口，减少错链和漏改"
];

const heroHighlights = [
  {
    label: "统一入口",
    value: "账号 / Offer / 换链",
    note: "常见运营动作都能在一套后台里完成。"
  },
  {
    label: "更少切换",
    value: "告别表格来回翻",
    note: "把日常状态、佣金进度和链接维护放在同一条链路。"
  },
  {
    label: "更稳执行",
    value: "风险更早暴露",
    note: "当终链、佣金或代理状态变化时，更容易第一时间发现。"
  },
  {
    label: "更快协作",
    value: "交接更省力",
    note: "新人接手和多人配合时，不必再拼凑零散记录。"
  }
];

const operatingTracks = [
  {
    title: "先收口账号与国家配置",
    text: "把平台账号、国家覆盖和运营备注都整理进同一处，避免多人操作时口径不一致。"
  },
  {
    title: "再维护 Offer 与佣金状态",
    text: "品牌、国家、佣金阈值和最新链接集中留档，方便快速复核和追踪变化。"
  },
  {
    title: "最后执行换链或补点击动作",
    text: "进入后台后直接处理当天任务，不再来回确认该改哪条链接、该跟哪组 Offer。"
  }
];

const modules = [
  {
    icon: WalletCards,
    title: "账号管理",
    text: "一个平台支持多账号、多国家和多收款方式，运营备注也能留在同一条记录里。"
  },
  {
    icon: Coins,
    title: "Offer 总览",
    text: "品牌、国家、佣金阈值和处理状态集中呈现，方便先看重点再做动作。"
  },
  {
    icon: Link2,
    title: "换链接执行",
    text: "活动链接变化时，团队可以快速同步最新终链，减少错链、旧链和漏改。"
  },
  {
    icon: Radar,
    title: "风险提醒",
    text: "当终链缺失、代理失效或任务成功率波动时，系统会把异常更早暴露出来。"
  }
];

const platformCards = [
  {
    title: "TopCashback",
    text: "适合把账号、Offer 和佣金变化统一收口，减少日常运营中的重复确认。"
  },
  {
    title: "Rakuten",
    text: "把平台记录、链接维护和团队协作收进同一个后台，方便持续运营。"
  },
  {
    title: "Custom",
    text: "可以继续扩展更多返利平台，把分散来源的记录拉回同一套工作流。"
  }
];

const scenarioCards = [
  {
    title: "多账号团队",
    text: "当同一平台下有多个账号在跑不同国家或不同品牌时，更适合用统一后台承接协作。"
  },
  {
    title: "多 Offer 维护",
    text: "Offer 多了以后，最怕佣金阈值、终链和状态分散在不同表里，统一记录能明显减轻负担。"
  },
  {
    title: "高频换链场景",
    text: "活动链路更新频繁时，固定入口比聊天同步更稳，能减少漏改和误改。"
  },
  {
    title: "交接与复盘",
    text: "交接时只需要看系统里的状态和记录，不用再把历史信息从多个工具里拼回来。"
  }
];

const faqItems = [
  {
    question: "适合什么样的返利团队？",
    answer: "适合需要同时管理多个返利账号、多个 Offer、多个国家和高频链接更新的运营团队。"
  },
  {
    question: "可以替代现有表格协作吗？",
    answer: "可以。它的目标就是把账号、Offer、佣金和换链记录从零散表格里收回统一后台。"
  },
  {
    question: "上线后最直接的变化是什么？",
    answer: "最直接的是少翻表、少漏改、少错链，让团队先看关键状态，再进入具体处理动作。"
  }
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
    title: "产品",
    items: [
      { type: "link", href: "#signals", label: "运营信号" },
      { type: "link", href: "#workflow", label: "接入流程" },
      { type: "link", href: "#features", label: "核心能力" },
      { type: "link", href: "/login", label: "账号登录" }
    ]
  },
  {
    title: "场景",
    items: [
      { type: "link", href: "#scenarios", label: "多账号协作" },
      { type: "link", href: "#scenarios", label: "多 Offer 维护" },
      { type: "link", href: "#features", label: "风险提醒" },
      { type: "link", href: "#features", label: "换链接执行" }
    ]
  },
  {
    title: "开始使用",
    items: [
      { type: "link", href: "#faq", label: "常见问题" },
      { type: "contact", label: "申请试用" },
      { type: "contact", label: "联系开通" },
      { type: "link", href: "/login", label: "进入后台" }
    ]
  }
];

function HeaderCtaButton(props: {
  onClick: () => void;
  className: string;
  children: ReactNode;
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
      <HeaderCtaButton
        className="text-sm text-slate-600 transition-colors hover:text-brand-emerald"
        onClick={props.onContactClick}
      >
        {props.item.label}
      </HeaderCtaButton>
    );
  }

  if (props.item.href.startsWith("/")) {
    return (
      <Link className="text-sm text-slate-600 transition-colors hover:text-brand-emerald" href={props.item.href}>
        {props.item.label}
      </Link>
    );
  }

  return (
    <a className="text-sm text-slate-600 transition-colors hover:text-brand-emerald" href={props.item.href}>
      {props.item.label}
    </a>
  );
}

export default function MarketingHomePage() {
  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.16),transparent_28%),radial-gradient(circle_at_top_right,rgba(245,158,11,0.14),transparent_24%),linear-gradient(180deg,#fafaf9_0%,#f5f5f4_100%)]">
      <header className="fixed inset-x-0 top-0 z-50">
        <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
          <div className="flex h-[4.5rem] items-center justify-between rounded-full border border-brand-line/80 bg-white/88 px-4 backdrop-blur sm:px-5 sm:shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
            <Link className="flex items-center gap-3" href="/">
              <BrandMark compact />
              <div>
                <p className="text-sm font-semibold text-slate-900">AutoCashBack</p>
                <p className="text-xs text-slate-500">返利运营后台</p>
              </div>
            </Link>

            <nav aria-label="首页导航" className="hidden items-center gap-8 lg:flex">
              {navLinks.map((item) => (
                <a
                  className="text-sm font-medium text-slate-600 transition-colors hover:text-brand-emerald"
                  href={item.href}
                  key={item.href}
                >
                  {item.label}
                </a>
              ))}
            </nav>

            <div className="flex items-center gap-2 sm:gap-3">
              <HeaderCtaButton
                className="inline-flex items-center justify-center rounded-full bg-brand-emerald px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-emerald-700/20 transition hover:-translate-y-0.5 hover:bg-emerald-500 motion-reduce:transform-none"
                onClick={() => setIsContactDialogOpen(true)}
              >
                申请试用
              </HeaderCtaButton>
              <Link
                className="hidden text-sm font-semibold text-slate-700 transition-colors hover:text-brand-emerald md:inline-flex"
                href="/login"
              >
                账号登录
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 pb-10 pt-28 lg:px-8 lg:pt-32">
        <section className="grid gap-8 pb-12 pt-8 lg:grid-cols-[1.04fr,0.96fr] lg:items-center lg:pt-16">
          <div>
            <p className="eyebrow">返利运营后台</p>
            <h1 className="mt-5 max-w-4xl font-display text-5xl font-semibold leading-tight text-slate-900 lg:text-7xl">
              把返利运营
              <span className="block text-brand-emerald">收回一个后台</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
              AutoCashBack 把账号管理、Offer 维护、佣金状态和链接更新收进统一工作台，让返利团队先看关键状态，再进入当天要处理的动作。
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <HeaderCtaButton
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-emerald px-6 py-3 text-base font-semibold text-white shadow-lg shadow-emerald-700/20 transition hover:-translate-y-0.5 hover:bg-emerald-500 motion-reduce:transform-none sm:w-auto"
                onClick={() => setIsContactDialogOpen(true)}
              >
                申请试用
                <ArrowRight className="h-4 w-4" />
              </HeaderCtaButton>
              <Link
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-brand-line bg-white px-6 py-3 text-base font-semibold text-slate-900 transition hover:border-brand-emerald hover:text-brand-emerald sm:w-auto"
                href="/login"
              >
                进入后台
              </Link>
            </div>

            <div className="mt-7 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
              {heroSignals.map((item) => (
                <p className="inline-flex items-start gap-2" key={item}>
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-emerald" />
                  <span>{item}</span>
                </p>
              ))}
            </div>
          </div>

          <div className="space-y-5">
            <section className="surface-panel p-7" id="signals">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="eyebrow">运营信号</p>
                  <h2 className="mt-3 text-2xl font-semibold text-slate-900">先判断系统值不值得接管日常协作</h2>
                </div>
                <span className="rounded-full bg-brand-mist px-3 py-1 text-xs font-semibold text-brand-emerald">
                  一眼看懂
                </span>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                {heroHighlights.map((item) => (
                  <article className="rounded-[24px] border border-brand-line bg-stone-50 p-4" key={item.label}>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{item.label}</p>
                    <p className="mt-3 text-xl font-semibold text-slate-900">{item.value}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{item.note}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="surface-panel p-7" id="platforms">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="eyebrow">接入方式</p>
                  <h2 className="mt-3 text-2xl font-semibold text-slate-900">上线时最常从这三件事开始</h2>
                </div>
                <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                  返利团队
                </span>
              </div>

              <div className="mt-6 grid gap-4">
                {operatingTracks.map((item, index) => (
                  <article className="rounded-[24px] border border-brand-line bg-white p-4" key={item.title}>
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-mist text-sm font-semibold text-brand-emerald">
                        0{index + 1}
                      </span>
                      <div>
                        <h3 className="text-base font-semibold text-slate-900">{item.title}</h3>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{item.text}</p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>
        </section>

        <section className="surface-panel scroll-mt-28 px-6 py-8 lg:px-10" id="workflow">
          <div className="max-w-3xl">
            <p className="eyebrow">平台适配</p>
            <h2 className="mt-3 font-display text-4xl font-semibold text-slate-900">
              先把分散记录收口，再让团队在同一套后台里协作
            </h2>
            <p className="mt-4 text-sm leading-7 text-slate-600">
              不同返利平台可以保留各自差异，但账号、Offer 和链接更新不需要再分散在多个工具里维护。
            </p>
          </div>
          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            {platformCards.map((item) => (
              <article className="rounded-[28px] border border-brand-line bg-stone-50 p-6" key={item.title}>
                <div className="flex items-center gap-3">
                  <Globe2 className="h-5 w-5 text-brand-emerald" />
                  <h3 className="text-xl font-semibold text-slate-900">{item.title}</h3>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">{item.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="grid scroll-mt-28 gap-6 py-10 lg:grid-cols-4" id="features">
          {modules.map((module) => {
            const Icon = module.icon;

            return (
              <article className="surface-panel p-6" key={module.title}>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-mist text-brand-emerald">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-slate-900">{module.title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{module.text}</p>
              </article>
            );
          })}
        </section>

        <section className="grid scroll-mt-28 gap-6 pb-10 lg:grid-cols-[0.94fr,1.06fr]" id="scenarios">
          <div className="surface-panel p-6">
            <div className="flex items-center gap-3">
              <Workflow className="h-5 w-5 text-brand-emerald" />
              <h2 className="text-2xl font-semibold text-slate-900">为什么团队更容易用起来</h2>
            </div>
            <div className="mt-5 space-y-4 text-sm leading-7 text-slate-600">
              <p>如果你的团队还在多个表格、聊天记录和临时文档之间切换，AutoCashBack 会更像一个稳定的返利运营中台。</p>
              <p>它把账号、Offer、佣金和换链记录留在同一个入口里，减少反复确认，也让交接和复盘更轻松。</p>
              <p>无论是日常维护还是活动高峰期，你都能更快看到当前状态，并把关键动作留在系统里。</p>
            </div>
          </div>

          <div className="surface-panel p-6">
            <p className="eyebrow">适合场景</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">从零散协作切到固定工作流</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {scenarioCards.map((item) => (
                <article className="rounded-[24px] bg-stone-50 p-5" key={item.title}>
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-brand-emerald" />
                    <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="surface-panel scroll-mt-28 px-6 py-8 lg:px-10" id="faq">
          <p className="eyebrow">常见问题</p>
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {faqItems.map((item) => (
              <article className="rounded-[28px] border border-brand-line bg-stone-50 p-6" key={item.question}>
                <h3 className="text-lg font-semibold text-slate-900">{item.question}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{item.answer}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="py-10" id="cta">
          <div className="surface-panel flex flex-col gap-6 overflow-hidden px-6 py-8 lg:flex-row lg:items-center lg:justify-between lg:px-10">
            <div className="max-w-2xl">
              <p className="eyebrow">快速开始</p>
              <h2 className="mt-2 font-display text-4xl font-semibold text-slate-900">
                让返利运营先看清状态，再进入当天动作
              </h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                适合希望把账号、Offer、佣金和链接更新统一管理起来的返利团队，也适合正在从零散表格切到系统协作的团队。
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <HeaderCtaButton
                className="inline-flex items-center gap-2 rounded-full bg-brand-emerald px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500"
                onClick={() => setIsContactDialogOpen(true)}
              >
                联系开通
                <Sparkles className="h-4 w-4" />
              </HeaderCtaButton>
              <Link
                className="rounded-full border border-brand-line bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-brand-emerald hover:text-brand-emerald"
                href="/login"
              >
                进入后台
              </Link>
            </div>
          </div>
        </section>
      </div>

      <footer className="pb-10 pt-4">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="overflow-hidden rounded-[32px] border border-brand-line/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(248,250,252,0.94)_100%)] shadow-editorial">
            <div className="grid gap-10 px-6 py-8 lg:grid-cols-[1.2fr,0.8fr,0.8fr,0.8fr] lg:px-10 lg:py-10">
              <div className="lg:pr-10">
                <Link className="flex items-center gap-3" href="/">
                  <BrandMark />
                  <div>
                    <p className="text-base font-semibold text-slate-900">AutoCashBack</p>
                    <p className="text-sm text-slate-500">返利运营后台</p>
                  </div>
                </Link>
                <p className="mt-5 max-w-md text-sm leading-7 text-slate-600">
                  面向返利团队的统一运营后台，用更少的切换和更清晰的记录，承接账号、Offer、佣金和链接更新。
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <HeaderCtaButton
                    className="rounded-full bg-brand-emerald px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500"
                    onClick={() => setIsContactDialogOpen(true)}
                  >
                    联系开通
                  </HeaderCtaButton>
                  <Link
                    className="rounded-full border border-brand-line bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-brand-emerald hover:text-brand-emerald"
                    href="/login"
                  >
                    账号登录
                  </Link>
                </div>
              </div>

              {footerColumns.map((column) => (
                <div key={column.title}>
                  <h3 className="text-sm font-semibold tracking-[0.12em] text-slate-900">{column.title}</h3>
                  <ul className="mt-4 space-y-3">
                    {column.items.map((item) => (
                      <li key={item.label}>
                        <FooterItemLink item={item} onContactClick={() => setIsContactDialogOpen(true)} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-4 border-t border-brand-line/80 bg-white/70 px-6 py-5 text-center text-sm text-slate-500 md:flex-row md:items-center md:justify-between md:text-left lg:px-10">
              <p>© 2026 AutoCashBack. All rights reserved.</p>
              <div className="flex flex-wrap items-center justify-center gap-6 md:justify-end">
                <HeaderCtaButton
                  className="text-sm text-slate-500 transition-colors hover:text-brand-emerald"
                  onClick={() => setIsContactDialogOpen(true)}
                >
                  申请试用
                </HeaderCtaButton>
                <Link className="text-sm text-slate-500 transition-colors hover:text-brand-emerald" href="/login">
                  账号登录
                </Link>
              </div>
            </div>
          </div>
        </div>
      </footer>

      <ContactQrDialog onClose={() => setIsContactDialogOpen(false)} open={isContactDialogOpen} />
    </main>
  );
}
