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
    <form className={cn("overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm", props.className)} onSubmit={handleSubmit}>
      <div className="px-6 pb-6 pt-6 sm:px-8 sm:pb-8 sm:pt-8">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">账号登录</h2>
          <p className="mt-1 text-sm text-muted-foreground">输入账号信息，继续进入后台。</p>
        </div>

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
          
          <label className="mt-4 block text-sm font-medium text-foreground" htmlFor="password">
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
          {pending ? "正在验证…" : "登录"}
          {!pending ? <ArrowRight className="h-4 w-4" aria-hidden="true" /> : null}
        </button>

        <div className="mt-6 text-sm text-muted-foreground">
          还没有账号？
          <button
            className="ml-1 rounded-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
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
