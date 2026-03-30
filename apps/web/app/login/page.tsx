import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f7f4ec_0%,#fbfaf6_100%)] px-5 py-8">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl items-center gap-10 lg:grid-cols-[1.05fr,0.95fr]">
        <section>
          <p className="eyebrow">AutoCashBack</p>
          <h1 className="mt-5 max-w-3xl font-display text-5xl font-semibold leading-tight text-slate-900 lg:text-6xl">
            为返利网团队建立统一的账号、Offer 与换链接执行中心。
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            登录后进入后台管理系统。用户区域聚焦账号、Offer 和脚本配置，管理员区域负责账号开通和用户管理。
          </p>
        </section>
        <LoginForm />
      </div>
    </main>
  );
}
