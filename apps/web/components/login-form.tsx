"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });

    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error || "登录失败");
      return;
    }

    startTransition(() => {
      router.push("/dashboard");
      router.refresh();
    });
  };

  return (
    <form className="surface-panel p-8" onSubmit={handleSubmit}>
      <p className="eyebrow">账号登录</p>
      <h2 className="mt-4 font-display text-4xl font-semibold text-slate-900">回到你的运营后台</h2>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        管理员开通账号后，用户在这里登录 AutoCashBack，继续维护账号、Offer 和换链接任务。
      </p>

      <div className="mt-8 space-y-4">
        <label className="block text-sm font-medium text-slate-700">
          用户名或邮箱
          <input
            className="mt-2 w-full rounded-2xl border border-brand-line bg-stone-50 px-4 py-3 outline-none transition focus:border-brand-emerald"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          密码
          <input
            className="mt-2 w-full rounded-2xl border border-brand-line bg-stone-50 px-4 py-3 outline-none transition focus:border-brand-emerald"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
      </div>

      {error ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      ) : null}

      <button
        className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-brand-emerald px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90"
        disabled={pending}
        type="submit"
      >
        {pending ? "正在登录..." : "登录 AutoCashBack"}
      </button>
    </form>
  );
}
