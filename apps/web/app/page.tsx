import Link from "next/link";
import { ArrowRight, Coins, Link2, ShieldCheck, WalletCards, Workflow } from "lucide-react";

const workflowSteps = [
  {
    title: "录入返利网账号",
    text: "按平台、国家和收款方式整理账号信息，把分散记录收回到统一后台。"
  },
  {
    title: "配置 Offer 与规则",
    text: "把链接、品牌、国家和佣金阈值放在同一条记录里，后续协作不用来回翻表。"
  },
  {
    title: "统一更新投放链接",
    text: "当活动链接变化时，运营团队可以在一个地方完成更新，减少错链和漏改。"
  }
];

const modules = [
  {
    icon: WalletCards,
    title: "账号管理",
    text: "一个平台可管理多个账号，注册信息、收款方式和运营备注都留在同一处。"
  },
  {
    icon: Coins,
    title: "Offer 管理",
    text: "把品牌、国家、链接和佣金进度整合进统一记录，查找和复盘都更直接。"
  },
  {
    icon: Link2,
    title: "链接更新",
    text: "需要替换推广链接时，团队可以快速同步最新版本，保持投放口径一致。"
  }
];

const platformCards = [
  {
    title: "TopCashback",
    text: "统一管理账号、Offer 与佣金进度，让日常运营更清晰。"
  },
  {
    title: "Rakuten",
    text: "把平台记录、链接维护和投放协同放进同一个工作台。"
  },
  {
    title: "Custom",
    text: "适合补充更多返利平台，保持你的内部流程和命名方式不变。"
  }
];

const valueCards = [
  {
    title: "统一记录",
    text: "账号、Offer、佣金和链接更新不再散落在表格、聊天记录和临时备注里。"
  },
  {
    title: "协作更顺",
    text: "同一套后台承接日常运营动作，新人接手和多人协作都更容易。"
  },
  {
    title: "风险更低",
    text: "当链接或佣金状态变化时，团队更容易发现异常，减少遗漏与误操作。"
  },
  {
    title: "上线更快",
    text: "适合正在从零散工具切到统一后台的返利团队，部署和使用门槛都更低。"
  }
];

const faqItems = [
  {
    question: "适合什么样的团队？",
    answer: "适合需要同时管理多个返利账号、多个 Offer 和多个投放国家的运营团队。"
  },
  {
    question: "可以替代现有表格吗？",
    answer: "可以。首页、后台和统一记录页的设计目标，就是把常见的表格协作场景收拢到一个系统里。"
  },
  {
    question: "上线后最直接的价值是什么？",
    answer: "最直接的是少翻表、少漏改、少错链，让账号管理、Offer 维护和链接更新都有固定入口。"
  }
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#d1fae5,transparent_28%),radial-gradient(circle_at_top_right,#fde68a,transparent_22%),linear-gradient(180deg,#fafaf9_0%,#f5f5f4_100%)]">
      <div className="mx-auto max-w-7xl px-5 py-8 lg:px-8">
        <header className="surface-subtle flex items-center justify-between px-5 py-4">
          <div>
            <p className="eyebrow">AutoCashBack</p>
            <h1 className="mt-1 text-xl font-semibold text-slate-900">返利网运营管理平台</h1>
          </div>
          <div className="flex gap-3">
            <Link className="rounded-full border border-brand-line px-5 py-2 text-sm font-medium text-slate-700" href="/login">
              登录
            </Link>
            <a
              className="rounded-full bg-brand-emerald px-5 py-2 text-sm font-semibold text-white"
              href="mailto:hello@autocashback.dev"
            >
              申请试用
            </a>
          </div>
        </header>

        <section className="grid gap-8 pb-20 pt-12 lg:grid-cols-[1.1fr,0.9fr] lg:pt-20">
          <div>
            <p className="eyebrow">Editorial Cashback Ops</p>
            <h2 className="mt-5 max-w-4xl font-display text-5xl font-semibold leading-tight text-slate-900 lg:text-7xl">
              返利运营，一个后台就够了。
            </h2>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
              AutoCashBack 把账号管理、Offer 配置、佣金预警和链接更新收进同一个工作台，让返利团队的日常运营更清楚、
              更稳定，也更容易协作。
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <a
                className="inline-flex items-center gap-2 rounded-full bg-brand-emerald px-6 py-3 text-sm font-semibold text-white"
                href="mailto:hello@autocashback.dev"
              >
                申请试用
                <ArrowRight className="h-4 w-4" />
              </a>
              <Link
                className="inline-flex items-center gap-2 rounded-full border border-brand-line bg-white px-6 py-3 text-sm font-semibold text-slate-700"
                href="/login"
              >
                查看后台
              </Link>
            </div>
          </div>

          <div className="surface-panel p-8">
            <p className="eyebrow">适用平台</p>
            <div className="mt-6 grid gap-4">
              {platformCards.map((item) => (
                <div className="rounded-3xl bg-stone-50 p-5" key={item.title}>
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="h-5 w-5 text-brand-emerald" />
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">{item.title}</h3>
                      <p className="mt-1 text-sm leading-6 text-slate-600">{item.text}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="surface-panel px-6 py-8 lg:px-10">
          <div className="max-w-3xl">
            <p className="eyebrow">三步工作流</p>
            <h3 className="mt-3 font-display text-4xl font-semibold text-slate-900">
              AutoCashBack 只做真正影响运营效率的事情
            </h3>
          </div>
          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            {workflowSteps.map((step, index) => (
              <article className="rounded-[28px] border border-brand-line bg-stone-50 p-6" key={step.title}>
                <p className="text-sm font-semibold text-brand-emerald">0{index + 1}</p>
                <h4 className="mt-3 text-xl font-semibold text-slate-900">{step.title}</h4>
                <p className="mt-3 text-sm leading-6 text-slate-600">{step.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-6 py-10 lg:grid-cols-3">
          {modules.map((module) => {
            const Icon = module.icon;
            return (
              <article className="surface-panel p-6" key={module.title}>
                <div className="flex items-center gap-3">
                  <Icon className="h-5 w-5 text-brand-emerald" />
                  <h3 className="text-lg font-semibold text-slate-900">{module.title}</h3>
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-600">{module.text}</p>
              </article>
            );
          })}
        </section>

        <section className="grid gap-6 pb-10 lg:grid-cols-[0.9fr,1.1fr]">
          <div className="surface-panel p-6">
            <div className="flex items-center gap-3">
              <Workflow className="h-5 w-5 text-brand-emerald" />
              <h3 className="text-2xl font-semibold text-slate-900">为什么团队更容易用起来</h3>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {valueCards.map((item) => (
                <div className="rounded-[24px] bg-stone-50 p-5" key={item.title}>
                  <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{item.text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="surface-panel p-6">
            <p className="eyebrow">适合场景</p>
            <h3 className="mt-2 text-2xl font-semibold text-slate-900">从零散协作切到统一后台</h3>
            <div className="mt-5 space-y-4 text-sm leading-7 text-slate-600">
              <p>如果你的团队还在多个表格、聊天记录和临时文档之间切换，AutoCashBack 会更像一个稳定的运营中台。</p>
              <p>它把账号、Offer、佣金和链接更新收在同一个入口里，减少重复确认，也让交接更轻松。</p>
              <p>无论是日常维护还是活动高峰期，你都能更快看到当前状态，并把关键动作留在系统里。</p>
            </div>
          </div>
        </section>

        <section className="surface-panel px-6 py-8 lg:px-10">
          <p className="eyebrow">FAQ</p>
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {faqItems.map((item) => (
              <article className="rounded-[28px] border border-brand-line bg-stone-50 p-6" key={item.question}>
                <h3 className="text-lg font-semibold text-slate-900">{item.question}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{item.answer}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="py-10">
          <div className="surface-panel flex flex-col gap-6 px-6 py-8 lg:flex-row lg:items-center lg:justify-between lg:px-10">
            <div>
              <p className="eyebrow">Bottom CTA</p>
              <h3 className="mt-2 font-display text-4xl font-semibold text-slate-900">
                把返利运营从零散协作带回统一后台
              </h3>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
                AutoCashBack 适合希望把账号、Offer、佣金和链接更新统一管理起来的返利团队。
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <a
                className="rounded-full bg-brand-emerald px-6 py-3 text-sm font-semibold text-white"
                href="mailto:hello@autocashback.dev"
              >
                联系开通
              </a>
              <Link
                className="rounded-full border border-brand-line bg-white px-6 py-3 text-sm font-semibold text-slate-700"
                href="/login"
              >
                进入后台
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
