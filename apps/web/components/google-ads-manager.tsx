"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Building2,
} from "lucide-react";

import type { GoogleAdsAccountRecord, GoogleAdsCredentialStatus } from "@autocashback/domain";
import { EmptyState, PageHeader, TableSkeleton, cn } from "@autocashback/ui";
import { toast } from "sonner";

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

function getOverviewStatusLabel(input: { fullyConnected: boolean; needsOAuth: boolean }) {
  if (input.fullyConnected) {
    return "已连通";
  }

  if (input.needsOAuth) {
    return "待授权";
  }

  return "待配置";
}

function getAccountTypeLabel(input: { manager?: boolean | null; testAccount?: boolean | null }) {
  return {
    primary: input.manager ? "经理账号" : "普通账号",
    secondary: input.testAccount ? "测试账号" : null
  };
}

function getAccountDisplayName(customerId: string, descriptiveName?: string | null) {
  return descriptiveName || `账号 ${customerId}`;
}

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

export function GoogleAdsManager() {
  const [credentials, setCredentials] = useState<GoogleAdsCredentialStatus | null>(null);
  const [accounts, setAccounts] = useState<GoogleAdsAccountRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [diagnosing, setDiagnosing] = useState(false);
  const [probeCustomerId, setProbeCustomerId] = useState("");
  const [diagnoseResult, setDiagnoseResult] = useState<DiagnosePayload | null>(null);

  const overview = useMemo(() => buildGoogleAdsOverview(credentials, accounts), [accounts, credentials]);
  const overviewStatusLabel = getOverviewStatusLabel(overview);

  function showStatusToast(status: { tone: MessageTone; text: string }) {
    if (status.tone === "success") {
      toast.success(status.text);
      return;
    }

    if (status.tone === "warning") {
      toast.warning(status.text);
      return;
    }

    if (status.tone === "info") {
      toast.info(status.text);
      return;
    }

    toast.error(status.text);
  }

  async function loadAll(options?: { refreshAccounts?: boolean }) {
    const refreshAccounts = Boolean(options?.refreshAccounts);
    setLoading(true);

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
        return true;
      }

      const accountsResult = await fetchJson<{ accounts: GoogleAdsAccountRecord[] }>(
        `/api/google-ads/credentials/accounts${refreshAccounts ? "?refresh=true" : ""}`
      );
      if (!accountsResult.success) {
        throw new Error(accountsResult.userMessage);
      }

      setAccounts(accountsResult.data.accounts || []);
      return true;
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "加载 Google Ads 数据失败");
      return false;
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    const success = url.searchParams.get("success");
    const error = url.searchParams.get("error");

    if (!success && !error) {
      return;
    }

    void (async () => {
      if (success === "oauth_connected") {
        const refreshed = await loadAll({
          refreshAccounts: true
        });
        if (refreshed) {
          showStatusToast(getGoogleAdsStatusMessage(success));
        }
      } else if (error) {
        showStatusToast(getGoogleAdsStatusMessage(error));
      }

      url.searchParams.delete("success");
      url.searchParams.delete("error");
      const nextSearch = url.searchParams.toString();
      window.history.replaceState({}, "", `${url.pathname}${nextSearch ? `?${nextSearch}` : ""}${url.hash}`);
    })();
  }, []);

  async function diagnoseCredentials() {
    setDiagnosing(true);

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
      toast.error(result.userMessage);
      setDiagnoseResult(null);
      setDiagnosing(false);
      return;
    }

    setDiagnoseResult(result.data.data);
    toast.success("Google Ads 诊断完成，可据此判断 MCC、Developer Token 和 OAuth 权限问题。");
    setDiagnosing(false);
  }

  return (
    <div className="space-y-4">
      <PageHeader
        actions={
          <Link
            className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground"
            href="/settings#google-ads-settings"
          >
            前往设置
          </Link>
        }
        badge={
          <span className="rounded-md border border-border bg-muted/60 px-2.5 py-1 text-xs font-semibold text-muted-foreground">
            {overviewStatusLabel}
          </span>
        }
        description="查看账号映射与 MCC 诊断；配置和授权统一在设置页处理。"
        title="Google Ads"
      />

      <section className="rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm">
        <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div>
            <dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">连接状态</dt>
            <dd
              className={cn(
                "mt-1 text-2xl font-semibold tracking-tight",
                overview.fullyConnected ? "text-emerald-700" : "text-amber-700"
              )}
            >
              {overviewStatusLabel}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">可访问账号</dt>
            <dd className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{overview.accountCount}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">经理账号</dt>
            <dd className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{overview.managerCount}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">测试账号</dt>
            <dd className={cn("mt-1 text-2xl font-semibold tracking-tight", overview.testAccountCount > 0 ? "text-amber-700" : "text-foreground")}>
              {overview.testAccountCount}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">最近验证</dt>
            <dd className="mt-1 text-sm leading-6 text-muted-foreground">{credentials?.lastVerifiedAt || "--"}</dd>
          </div>
        </dl>
      </section>

      <section className="overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
        <div className="border-b border-border/70 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">账号映射</p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight text-foreground">可访问账号</h2>
            </div>
            <span className="rounded-md border border-border bg-muted/60 px-2.5 py-1.5 font-mono tabular-nums text-xs text-muted-foreground">
              {accounts.length} 个账号
            </span>
          </div>
        </div>

        <div className="p-4">
          <div className="overflow-x-auto">
            {loading ? (
              <TableSkeleton rows={5} />
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
                  {accounts.map((account) => {
                    const typeLabel = getAccountTypeLabel(account);

                    return (
                    <tr className="border-b border-border/40 align-middle" key={account.id}>
                      <td className="py-3 pr-4">
                        <div>
                          <p className="font-semibold text-foreground">
                            {getAccountDisplayName(account.customerId, account.descriptiveName)}
                          </p>
                          <p className="mt-1 font-mono tabular-nums text-xs text-muted-foreground">{account.customerId}</p>
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex flex-wrap gap-2 text-xs">
                          {account.manager ? (
                            <span className="rounded-md border border-amber-200 bg-amber-500/10 px-3 py-1 font-semibold text-amber-600">
                              {typeLabel.primary}
                            </span>
                          ) : (
                            <span className="rounded-md border border-primary/15 bg-primary/10 px-3 py-1 font-semibold text-primary">
                              {typeLabel.primary}
                            </span>
                          )}
                          {typeLabel.secondary ? (
                            <span className="rounded-md border border-border bg-stone-200 px-3 py-1 font-semibold text-foreground">
                              {typeLabel.secondary}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-foreground">{account.status || "--"}</td>
                      <td className="py-3 pr-4 text-foreground">
                        <p>{account.currencyCode || "--"}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{account.timeZone || "--"}</p>
                      </td>
                      <td className="py-3 text-foreground">{account.lastSyncAt || "--"}</td>
                    </tr>
                  )})}
                </tbody>
              </table>
            ) : (
              <EmptyState icon={Building2} title="暂无可访问账号" />
            )}
          </div>
        </div>
      </section>

      <section className="rounded-xl border bg-card p-4 text-card-foreground shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-foreground">OAuth / MCC 诊断</h3>
            <p className="text-xs text-muted-foreground">快速判断 OAuth、MCC 和账号读取异常，只保留排障需要的信息。</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <input
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
              onChange={(event) => setProbeCustomerId(event.target.value)}
              placeholder="可选：额外探测账号 ID"
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
          <div className="mt-4 space-y-4">
            <dl className="grid gap-3 rounded-lg border border-border bg-muted/20 px-4 py-3 md:grid-cols-4">
              <div>
                <dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">可访问账号</dt>
                <dd className="mt-1 font-mono tabular-nums text-xl font-semibold tracking-tight text-foreground">{diagnoseResult.summary.totalAccessible}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">读取成功</dt>
                <dd className="mt-1 font-mono tabular-nums text-xl font-semibold tracking-tight text-foreground">{diagnoseResult.summary.okCount}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">读取失败</dt>
                <dd className="mt-1 font-mono tabular-nums text-xl font-semibold tracking-tight text-foreground">{diagnoseResult.summary.errorCount}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">测试账号</dt>
                <dd className="mt-1 font-mono tabular-nums text-xl font-semibold tracking-tight text-foreground">{diagnoseResult.summary.testAccountTrue}</dd>
              </div>
            </dl>

            {diagnoseResult.probe?.error ? (
              <div className="rounded-lg border border-amber-200 bg-amber-500/10 px-4 py-3 text-sm text-amber-800">
                <p className="font-semibold">探测账号 ID 失败 · {diagnoseResult.probe.error.code}</p>
                {diagnoseResult.probe.error.hint ? <p className="mt-1">{diagnoseResult.probe.error.hint}</p> : null}
              </div>
            ) : null}

            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border/70 text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    <th className="pb-3">账号</th>
                    <th className="pb-3">状态</th>
                    <th className="pb-3">类型</th>
                    <th className="pb-3">币种 / 时区</th>
                    <th className="pb-3">备注</th>
                  </tr>
                </thead>
                <tbody>
                  {diagnoseResult.customers.map((customer) => {
                    const typeLabel = getAccountTypeLabel(customer);

                    return (
                    <tr className="border-b border-border/40 align-middle" key={customer.customerId}>
                      <td className="py-3 pr-4">
                        <p className="font-semibold text-foreground">
                          {getAccountDisplayName(customer.customerId, customer.descriptiveName)}
                        </p>
                        <p className="mt-1 font-mono tabular-nums text-xs text-muted-foreground">{customer.customerId}</p>
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={cn(
                            "rounded-md border px-3 py-1 text-xs font-semibold",
                            customer.ok
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-destructive/20 bg-destructive/10 text-destructive"
                          )}
                        >
                          {customer.ok ? "读取成功" : customer.error?.code || "失败"}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-foreground">
                        <div className="flex flex-wrap gap-2 text-xs">
                          <span
                            className={cn(
                              "rounded-md border px-3 py-1 font-semibold",
                              customer.manager
                                ? "border-amber-200 bg-amber-500/10 text-amber-600"
                                : "border-primary/15 bg-primary/10 text-primary"
                            )}
                          >
                            {typeLabel.primary}
                          </span>
                          {typeLabel.secondary ? (
                            <span className="rounded-md border border-border bg-stone-200 px-3 py-1 font-semibold text-foreground">
                              {typeLabel.secondary}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-foreground">
                        <p>{customer.currencyCode || "--"}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{customer.timeZone || "--"}</p>
                      </td>
                      <td className="py-3 text-sm text-muted-foreground">
                        {customer.ok ? (
                          customer.status || "--"
                        ) : (
                          <div className="max-w-md space-y-1">
                            <p className="text-destructive">{customer.error?.message || "未知错误"}</p>
                            {customer.error?.hint ? <p>{customer.error.hint}</p> : null}
                          </div>
                        )}
                      </td>
                    </tr>
                  )})}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
