"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";

import { fetchJson } from "@/lib/api-error-handler";
import { cn } from "@autocashback/ui";

export function LoginForm(props: {
  className?: string;
  onContactClick: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const usernameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!error) {
      return;
    }
    usernameInputRef.current?.focus();
  }, [error]);

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
    <form
      className={cn(
        "surface-panel overflow-hidden rounded-[1.4rem] border-border/80 bg-card/95",
        props.className
      )}
      onSubmit={handleSubmit}
    >
      <div className="border-b border-border/80 px-6 py-5 sm:px-8">
        <p className="label-kicker">内部登录</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-foreground">账号登录</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">输入已有账号信息，继续进入后台控制台。</p>
      </div>

      <div className="space-y-5 px-6 py-6 sm:px-8 sm:py-8">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-foreground" htmlFor="username">
            用户名或邮箱
          </label>
          <input
            id="username"
            name="username"
            autoComplete="username"
            className="w-full rounded-md border border-border bg-secondary/35 px-3 py-3 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            ref={usernameInputRef}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="name@company.com"
            required
            value={username}
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-foreground" htmlFor="password">
            密码
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            className="w-full rounded-md border border-border bg-secondary/35 px-3 py-3 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            onChange={(event) => setPassword(event.target.value)}
            placeholder="输入密码"
            required
            value={password}
          />
        </div>

        {error ? (
          <div
            aria-live="polite"
            className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-3 text-sm font-medium text-destructive"
            role="alert"
          >
            {error}
          </div>
        ) : null}

        <button className="button-primary mt-2 flex w-full" disabled={pending} type="submit">
          {pending ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : null}
          {pending ? "正在验证…" : "登录进入后台"}
          {!pending ? <ArrowRight aria-hidden="true" className="h-4 w-4" /> : null}
        </button>

        <div className="border-t border-border/80 pt-4 text-sm leading-6 text-muted-foreground">
          还没有账号？
          <button
            className="ml-1 rounded-sm font-medium text-foreground underline decoration-border underline-offset-4 transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            onClick={props.onContactClick}
            type="button"
          >
            联系管理员开通
          </button>
        </div>
      </div>
    </form>
  );
}
