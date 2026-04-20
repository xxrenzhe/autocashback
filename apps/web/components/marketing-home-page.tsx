"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useState } from "react";
import { ArrowRight, Coins, Link2, Radar, ShieldCheck, WalletCards } from "lucide-react";

import { BrandMark } from "@/components/brand-mark";
import { ContactQrDialog } from "@/components/contact-qr-dialog";

const navLinks = [
  { href: "#workflow", label: "接入流程" },
  { href: "#features", label: "核心模块" },
  { href: "#scenarios", label: "适合场景" },
  { href: "#faq", label: "常见问题" }
];

const heroSignals = [
  "先开通试用账号，再进入后台。",
  "账号、Offer、佣金和换链统一收口。",
  "适合多平台、多账号、多国家协作。",
  "高频变更时先看状态，再做动作。"
];

const heroPanels = [
  {
    title: "统一入口",
    text: "把账号、Offer、佣金与执行入口收在一个后台。"
  },
  {
    title: "状态先行",
    text: "风险、阈值和待处理动作先露出，再进入操作。"
  },
  {
    title: "多人协作",
    text: "适合多账号、多国家、多平台的运营团队。"
  }
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

const heroFocusAreas = [
  {
    title: "先统一入口",
    text: "试用、开通、登录和进入后台保持一条清晰路径。"
  },
  {
    title: "再看当天状态",
    text: "账号、Offer、佣金阈值和终链变化先汇总，再开始处理。"
  },
  {
    title: "最后进入动作",
    text: "换链、补点击和复核都从同一个控制台继续推进。"
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

const scenarioCards = [
  {
    title: "多账号团队",
    text: "当同一平台下有多个账号覆盖不同国家或品牌时，更适合用统一后台承接协作。"
  },
  {
    title: "多 Offer 维护",
    text: "Offer 多起来后，佣金、广告费阈值和终链状态放在同一处更容易复核。"
  },
  {
    title: "高频换链场景",
    text: "活动链路更新频繁时，固定入口比聊天同步更稳，能减少漏改和误改。"
  },
  {
    title: "交接与复盘",
    text: "交接时直接看系统状态和记录，不用从多个表格里重新拼上下文。"
  }
];

const faqItems = [
  {
    question: "适合什么样的返利团队？",
    answer: "适合需要同时管理多个返利账号、多个 Offer、多个国家和高频链接更新的运营团队。"
  },
  {
    question: "上线后最直接的变化是什么？",
    answer: "先看状态、再做动作，减少来回翻表、漏改链接和阈值遗漏。"
  },
  {
    question: "没有账号时怎么办？",
    answer: "先申请试用或联系管理员开通，再使用统一入口登录后台。"
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
      { type: "link", href: "#workflow", label: "接入流程" },
      { type: "link", href: "#features", label: "核心模块" },
      { type: "link", href: "#scenarios", label: "适合场景" },
      { type: "link", href: "/login", label: "账号登录" }
    ]
  },
  {
    title: "场景",
    items: [
      { type: "link", href: "#scenarios", label: "多账号协作" },
      { type: "link", href: "#scenarios", label: "多 Offer 维护" },
      { type: "link", href: "#features", label: "换链接执行" },
      { type: "link", href: "#faq", label: "常见问题" }
    ]
  },
  {
    title: "开始使用",
    items: [
      { type: "contact", label: "申请试用" },
      { type: "contact", label: "联系开通" },
      { type: "link", href: "/login", label: "进入后台" }
    ]
  }
];

const footerItemClassName =
  "inline-flex cursor-pointer items-center justify-start self-start border-0 bg-transparent p-0 text-left text-sm leading-6 text-muted-foreground transition-colors hover:text-foreground";

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
        className={footerItemClassName}
        onClick={props.onContactClick}
      >
        {props.item.label}
      </ContactButton>
    );
  }

  if (props.item.href.startsWith("/")) {
    return (
      <Link className={footerItemClassName} href={props.item.href}>
        {props.item.label}
      </Link>
    );
  }

  return (
    <a className={footerItemClassName} href={props.item.href}>
      {props.item.label}
    </a>
  );
}

export default function MarketingHomePage() {
  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false);

  return (
    <main className="marketing-shell min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border/80 bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
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
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                href={item.href}
                key={item.href}
              >
                {item.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <ContactButton className="button-primary hidden sm:inline-flex" onClick={() => setIsContactDialogOpen(true)}>
              申请试用
            </ContactButton>
            <Link className="button-secondary" href="/login">
              账号登录
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 pb-12 pt-10 lg:px-8 lg:pt-14">
        <section className="grid gap-10 border-b border-border/80 pb-14 lg:grid-cols-[minmax(0,1.04fr),minmax(20rem,0.96fr)] lg:items-start lg:pb-16">
          <div className="max-w-xl">
            <p className="label-kicker">返利运营后台</p>
            <h1 className="mt-5 font-display text-5xl font-semibold leading-tight tracking-[-0.05em] text-foreground lg:text-7xl">
              把返利运营
              <span className="block text-primary">收回一个后台</span>
            </h1>
            <p className="mt-5 text-base leading-8 text-muted-foreground lg:text-lg">
              AutoCashBack 把账号、Offer、佣金状态和换链接动作收进同一工作台，让团队先看状态，再进入当天任务。
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <ContactButton className="button-primary sm:w-auto" onClick={() => setIsContactDialogOpen(true)}>
                申请试用
                <ArrowRight className="h-4 w-4" />
              </ContactButton>
              <Link className="button-secondary sm:w-auto" href="/login">
                进入后台
              </Link>
            </div>

            <dl className="mt-10 divide-y divide-border border-y border-border/80">
              {heroPanels.map((item) => (
                <div className="grid gap-2 py-4 sm:grid-cols-[8rem,1fr] sm:items-start sm:gap-4" key={item.title}>
                  <dt className="text-sm font-semibold text-foreground">{item.title}</dt>
                  <dd className="text-sm leading-6 text-muted-foreground">{item.text}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {heroSignals.map((item) => (
                <p className="flex items-start gap-2 text-sm leading-6 text-muted-foreground" key={item}>
                  <ShieldCheck className="mt-1 h-4 w-4 shrink-0 text-primary" />
                  <span>{item}</span>
                </p>
              ))}
            </div>
          </div>

          <section className="surface-panel overflow-hidden" id="workflow">
            <div className="flex flex-col gap-4 border-b border-border/80 px-6 py-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="label-kicker">接入流程</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-foreground">首屏直接回答怎么开始</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                  不再展示额外插画，直接把接入节奏、后台重点和当天动作放在首屏，减少首次理解成本。
                </p>
              </div>
              <span className="info-chip">3 步进入日常运营</span>
            </div>

            <div className="space-y-6 px-6 py-6">
              <dl className="divide-y divide-border border-y border-border/80">
                {workflowSteps.map((item, index) => (
                  <div className="grid gap-2 py-4 sm:grid-cols-[6rem,12rem,1fr] sm:items-start sm:gap-4" key={item.title}>
                    <dt className="text-sm font-semibold text-primary">0{index + 1}</dt>
                    <dd className="text-sm font-semibold text-foreground">{item.title}</dd>
                    <dd className="text-sm leading-6 text-muted-foreground">{item.text}</dd>
                  </div>
                ))}
              </dl>

              <div className="grid gap-4 border-t border-border/80 pt-1 sm:grid-cols-3">
                {heroFocusAreas.map((item) => (
                  <article className="rounded-2xl bg-secondary/35 px-4 py-4" key={item.title}>
                    <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.text}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>
        </section>

        <section className="grid gap-8 border-b border-border/80 py-14 lg:grid-cols-[18rem,1fr]" id="features">
          <div>
            <p className="label-kicker">核心模块</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-foreground">后台的主要结构</h2>
            <p className="mt-4 text-sm leading-7 text-muted-foreground">
              页面重点不在展示炫技，而在于让账号、Offer、执行和风险形成稳定的工作节奏。
            </p>
          </div>

          <div className="divide-y divide-border border-y border-border/80">
            {modules.map((module) => {
              const Icon = module.icon;

              return (
                <article className="grid gap-3 py-5 sm:grid-cols-[3rem,10rem,1fr] sm:items-start sm:gap-4" key={module.title}>
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-secondary/35 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-base font-semibold text-foreground">{module.title}</h3>
                  <p className="min-w-0 text-sm leading-6 text-muted-foreground">{module.text}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="grid gap-8 border-b border-border/80 py-14 lg:grid-cols-[18rem,1fr]" id="scenarios">
          <div>
            <p className="label-kicker">适合场景</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-foreground">哪些团队更适合收回统一后台</h2>
          </div>

          <div className="divide-y divide-border border-y border-border/80">
            {scenarioCards.map((item) => (
              <article className="grid gap-2 py-5 sm:grid-cols-[12rem,1fr] sm:items-start sm:gap-4" key={item.title}>
                <h3 className="text-base font-semibold text-foreground">{item.title}</h3>
                <p className="text-sm leading-7 text-muted-foreground">{item.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-8 py-14 lg:grid-cols-[18rem,1fr]" id="faq">
          <div>
            <p className="label-kicker">常见问题</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-foreground">开始使用前通常会问什么</h2>
          </div>

          <div className="divide-y divide-border border-y border-border/80">
            {faqItems.map((item) => (
              <article className="grid gap-2 py-5 sm:grid-cols-[15rem,1fr] sm:items-start sm:gap-4" key={item.question}>
                <h3 className="text-base font-semibold text-foreground">{item.question}</h3>
                <p className="text-sm leading-7 text-muted-foreground">{item.answer}</p>
              </article>
            ))}
          </div>
        </section>

        <footer className="border-t border-border/80 py-8 text-sm text-muted-foreground">
          <div className="grid gap-8 lg:grid-cols-[1.2fr,1.8fr]">
            <div>
              <p className="font-medium text-foreground">AutoCashBack</p>
              <p className="mt-2 max-w-sm leading-6">
                返利运营后台。把账号、Offer、广告费阈值和换链接动作收回统一入口，减少零散协作。
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
