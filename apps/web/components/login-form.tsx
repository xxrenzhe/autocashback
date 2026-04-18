"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, KeyRound, Loader2, ShieldCheck } from "lucide-react";

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
    <form className={cn("bg-card text-card-foreground rounded-xl border shadow-sm overflow-hidden", props.className)} onSubmit={handleSubmit}>
      <div className="border-b border-border bg-muted/30 px-8 py-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">安全登录</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-foreground">欢迎回来</h2>
            <p className="mt-2 text-sm text-muted-foreground">请输入管理员开通的账号信息，登录系统后台。</p>
          </div>
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary ring-1 ring-inset ring-primary/20">
            内部系统
          </span>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border bg-background/50 p-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
              统一授权
            </div>
            <p className="mt-1 text-xs text-muted-foreground">账号权限由管理员从后台统一分配。</p>
          </div>
          <div className="rounded-lg border bg-background/50 p-3">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <KeyRound className="h-4 w-4 text-amber-500" aria-hidden="true" />
              安全控制
            </div>
            <p className="mt-1 text-xs text-muted-foreground">重置密码后，所有旧设备的会话将自动失效。</p>
          </div>
        </div>
      </div>

      <div className="px-8 pb-8 pt-6">
        <div className="space-y-4">
          <label className="block text-sm font-medium text-foreground" htmlFor="username">
            用户名或邮箱
          </label>
          <input
            id="username"
            name="username"
            autoComplete="username"
            className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
            ref={usernameInputRef}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="name@company.com"
            value={username}
            required
          />
          
          <label className="block mt-4 text-sm font-medium text-foreground" htmlFor="password">
            密码
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
            value={password}
            required
          />
        </div>

        {error ? (
          <div className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm font-medium text-destructive" role="alert" aria-live="polite">
            {error}
          </div>
        ) : null}

        <button
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={pending}
          type="submit"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
          {pending ? "正在验证…" : "安全登录"}
          {!pending ? <ArrowRight className="h-4 w-4" aria-hidden="true" /> : null}
        </button>

        <div className="mt-6 flex flex-col items-center justify-center rounded-lg border bg-muted/30 p-4 text-center">
          <p className="text-sm text-muted-foreground">还没有账号？</p>
          <button
            className="mt-1 text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-sm"
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
