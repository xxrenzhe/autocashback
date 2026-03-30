import Link from "next/link";
import { ArrowRight, Coins, Link2, ShieldCheck, WalletCards } from "lucide-react";

const steps = [
  {
    title: "录入返利网账号",
    text: "支持同平台多账号管理，统一保存注册邮箱、提现方式和平台说明。"
  },
  {
    title: "创建 Offer 并绑定标签",
    text: "录入推广链接、国家、品牌名与 Campaign Label，后续脚本只更新匹配标签的广告。"
  },
  {
    title: "平台解析终链 + MCC 自动换链",
    text: "后台定时解析终链，MCC 脚本从 AutoCashBack 拉取最新快照并更新 suffix。"
  }
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#d1fae5,transparent_28%),radial-gradient(circle_at_top_right,#fde68a,transparent_22%),linear-gradient(180deg,#f7f4ec_0%,#fbfaf6_100%)]">
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

        <section className="grid gap-8 pb-20 pt-12 lg:grid-cols-[1.15fr,0.85fr] lg:pt-20">
          <div>
            <p className="eyebrow">Editorial Cashback Ops</p>
            <h2 className="mt-5 max-w-4xl font-display text-5xl font-semibold leading-tight text-slate-900 lg:text-7xl">
              把返利账号、Offer、终链解析和 MCC 换链接脚本放到同一个后台。
            </h2>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
              AutoCashBack 面向手工运营型返利网团队，把最容易出错的账号记录、Offer 配置、终链更新和阈值预警统一管理，减少重复劳动和错链风险。
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
            <p className="eyebrow">平台能力</p>
            <div className="mt-6 grid gap-4">
              <div className="rounded-3xl bg-brand-mist p-5">
                <div className="flex items-center gap-3">
                  <WalletCards className="h-5 w-5 text-brand-emerald" />
                  <h3 className="text-lg font-semibold text-slate-900">账号管理</h3>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  支持同平台多个返利账号，记录注册邮箱、提现方式和运营备注。
                </p>
              </div>
              <div className="rounded-3xl bg-amber-50 p-5">
                <div className="flex items-center gap-3">
                  <Link2 className="h-5 w-5 text-amber-600" />
                  <h3 className="text-lg font-semibold text-slate-900">终链解析与换链接</h3>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  平台定时解析推广链接，MCC 脚本只读取 AutoCashBack 的快照，不再手工维护 Drive 文件。
                </p>
              </div>
              <div className="rounded-3xl bg-stone-100 p-5">
                <div className="flex items-center gap-3">
                  <Coins className="h-5 w-5 text-slate-700" />
                  <h3 className="text-lg font-semibold text-slate-900">佣金阈值预警</h3>
                </div>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  当手工录入佣金超过阈值时自动预警，V1 先走人工确认停投，避免误操作。
                </p>
              </div>
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
            {steps.map((step, index) => (
              <article className="rounded-[28px] border border-brand-line bg-stone-50 p-6" key={step.title}>
                <p className="text-sm font-semibold text-brand-emerald">0{index + 1}</p>
                <h4 className="mt-3 text-xl font-semibold text-slate-900">{step.title}</h4>
                <p className="mt-3 text-sm leading-6 text-slate-600">{step.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-6 pb-20 pt-10 lg:grid-cols-3">
          {[
            "TopCashback：手工模式，无公开 API",
            "Rakuten：手工模式，无公开 API",
            "Custom：预留自定义平台扩展"
          ].map((item) => (
            <div className="surface-subtle px-6 py-5" key={item}>
              <ShieldCheck className="h-5 w-5 text-brand-emerald" />
              <p className="mt-3 text-sm font-medium text-slate-700">{item}</p>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
