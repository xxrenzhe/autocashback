import Link from "next/link";
import { ArrowRight, Coins, Link2, ShieldCheck, WalletCards, Workflow } from "lucide-react";

const workflowSteps = [
  {
    title: "录入返利网账号",
    text: "按平台、国家和收款方式维护多个账号，统一记录邮箱、提现方式和运营备注。"
  },
  {
    title: "创建 Offer 并绑定标签",
    text: "录入推广链接、品牌、国家和 Campaign Label，把运营信息和 Google Ads 标签对齐。"
  },
  {
    title: "解析终链并同步脚本",
    text: "平台定时解析终链，MCC 脚本从 AutoCashBack 拉取快照并更新 Campaign / sitelink suffix。"
  }
];

const modules = [
  {
    icon: WalletCards,
    title: "账号管理",
    text: "支持同平台多账号，记录注册邮箱、提现方式和手工运营备注。"
  },
  {
    icon: Coins,
    title: "Offer 管理",
    text: "把推广链接、国家、品牌、佣金阈值和佣金进度放到同一条 Offer 记录里。"
  },
  {
    icon: Link2,
    title: "换链接管理",
    text: "定时解析终链并输出脚本快照，用户只需要复制默认脚本到 MCC 中执行。"
  }
];

const faqItems = [
  {
    question: "为什么 Rakuten 和 TopCashback 都按手工模式处理？",
    answer: "V1 不依赖公开 API，统一按手工录入和人工运营流程设计，避免接入不稳定导致系统不可用。"
  },
  {
    question: "达到佣金阈值后会自动停投吗？",
    answer: "不会。AutoCashBack 只负责预警，停投决策仍由运营手工确认，避免误伤投放。"
  },
  {
    question: "是否需要接入 Google Ads API？",
    answer: "不需要。平台只提供快照接口，MCC 脚本通过 `X-Script-Token` 鉴权读取数据并执行更新。"
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
              把返利账号、Offer、佣金预警和 MCC 换链接脚本放到同一个后台。
            </h2>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
              AutoCashBack 面向手工运营型返利网团队，把最容易出错的账号记录、Offer 配置、终链更新和人工预警统一管理，
              减少重复劳动和错链风险。
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
            <p className="eyebrow">平台边界</p>
            <div className="mt-6 grid gap-4">
              {[
                "TopCashback：手工模式，无公开 API",
                "Rakuten：手工模式，无公开 API",
                "Custom：预留自定义平台扩展"
              ].map((item) => (
                <div className="rounded-3xl bg-stone-50 p-5" key={item}>
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="h-5 w-5 text-brand-emerald" />
                    <h3 className="text-lg font-semibold text-slate-900">{item}</h3>
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
            <p className="eyebrow">脚本说明</p>
            <h3 className="mt-2 text-2xl font-semibold text-slate-900">MCC 只读快照架构</h3>
            <div className="mt-5 space-y-4 text-sm leading-7 text-slate-600">
              <p>平台通过 `/api/script/link-swap/snapshot` 输出最新 suffix 快照。</p>
              <p>脚本使用 `X-Script-Token` 鉴权，不需要 Google Ads API。</p>
              <p>脚本只更新匹配 `campaignLabel` 的 Campaign 和 sitelink，避免误伤其他广告资产。</p>
            </div>
          </div>

          <div className="surface-panel p-6">
            <div className="flex items-center gap-3">
              <Workflow className="h-5 w-5 text-brand-emerald" />
              <h3 className="text-2xl font-semibold text-slate-900">为什么团队更容易落地</h3>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-[24px] bg-stone-50 p-5">
                <p className="text-sm font-semibold text-slate-900">统一记录</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">账号、Offer、脚本和佣金阈值不再散落在表格、文档和脚本注释里。</p>
              </div>
              <div className="rounded-[24px] bg-stone-50 p-5">
                <p className="text-sm font-semibold text-slate-900">人工可控</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">V1 只负责预警和换链，不自动停投，减少自动化误操作风险。</p>
              </div>
              <div className="rounded-[24px] bg-stone-50 p-5">
                <p className="text-sm font-semibold text-slate-900">部署简单</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">单容器部署，最小环境变量明确，适合小团队快速上线。</p>
              </div>
              <div className="rounded-[24px] bg-stone-50 p-5">
                <p className="text-sm font-semibold text-slate-900">对接轻量</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">运营侧只需复制默认脚本，不需要维护额外的 Drive 文件或 Ads API 凭证。</p>
              </div>
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
                让返利网运营从“脚本+表格”切到统一后台
              </h3>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
                AutoCashBack 适合需要稳定管理多账号、多 Offer、多国家投放的返利网团队。
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
