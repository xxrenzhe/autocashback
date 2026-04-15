"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import type { GoogleAdsAccountRecord, GoogleAdsCredentialStatus } from "@autocashback/domain";

export function GoogleAdsManager() {
  const [credentials, setCredentials] = useState<GoogleAdsCredentialStatus | null>(null);
  const [accounts, setAccounts] = useState<GoogleAdsAccountRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState("");

  async function loadAll(options?: { refreshAccounts?: boolean; preserveMessage?: boolean }) {
    const refreshAccounts = Boolean(options?.refreshAccounts);
    setLoading(true);
    if (!options?.preserveMessage) {
      setMessage("");
    }

    try {
      const credentialsResponse = await fetch("/api/google-ads/credentials");
      const credentialsPayload = await credentialsResponse.json();

      if (!credentialsResponse.ok) {
        throw new Error(credentialsPayload.error || "加载 Google Ads 配置失败");
      }

      const nextCredentials = (credentialsPayload.credentials || null) as GoogleAdsCredentialStatus | null;
      setCredentials(nextCredentials);

      if (!nextCredentials?.hasRefreshToken && !refreshAccounts) {
        setAccounts([]);
        return;
      }

      const accountsResponse = await fetch(
        `/api/google-ads/credentials/accounts${refreshAccounts ? "?refresh=true" : ""}`
      );
      const accountsPayload = await accountsResponse.json();
      if (!accountsResponse.ok) {
        throw new Error(accountsPayload.error || "加载 Google Ads 账号失败");
      }

      setAccounts(accountsPayload.accounts || []);
    } catch (error: unknown) {
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
        setMessage("Google Ads OAuth 已连接，账号列表已刷新。");
      })();
    } else if (error) {
      setMessage(`Google Ads 授权失败：${error}`);
    }
  }, []);

  async function verifyAndSync(refresh = true) {
    setSyncing(true);
    setMessage("");

    try {
      const verifyResponse = await fetch("/api/google-ads/credentials/verify", {
        method: "POST"
      });
      const verifyPayload = await verifyResponse.json();
      if (!verifyResponse.ok) {
        throw new Error(verifyPayload.error || "验证失败");
      }

      await loadAll({
        refreshAccounts: refresh,
        preserveMessage: true
      });
      setMessage(`Google Ads 配置验证成功，已同步 ${verifyPayload.accountCount || 0} 个账号。`);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "Google Ads 验证失败");
    } finally {
      setSyncing(false);
    }
  }

  const canConnect = Boolean(
    credentials?.clientId &&
      credentials?.clientSecret &&
      credentials?.developerToken &&
      credentials?.loginCustomerId
  );

  return (
    <div className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-[0.9fr,1.1fr]">
        <div className="surface-panel p-6">
          <p className="eyebrow">OAuth 状态</p>
          <h3 className="mt-2 text-2xl font-semibold text-slate-900">Google Ads 连接</h3>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            这里显示当前账号的 Google Ads OAuth 状态。基础参数在设置页维护，这一页用于连接、验证和同步可访问账号。
          </p>

          <div className="mt-5 grid gap-3">
            <div className="rounded-[28px] border border-brand-line bg-stone-50 p-5 text-sm text-slate-700">
              <p>基础配置：{credentials?.hasCredentials ? "已保存" : "未完成"}</p>
              <p className="mt-2">Refresh Token：{credentials?.hasRefreshToken ? "已获取" : "未授权"}</p>
              <p className="mt-2">最近验证：{credentials?.lastVerifiedAt || "尚未验证"}</p>
              <p className="mt-2">Token 过期：{credentials?.tokenExpiresAt || "未获取"}</p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              className="rounded-2xl border border-brand-line bg-white px-5 py-3 text-sm font-semibold text-slate-700"
              href="/settings"
            >
              前往设置
            </Link>
            <button
              className="rounded-2xl border border-brand-line bg-white px-5 py-3 text-sm font-semibold text-slate-700 disabled:opacity-60"
              disabled={!canConnect}
              onClick={() => {
                window.location.href = "/api/auth/google-ads/authorize";
              }}
              type="button"
            >
              发起 OAuth 授权
            </button>
            <button
              className="rounded-2xl bg-brand-emerald px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
              disabled={!credentials?.hasRefreshToken || syncing}
              onClick={() => verifyAndSync(true)}
              type="button"
            >
              {syncing ? "同步中..." : "验证并同步账号"}
            </button>
          </div>

          {message ? <p className="mt-4 text-sm text-slate-600">{message}</p> : null}
        </div>

        <div className="surface-panel p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="eyebrow">账号映射</p>
              <h3 className="mt-2 text-2xl font-semibold text-slate-900">可访问 Google Ads 账号</h3>
            </div>
            <span className="rounded-full bg-stone-100 px-3 py-2 font-mono text-xs text-slate-600">
              {accounts.length} accounts
            </span>
          </div>

          <div className="mt-5 grid gap-3">
            {loading ? (
              <p className="rounded-2xl bg-stone-50 px-4 py-5 text-sm text-slate-500">正在加载账号...</p>
            ) : accounts.length ? (
              accounts.map((account) => (
                <div className="rounded-[28px] border border-brand-line bg-stone-50 p-5" key={account.id}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {account.descriptiveName || `Customer ${account.customerId}`}
                      </p>
                      <p className="mt-1 font-mono text-xs text-slate-500">{account.customerId}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs">
                      {account.manager ? (
                        <span className="rounded-full bg-amber-50 px-3 py-1 font-semibold text-amber-700">
                          Manager
                        </span>
                      ) : null}
                      {account.testAccount ? (
                        <span className="rounded-full bg-stone-200 px-3 py-1 font-semibold text-slate-700">
                          Test
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                    <p>时区：{account.timeZone || "--"}</p>
                    <p>币种：{account.currencyCode || "--"}</p>
                    <p>状态：{account.status || "--"}</p>
                    <p>最近同步：{account.lastSyncAt || "--"}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="rounded-2xl bg-stone-50 px-4 py-5 text-sm text-slate-500">
                暂无可访问账号。先在设置页保存 Google Ads 基础配置，再完成 OAuth 授权。
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
