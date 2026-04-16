"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { fetchJson } from "@/lib/api-error-handler";

export function LoginForm(props: {
  className?: string;
  onContactClick: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    const result = await fetchJson<{ user: { id: number } }>("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });

    if (!result.success) {
      setError(result.userMessage);
      return;
    }

    startTransition(() => {
      router.push("/dashboard");
      router.refresh();
    });
  };

  return (
    <form className={`surface-panel overflow-hidden p-0 ${props.className ?? ""}`.trim()} onSubmit={handleSubmit}>
      <div className="border-b border-brand-line/80 px-8 py-8">
        <p className="eyebrow">账号登录</p>
        <h2 className="mt-4 font-display text-4xl font-semibold text-slate-900">欢迎回来</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">请输入账号信息，登录 AutoCashBack 控制台。</p>
      </div>

      <div className="px-8 pb-8 pt-6">
        <div className="space-y-5">
          <label className="block text-sm font-medium text-slate-700">
            用户名或邮箱
            <input
              className="mt-2 w-full rounded-2xl border border-brand-line bg-stone-50 px-4 py-3 outline-none transition placeholder:text-slate-400 focus:border-brand-emerald focus:bg-white"
              onChange={(event) => setUsername(event.target.value)}
              placeholder="name@company.com"
              value={username}
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            密码
            <input
              className="mt-2 w-full rounded-2xl border border-brand-line bg-stone-50 px-4 py-3 outline-none transition placeholder:text-slate-400 focus:border-brand-emerald focus:bg-white"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              type="password"
              value={password}
            />
          </label>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        ) : null}

        <button
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-emerald px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
          disabled={pending}
          type="submit"
        >
          {pending ? "正在登录..." : "账号登录"}
          {!pending ? <ArrowRight className="h-4 w-4" /> : null}
        </button>

        <div className="mt-6 rounded-[24px] border border-brand-line bg-stone-50 px-5 py-5">
          <p className="text-sm text-slate-600">还没有账号？试用账号需先咨询开通。</p>
          <button
            className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-brand-emerald transition hover:text-emerald-500"
            onClick={props.onContactClick}
            type="button"
          >
            申请试用
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </form>
  );
}
