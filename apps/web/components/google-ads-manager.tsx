"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  KeyRound,
  RefreshCcw,
  ShieldCheck,
  TestTube2
} from "lucide-react";

import type { GoogleAdsAccountRecord, GoogleAdsCredentialStatus } from "@autocashback/domain";

import { fetchJson } from "@/lib/api-error-handler";
import { buildGoogleAdsOverview } from "@/lib/google-ads-overview";

type MessageTone = "info" | "success" | "warning" | "error";
type DiagnosePayload = {
  loginCustomerId: string | null;
  accessibleCustomers: string[];
  sampledCount: number;
  customers: Array<{
    customerId: string;
    ok: boolean;
    descriptiveName?: string | null;
    manager?: boolean | null;
    testAccount?: boolean | null;
    currencyCode?: string | null;
    timeZone?: string | null;
    status?: string | null;
    error?: {
      message: string;
      code: string;
      hint?: string;
    };
  }>;
  probeCustomerId: string | null;
  probe?: {
    error?: {
      message: string;
      code: string;
      hint?: string;
    };
  } | null;
  summary: {
    totalAccessible: number;
    okCount: number;
    errorCount: number;
    testAccountTrue: number;
    testAccountFalse: number;
  };
};

function getGoogleAdsStatusMessage(code: string): { tone: MessageTone; text: string } {
  switch (code) {
    case "oauth_connected":
      return {
        tone: "success",
        text: "Google Ads OAuth 已连接，账号列表已刷新。"
      };
    case "missing_login_customer_id":
      return {
        tone: "warning",
        text: "请先在设置页配置 Login Customer ID（MCC 账号 ID），再发起 OAuth 授权。"
      };
    case "missing_google_ads_config":
      return {
        tone: "warning",
        text: "请先在设置页完成 Google Ads API 基础配置，再发起 OAuth 授权。"
      };
    case "developer_token_invalid":
      return {
        tone: "error",
        text: "Developer Token 配置看起来不正确，疑似误填为 OAuth Client Secret 或其他凭证。"
      };
    case "missing_code":
      return {
        tone: "error",
        text: "Google Ads OAuth 回调缺少授权 code，请重新发起授权。"
      };
    case "missing_refresh_token":
      return {
        tone: "error",
        text: "Google Ads OAuth 未返回 Refresh Token。请重新授权，并确保 Google 授权页允许离线访问。"
      };
    case "invalid_state":
      return {
        tone: "error",
        text: "Google Ads OAuth state 无效，请重新发起授权。"
      };
    case "state_expired":
      return {
        tone: "error",
        text: "Google Ads OAuth state 已过期，请在 10 分钟内完成授权。"
      };
    case "google_ads_oauth":
      return {
        tone: "error",
        text: "无法识别当前 OAuth 回调对应的用户，请重新登录后再试。"
      };
    default:
      return {
        tone: "error",
        text: `Google Ads 授权失败：${code}`
      };
  }
}

function OverviewCard({
  icon: Icon,
  label,
  note,
  tone,
  value
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  note: string;
  tone: "emerald" | "amber" | "slate";
  value: string;
}) {
  const toneStyles = {
    emerald: {
      badge: "bg-primary/10 text-primary",
      icon: "bg-primary/10 text-primary"
    },
    amber: {
      badge: "bg-amber-500/10 text-amber-600",
      icon: "bg-amber-500/10 text-amber-600"
    },
    slate: {
      badge: "bg-slate-100 text-foreground",
      icon: "bg-slate-100 text-foreground"
    }
  } as const;

  return (
    <div className="bg-card text-card-foreground rounded-xl border shadow-sm p-5">
      <div className="flex items-start justify-between gap-4">
        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${toneStyles[tone].badge}`}>
          {label}
        </span>
        <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${toneStyles[tone].icon}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-5 font-mono text-4xl font-semibold text-foreground">{value}</p>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{note}</p>
    </div>
  );
}

export function GoogleAdsManager() {
  const [credentials, setCredentials] = useState<GoogleAdsCredentialStatus | null>(null);
  const [accounts, setAccounts] = useState<GoogleAdsAccountRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<MessageTone>("info");
  const [diagnosing, setDiagnosing] = useState(false);
  const [probeCustomerId, setProbeCustomerId] = useState("");
  const [diagnoseResult, setDiagnoseResult] = useState<DiagnosePayload | null>(null);

  const overview = useMemo(() => buildGoogleAdsOverview(credentials, accounts), [accounts, credentials]);

  async function loadAll(options?: { refreshAccounts?: boolean; preserveMessage?: boolean }) {
    const refreshAccounts = Boolean(options?.refreshAccounts);
    setLoading(true);
    if (!options?.preserveMessage) {
      setMessage("");
      setMessageTone("info");
    }

    try {
      const credentialsResult = await fetchJson<{ credentials: GoogleAdsCredentialStatus | null }>(
        "/api/google-ads/credentials"
      );

      if (!credentialsResult.success) {
        throw new Error(credentialsResult.userMessage);
      }

      const nextCredentials = (credentialsResult.data.credentials || null) as GoogleAdsCredentialStatus | null;
      setCredentials(nextCredentials);

      if (!nextCredentials?.hasRefreshToken && !refreshAccounts) {
        setAccounts([]);
        return;
      }

      const accountsResult = await fetchJson<{ accounts: GoogleAdsAccountRecord[] }>(
        `/api/google-ads/credentials/accounts${refreshAccounts ? "?refresh=true" : ""}`
      );
      if (!accountsResult.success) {
        throw new Error(accountsResult.userMessage);
      }

      setAccounts(accountsResult.data.accounts || []);
    } catch (error: unknown) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "加载 Google Ads 数据失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    const success = url.searchParams.get("success");
    const error = url.searchParams.get("error");

    if (success === "oauth_connected") {
      void (async () => {
        await loadAll({
          refreshAccounts: true,
          preserveMessage: true
        });
        setMessageTone("success");
        setMessage(getGoogleAdsStatusMessage(success).text);
      })();
    } else if (error) {
      const status = getGoogleAdsStatusMessage(error);
      setMessageTone(status.tone);
      setMessage(status.text);
    }
  }, []);

  async function verifyAndSync(refresh = true) {
    setSyncing(true);
    setMessage("");

    try {
      const verifyResult = await fetchJson<{ accountCount?: number }>("/api/google-ads/credentials/verify", {
        method: "POST"
      });
      if (!verifyResult.success) {
        throw new Error(verifyResult.userMessage);
      }

      await loadAll({
        refreshAccounts: refresh,
        preserveMessage: true
      });
      setMessageTone("success");
      setMessage(`Google Ads 配置验证成功，已同步 ${verifyResult.data.accountCount || 0} 个账号。`);
    } catch (error: unknown) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Google Ads 验证失败");
    } finally {
      setSyncing(false);
    }
  }

  const canConnect = Boolean(
    credentials?.hasClientId &&
      credentials?.hasClientSecret &&
      credentials?.hasDeveloperToken &&
      credentials?.loginCustomerId
  );
  const hasStoredConfig = Boolean(credentials?.hasCredentials);
  const needsOAuth = Boolean(hasStoredConfig && !credentials?.hasRefreshToken);
  const messageClassName =
    messageTone === "success"
      ? "text-primary"
      : messageTone === "warning"
        ? "text-amber-600"
        : messageTone === "error"
          ? "text-destructive"
          : "text-muted-foreground";

  async function diagnoseCredentials() {
    setDiagnosing(true);
    setMessage("");

    const result = await fetchJson<{ data: DiagnosePayload }>("/api/google-ads/diagnose", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        probeCustomerId: probeCustomerId.trim() || undefined,
        maxCustomers: 20
      })
    });

    if (!result.success) {
      setMessageTone("error");
      setMessage(result.userMessage);
      setDiagnoseResult(null);
      setDiagnosing(false);
      return;
    }

    setDiagnoseResult(result.data.data);
    setMessageTone("success");
    setMessage("Google Ads 诊断完成，可据此判断 MCC、Developer Token 和 OAuth 权限问题。");
    setDiagnosing(false);
  }

  return (
    <div className="space-y-6">
      <section className="bg-card text-card-foreground rounded-xl border shadow-sm overflow-hidden p-0">
        <div className="grid gap-0 xl:grid-cols-[1.05fr,0.95fr]">
          <div className="bg-[radial-gradient(circle_at_top_left,rgba(5,150,105,0.16),transparent_48%),linear-gradient(180deg,rgba(236,253,245,0.95)_0%,rgba(255,255,255,0.98)_100%)] px-6 py-7 sm:px-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">Google Ads</p>
                <h2 className="mt-3 text-xl font-semibold tracking-tight tracking-tight tracking-tight text-foreground">账号连接控制台</h2>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">
                  先确认基础配置、OAuth 状态和可访问账号数量，再决定是去设置页补参数，还是直接同步和诊断。
                </p>
              </div>
              <button
                className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground transition hover:bg-muted/40 disabled:opacity-60"
                disabled={syncing}
                onClick={() => verifyAndSync(true)}
                type="button"
              >
                <RefreshCcw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "同步中" : "快速同步"}
              </button>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Link
                className="group rounded-xl border border-border bg-background/90 p-4 transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md motion-reduce:transform-none"
                href="/settings#google-ads-settings"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <ShieldCheck className="h-5 w-5" />
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground/80 transition group-hover:text-primary" />
                </div>
                <p className="mt-4 text-sm font-semibold text-foreground">补齐基础配置</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">去设置页维护 Client ID、Developer Token 和 Login Customer ID。</p>
              </Link>

              <button
                className="group rounded-xl border border-border bg-background/90 p-4 text-left transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md motion-reduce:transform-none disabled:opacity-60"
                disabled={!canConnect}
                onClick={() => {
                  window.location.href = "/api/auth/google-ads/authorize";
                }}
                type="button"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <KeyRound className="h-5 w-5" />
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground/80 transition group-hover:text-primary" />
                </div>
                <p className="mt-4 text-sm font-semibold text-foreground">发起 OAuth 授权</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">基础参数完整后再授权，避免无效回调和重复操作。</p>
              </button>

              <button
                className="group rounded-xl border border-border bg-background/90 p-4 text-left transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md motion-reduce:transform-none disabled:opacity-60"
                disabled={!credentials?.hasRefreshToken || syncing}
                onClick={() => verifyAndSync(true)}
                type="button"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Building2 className="h-5 w-5" />
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground/80 transition group-hover:text-primary" />
                </div>
                <p className="mt-4 text-sm font-semibold text-foreground">同步账号</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">刷新可访问 Customer 列表，确认 MCC 和广告账号映射。</p>
              </button>

              <button
                className="group rounded-xl border border-border bg-background/90 p-4 text-left transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md motion-reduce:transform-none disabled:opacity-60"
                disabled={!credentials?.hasRefreshToken || diagnosing}
                onClick={diagnoseCredentials}
                type="button"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <TestTube2 className="h-5 w-5" />
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground/80 transition group-hover:text-primary" />
                </div>
                <p className="mt-4 text-sm font-semibold text-foreground">执行诊断</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">快速定位 MCC 权限、Developer Token 和测试账号问题。</p>
              </button>
            </div>
          </div>

          <div className="border-t border-border/70 bg-background/80 px-6 py-7 xl:border-l xl:border-t-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">连接状态</p>
            <div className="mt-5 grid gap-3">
              <div className="rounded-xl border border-border bg-muted/40 p-4">
                <p className="text-sm font-semibold text-foreground">当前最需要关注</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {!overview.hasBaseConfig
                    ? "还没有完成 Google Ads 基础配置。"
                    : overview.needsOAuth
                      ? "基础配置已齐，但还没有可用的 Refresh Token。"
                      : "Google Ads 连接已可用，可继续同步账号或执行诊断。"}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-muted/40 p-4">
                <p className="text-sm font-semibold text-foreground">最近验证</p>
                <p className="mt-2 text-sm text-muted-foreground">{credentials?.lastVerifiedAt || "尚未验证"}</p>
              </div>
              <div className="rounded-xl border border-border bg-muted/40 p-4">
                <p className="text-sm font-semibold text-foreground">Refresh Token</p>
                <p className="mt-2 text-sm text-muted-foreground">{credentials?.hasRefreshToken ? "已获取" : "未授权"}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-4">
        <OverviewCard
          icon={ShieldCheck}
          label="连接状态"
          note={
            overview.fullyConnected
              ? "基础配置和 OAuth 都已完成。"
              : overview.needsOAuth
                ? "基础配置已齐，下一步需要 OAuth。"
                : "仍需补齐 Google Ads 基础配置。"
          }
          tone={overview.fullyConnected ? "emerald" : "amber"}
          value={overview.fullyConnected ? "ready" : overview.needsOAuth ? "oauth" : "setup"}
        />
        <OverviewCard
          icon={Building2}
          label="可访问账号"
          note="当前同步到本地的 Google Ads 账号总数。"
          tone="slate"
          value={`${overview.accountCount}`}
        />
        <OverviewCard
          icon={ShieldCheck}
          label="Manager 账号"
          note="可访问账号中的 MCC / Manager 数量。"
          tone="slate"
          value={`${overview.managerCount}`}
        />
        <OverviewCard
          icon={CheckCircle2}
          label="测试账号"
          note="标记为测试环境的账号数量。"
          tone={overview.testAccountCount > 0 ? "amber" : "emerald"}
          value={`${overview.testAccountCount}`}
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.9fr,1.1fr]">
        <div className="bg-card text-card-foreground rounded-xl border shadow-sm p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">OAuth 状态</p>
          <h3 className="mt-2 text-xl font-semibold tracking-tight text-foreground">Google Ads 连接</h3>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            查看当前账号的 Google Ads 连接状态，并完成授权、验证和可访问账号同步。
          </p>

          <div className="mt-5 grid gap-3">
            <div className="rounded-xl border border-border bg-muted/40 p-5 text-sm text-foreground">
              <p>基础配置：{credentials?.hasCredentials ? "已保存" : "未完成"}</p>
              <p className="mt-2">Refresh Token：{credentials?.hasRefreshToken ? "已获取" : "未授权"}</p>
              <p className="mt-2">最近验证：{credentials?.lastVerifiedAt || "尚未验证"}</p>
              <p className="mt-2">Token 过期：{credentials?.tokenExpiresAt || "未获取"}</p>
            </div>

            {!hasStoredConfig ? (
              <div className="rounded-xl border border-amber-200 bg-amber-500/10 p-5 text-sm leading-6 text-amber-800">
                还没有完成 Google Ads API 基础配置。请先前往设置页保存 `Client ID / Client Secret / Developer Token / Login Customer ID`，
                然后发起 OAuth 授权。
              </div>
            ) : null}

            {needsOAuth ? (
              <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-5 text-sm leading-6 text-destructive">
                基础配置已保存，但当前账号还没有可用的 Refresh Token。这个状态下无法同步账号，也无法让换链接任务调用
                Google Ads API。
              </div>
            ) : null}
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground"
              href="/settings"
            >
              前往设置
            </Link>
            <button
              className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground disabled:opacity-60"
              disabled={!canConnect}
              onClick={() => {
                window.location.href = "/api/auth/google-ads/authorize";
              }}
              type="button"
            >
              发起 OAuth 授权
            </button>
            <button
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              disabled={!credentials?.hasRefreshToken || syncing}
              onClick={() => verifyAndSync(true)}
              type="button"
            >
              {syncing ? "同步中..." : "验证并同步账号"}
            </button>
          </div>

          {message ? <p className={`mt-4 text-sm ${messageClassName}`}>{message}</p> : null}
        </div>

        <div className="bg-card text-card-foreground rounded-xl border shadow-sm p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">账号映射</p>
              <h3 className="mt-2 text-xl font-semibold tracking-tight text-foreground">可访问 Google Ads 账号</h3>
            </div>
            <span className="rounded-full bg-muted px-3 py-2 font-mono text-xs text-muted-foreground">
              {accounts.length} accounts
            </span>
          </div>

          <div className="mt-5 overflow-x-auto">
            {loading ? (
              <p className="rounded-lg bg-muted/40 px-4 py-5 text-sm text-muted-foreground">正在加载账号...</p>
            ) : accounts.length ? (
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border/70 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    <th className="pb-3">账号</th>
                    <th className="pb-3">类型</th>
                    <th className="pb-3">状态</th>
                    <th className="pb-3">币种 / 时区</th>
                    <th className="pb-3">最近同步</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((account) => (
                    <tr className="border-b border-border/40 align-top" key={account.id}>
                      <td className="py-4 pr-4">
                        <div>
                          <p className="font-semibold text-foreground">
                            {account.descriptiveName || `Customer ${account.customerId}`}
                          </p>
                          <p className="mt-1 font-mono text-xs text-muted-foreground">{account.customerId}</p>
                        </div>
                      </td>
                      <td className="py-4 pr-4">
                        <div className="flex flex-wrap gap-2 text-xs">
                          {account.manager ? (
                            <span className="rounded-full bg-amber-500/10 px-3 py-1 font-semibold text-amber-600">
                              Manager
                            </span>
                          ) : (
                            <span className="rounded-full bg-primary/10 px-3 py-1 font-semibold text-primary">
                              Customer
                            </span>
                          )}
                          {account.testAccount ? (
                            <span className="rounded-full bg-stone-200 px-3 py-1 font-semibold text-foreground">
                              Test
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="py-4 pr-4 text-foreground">{account.status || "--"}</td>
                      <td className="py-4 pr-4 text-foreground">
                        <p>{account.currencyCode || "--"}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{account.timeZone || "--"}</p>
                      </td>
                      <td className="py-4 text-foreground">{account.lastSyncAt || "--"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="rounded-lg bg-muted/40 px-4 py-5 text-sm text-muted-foreground">
                暂无可访问账号。先在设置页保存 Google Ads 基础配置，再完成 OAuth 授权。
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="bg-card text-card-foreground rounded-xl border shadow-sm p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">诊断工具</p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight text-foreground">Google Ads OAuth / MCC 诊断</h3>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              诊断结果会帮助你确认可访问客户号、账号类型和常见权限问题，同时不会在浏览器中暴露敏感凭证。
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <input
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              onChange={(event) => setProbeCustomerId(event.target.value)}
              placeholder="可选：额外探测 Customer ID"
              value={probeCustomerId}
            />
            <button
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              disabled={!credentials?.hasRefreshToken || diagnosing}
              onClick={diagnoseCredentials}
              type="button"
            >
              {diagnosing ? "诊断中..." : "执行诊断"}
            </button>
          </div>
        </div>

        {diagnoseResult ? (
          <div className="mt-6 space-y-4">
            <div className="grid gap-4 md:grid-cols-4">
              <InfoCard label="可访问账号" value={diagnoseResult.summary.totalAccessible} />
              <InfoCard label="读取成功" value={diagnoseResult.summary.okCount} />
              <InfoCard label="读取失败" value={diagnoseResult.summary.errorCount} />
              <InfoCard label="测试账号" value={diagnoseResult.summary.testAccountTrue} />
            </div>

            {diagnoseResult.probe?.error ? (
              <div className="rounded-xl border border-amber-200 bg-amber-500/10 p-5 text-sm text-amber-800">
                <p className="font-semibold">探测 Customer ID 失败</p>
                <p className="mt-2">{diagnoseResult.probe.error.code}</p>
                {diagnoseResult.probe.error.hint ? <p className="mt-2">{diagnoseResult.probe.error.hint}</p> : null}
              </div>
            ) : null}

            <div className="grid gap-3">
              {diagnoseResult.customers.map((customer) => (
                <div className="rounded-xl border border-border bg-muted/40 p-5" key={customer.customerId}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {customer.descriptiveName || `Customer ${customer.customerId}`}
                      </p>
                      <p className="mt-1 font-mono text-xs text-muted-foreground">{customer.customerId}</p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        customer.ok ? "bg-emerald-50 text-emerald-700" : "bg-destructive/10 text-destructive"
                      }`}
                    >
                      {customer.ok ? "读取成功" : customer.error?.code || "失败"}
                    </span>
                  </div>

                  {customer.ok ? (
                    <div className="mt-4 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                      <p>Manager：{customer.manager ? "是" : "否"}</p>
                      <p>Test Account：{customer.testAccount ? "是" : "否"}</p>
                      <p>币种：{customer.currencyCode || "--"}</p>
                      <p>时区：{customer.timeZone || "--"}</p>
                    </div>
                  ) : (
                    <div className="mt-4 rounded-lg border border-red-100 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      <p>{customer.error?.message || "未知错误"}</p>
                      {customer.error?.hint ? <p className="mt-2">{customer.error.hint}</p> : null}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function InfoCard(props: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-muted/40 p-5">
      <p className="text-sm text-muted-foreground">{props.label}</p>
      <p className="mt-3 font-mono text-xl font-semibold tracking-tight tracking-tight text-foreground">{props.value}</p>
    </div>
  );
}
