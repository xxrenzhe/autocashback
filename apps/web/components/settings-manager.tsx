"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Globe2,
  KeyRound,
  Link2,
  NotebookPen,
  ShieldCheck
} from "lucide-react";

import type { ProxySettingEntry } from "@autocashback/domain";
import { EmptyState, ShortcutCard, StatCard } from "@autocashback/ui";

import { AccountSecurityPanel } from "@/components/account-security-panel";
import { fetchJson } from "@/lib/api-error-handler";
import { buildSettingsOverview } from "@/lib/settings-overview";

type SettingRow = {
  category: string;
  key: string;
  value: string;
  isSensitive?: boolean;
};

type ScriptTemplatePayload = {
  token: string;
  template: string;
};

const emptyProxyEntry: ProxySettingEntry = {
  label: "",
  country: "GLOBAL",
  url: "",
  active: true
};

function parseProxyEntries(raw: string): ProxySettingEntry[] {
  try {
    const parsed = JSON.parse(raw) as Array<string | Record<string, unknown>>;
    return parsed.map((entry, index) => {
      if (typeof entry === "string") {
        return {
          label: `Proxy ${index + 1}`,
          country: "GLOBAL",
          url: entry,
          active: true
        };
      }

      return {
        label: String(entry.label || `Proxy ${index + 1}`),
        country: String(entry.country || "GLOBAL").toUpperCase(),
        url: String(entry.url || ""),
        active: entry.active === false ? false : true
      };
    });
  } catch {
    return [];
  }
}

export function SettingsManager() {
  const [proxyEntries, setProxyEntries] = useState<ProxySettingEntry[]>([]);
  const [proxyValidation, setProxyValidation] = useState<Record<number, { status: "idle" | "success" | "error" | "loading"; message: string }>>({});
  const [platformNotes, setPlatformNotes] = useState({
    topcashback: "",
    rakuten: "",
    custom: ""
  });
  const [googleAdsConfig, setGoogleAdsConfig] = useState({
    clientId: "",
    clientSecret: "",
    developerToken: "",
    loginCustomerId: "",
    hasClientId: false,
    hasClientSecret: false,
    hasDeveloperToken: false,
    hasRefreshToken: false,
    tokenExpiresAt: "",
    lastVerifiedAt: ""
  });
  const [script, setScript] = useState<ScriptTemplatePayload>({
    token: "",
    template: ""
  });
  const [scriptAppUrl, setScriptAppUrl] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [rotatingToken, setRotatingToken] = useState(false);

  const overview = useMemo(
    () =>
      buildSettingsOverview({
        proxyEntries,
        platformNotes,
        googleAdsConfig: {
          hasClientId: googleAdsConfig.hasClientId,
          hasClientSecret: googleAdsConfig.hasClientSecret,
          hasDeveloperToken: googleAdsConfig.hasDeveloperToken,
          hasRefreshToken: googleAdsConfig.hasRefreshToken,
          loginCustomerId: googleAdsConfig.loginCustomerId
        },
        script
      }),
    [googleAdsConfig, platformNotes, proxyEntries, script]
  );

  const loadSettings = useCallback(async () => {
    setLoading(true);
    const [settingsResult, scriptResult, googleAdsResult] = await Promise.all([
      fetchJson<{ settings: Array<{ category: string; key: string; value: string }> }>("/api/settings"),
      fetchJson<ScriptTemplatePayload>("/api/script/link-swap/template"),
      fetchJson<{ credentials?: typeof googleAdsConfig }>("/api/google-ads/credentials")
    ]);
    const failure = [settingsResult, scriptResult, googleAdsResult].find((item) => !item.success);
    if (failure && !failure.success) {
      setMessage(failure.userMessage);
      setLoading(false);
      return;
    }

    const payload = settingsResult.success ? settingsResult.data : { settings: [] };
    const scriptPayload = scriptResult.success ? scriptResult.data : { token: "", template: "" };
    const googleAdsPayload = googleAdsResult.success ? googleAdsResult.data : {};
    const normalized: Record<string, string> = {};
    for (const row of payload.settings || []) {
      normalized[`${row.category}.${row.key}`] = row.value || "";
    }

    setProxyEntries(parseProxyEntries(normalized["proxy.proxy_urls"] || "[]"));
    setPlatformNotes({
      topcashback: normalized["cashback.topcashback_notes"] || "",
      rakuten: normalized["cashback.rakuten_notes"] || "",
      custom: normalized["cashback.custom_notes"] || ""
    });
    setScript({
      token: scriptPayload.token || "",
      template: scriptPayload.template || ""
    });
    setGoogleAdsConfig({
      clientId: "",
      clientSecret: "",
      developerToken: "",
      loginCustomerId: googleAdsPayload.credentials?.loginCustomerId || "",
      hasClientId: Boolean(googleAdsPayload.credentials?.hasClientId),
      hasClientSecret: Boolean(googleAdsPayload.credentials?.hasClientSecret),
      hasDeveloperToken: Boolean(googleAdsPayload.credentials?.hasDeveloperToken),
      hasRefreshToken: Boolean(googleAdsPayload.credentials?.hasRefreshToken),
      tokenExpiresAt: googleAdsPayload.credentials?.tokenExpiresAt || "",
      lastVerifiedAt: googleAdsPayload.credentials?.lastVerifiedAt || ""
    });
    setScriptAppUrl(window.location.origin);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  async function saveSettings() {
    setMessage("");

    const updates: SettingRow[] = [
      {
        category: "proxy",
        key: "proxy_urls",
        value: JSON.stringify(
          proxyEntries
            .filter((entry) => entry.url.trim())
            .map((entry) => ({
              label: entry.label.trim() || `${entry.country}-proxy`,
              country: entry.country.trim().toUpperCase() || "GLOBAL",
              url: entry.url.trim(),
              active: entry.active
            }))
        )
      },
      {
        category: "cashback",
        key: "topcashback_notes",
        value: platformNotes.topcashback
      },
      {
        category: "cashback",
        key: "rakuten_notes",
        value: platformNotes.rakuten
      },
      {
        category: "cashback",
        key: "custom_notes",
        value: platformNotes.custom
      }
    ];

    const result = await fetchJson("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ updates })
    });

    setMessage(result.success ? "已保存设置" : result.userMessage);
    if (result.success) {
      await loadSettings();
    }
  }

  async function rotateToken() {
    setRotatingToken(true);
    setMessage("");

    try {
      const result = await fetchJson("/api/script/link-swap/rotate-token", {
        method: "POST"
      });
      if (!result.success) {
        setMessage(result.userMessage);
        return;
      }

      await loadSettings();
      setMessage("Token 已更换，旧脚本立即失效，请重新复制最新换链接脚本。");
    } catch {
      setMessage("Token 更换失败");
    } finally {
      setRotatingToken(false);
    }
  }

  async function saveGoogleAdsConfig() {
    setMessage("");

    try {
      const result = await fetchJson<{ credentials?: { hasRefreshToken?: boolean } }>(
        "/api/google-ads/credentials",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientId: googleAdsConfig.clientId,
            clientSecret: googleAdsConfig.clientSecret,
            developerToken: googleAdsConfig.developerToken,
            loginCustomerId: googleAdsConfig.loginCustomerId
          })
        }
      );
      if (!result.success) {
        setMessage(result.userMessage);
        return;
      }

      await loadSettings();
      setMessage(
        result.data.credentials?.hasRefreshToken
          ? "Google Ads 配置已保存"
          : "Google Ads 配置已保存，请重新发起 OAuth 授权"
      );
    } catch {
      setMessage("Google Ads 配置保存失败");
    }
  }

  async function verifyGoogleAdsConfig() {
    setMessage("");

    try {
      const result = await fetchJson<{ accountCount?: number }>("/api/google-ads/credentials/verify", {
        method: "POST"
      });
      if (!result.success) {
        setMessage(result.userMessage);
        return;
      }

      await loadSettings();
      setMessage(`Google Ads 配置验证成功，已同步 ${result.data.accountCount || 0} 个账号`);
    } catch {
      setMessage("Google Ads 配置验证失败");
    }
  }

  async function clearGoogleAdsConfig() {
    setMessage("");

    try {
      const result = await fetchJson("/api/google-ads/credentials", {
        method: "DELETE"
      });
      if (!result.success) {
        setMessage(result.userMessage);
        return;
      }

      await loadSettings();
      setMessage("Google Ads 配置已清除");
    } catch {
      setMessage("Google Ads 配置清除失败");
    }
  }

  function updateProxyEntry(index: number, next: Partial<ProxySettingEntry>) {
    setProxyEntries((current) =>
      current.map((entry, entryIndex) =>
        entryIndex === index
          ? {
              ...entry,
              ...next
            }
          : entry
      )
    );
  }

  function addProxyEntry() {
    setProxyEntries((current) => [...current, { ...emptyProxyEntry }]);
  }

  function removeProxyEntry(index: number) {
    setProxyEntries((current) => current.filter((_, entryIndex) => entryIndex !== index));
  }

  async function validateProxyEntry(index: number, url: string) {
    setProxyValidation((current) => ({
      ...current,
      [index]: { status: "loading", message: "验证中..." }
    }));

    const result = await fetchJson<{ success?: boolean; data?: { origin?: string } }>(
      "/api/settings/proxy/validate",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proxy_url: url })
      }
    );

    if (!result.success || !result.data.success) {
      setProxyValidation((current) => ({
        ...current,
        [index]: { status: "error", message: result.success ? "验证失败" : result.userMessage }
      }));
      return;
    }

    setProxyValidation((current) => ({
      ...current,
      [index]: {
        status: "success",
        message: result.data.data?.origin
          ? `验证成功，出口 IP: ${result.data.data.origin}`
          : "验证成功"
      }
    }));
  }

  return (
    <div className="space-y-6">
      <section className="bg-card text-card-foreground rounded-xl border shadow-sm overflow-hidden p-0">
        <div className="grid gap-0 xl:grid-cols-[1.1fr,0.9fr]">
          <div className="bg-[radial-gradient(circle_at_top_left,rgba(5,150,105,0.16),transparent_48%),linear-gradient(180deg,rgba(236,253,245,0.95)_0%,rgba(255,255,255,0.98)_100%)] px-6 py-7 sm:px-8">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">Settings</p>
            <h2 className="mt-3 text-xl font-semibold tracking-tight text-foreground">系统配置控制台</h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">
              先确认代理、Google Ads、平台备注和脚本是否就绪，再进入对应分组修改具体配置。
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <a
                href="#proxy-settings"
              >
                <ShortcutCard
                  description="确认目标国家代理是否齐备，避免换链和诊断任务失败。"
                  icon={Globe2}
                  title="代理与国家覆盖"
                  trailing={<ArrowRight className="h-4 w-4 text-muted-foreground/80 transition group-hover:text-primary" />}
                />
              </a>

              <a
                href="#google-ads-settings"
              >
                <ShortcutCard
                  description="基础参数齐全后再做 OAuth 授权和账号同步。"
                  icon={ShieldCheck}
                  title="Google Ads 授权"
                  trailing={<ArrowRight className="h-4 w-4 text-muted-foreground/80 transition group-hover:text-primary" />}
                />
              </a>

              <a
                href="#platform-settings"
              >
                <ShortcutCard
                  description="沉淀返利平台处理规范，减少账号和 Offer 操作分歧。"
                  icon={NotebookPen}
                  title="平台接入备注"
                  trailing={<ArrowRight className="h-4 w-4 text-muted-foreground/80 transition group-hover:text-primary" />}
                />
              </a>

              <a
                href="#script-settings"
              >
                <ShortcutCard
                  description="统一维护 MCC 脚本模板和当前有效 Script Token。"
                  icon={KeyRound}
                  title="脚本与 Token"
                  trailing={<ArrowRight className="h-4 w-4 text-muted-foreground/80 transition group-hover:text-primary" />}
                />
              </a>
            </div>
          </div>

          <div className="border-t border-border/70 bg-background/80 px-6 py-7 xl:border-l xl:border-t-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">配置摘要</p>
            <div className="mt-5 grid gap-3">
              <div className="rounded-xl border border-border bg-muted/40 p-4">
                <p className="text-sm font-semibold text-foreground">当前最需要关注</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {overview.googleAdsNeedsOAuth
                    ? "Google Ads 基础参数已齐，但还未完成 OAuth 授权。"
                    : !overview.hasGlobalProxy
                      ? "建议至少保留一个 GLOBAL 代理作为兜底。"
                      : !overview.scriptReady
                        ? "脚本 Token 或模板尚未就绪。"
                        : "主要配置已齐，可以继续维护明细。"}
                </p>
              </div>

              <div className="rounded-xl border border-border bg-muted/40 p-4">
                <p className="text-sm font-semibold text-foreground">保存建议</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  先调整代理和 Google Ads，再统一点击底部“保存设置”，避免备注或脚本说明与实际配置脱节。
                </p>
              </div>

              <div className="rounded-xl border border-border bg-muted/40 p-4">
                <p className="text-sm font-semibold text-foreground">安全提醒</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  修改 Google Ads 基础参数后，旧授权状态会失效，需要重新获取 Refresh Token 并同步账号。
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-4">
        <StatCard
          icon={Globe2}
          label="活跃代理"
          note={`已覆盖 ${overview.configuredProxyCountries} 个国家/区域${overview.hasGlobalProxy ? "，含 GLOBAL 兜底" : "，未含 GLOBAL 兜底"}`}
          tone={overview.hasGlobalProxy ? "emerald" : "amber"}
          value={`${overview.activeProxyCount}`}
        />
        <StatCard
          icon={ShieldCheck}
          label="Google Ads 基础项"
          note={
            overview.googleAdsFullyConnected
              ? "基础参数和 OAuth 都已完成。"
              : overview.googleAdsNeedsOAuth
                ? "基础参数已齐，下一步需要 OAuth 授权。"
                : "仍有基础参数缺失。"
          }
          tone={overview.googleAdsFullyConnected ? "emerald" : "amber"}
          value={`${overview.googleAdsBaseConfigCount}/4`}
        />
        <StatCard
          icon={NotebookPen}
          label="平台备注"
          note="建议三类平台都维护处理规范，方便账号和 Offer 协作。"
          tone={overview.noteCount >= 2 ? "emerald" : "slate"}
          value={`${overview.noteCount}/3`}
        />
        <StatCard
          icon={Link2}
          label="脚本状态"
          note={overview.scriptReady ? "脚本模板和当前 Token 已可直接复制使用。" : "脚本模板或 Token 尚未准备好。"}
          tone={overview.scriptReady ? "emerald" : "amber"}
          value={overview.scriptReady ? "ready" : "pending"}
        />
      </section>

      {message ? (
        <section
          className={`rounded-xl border px-5 py-4 text-sm ${
            message.includes("失败")
              ? "border-destructive/20 bg-destructive/10 text-red-800"
              : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          {message}
        </section>
      ) : null}

      <AccountSecurityPanel />

      <section className="bg-card text-card-foreground rounded-xl border shadow-sm p-5" id="proxy-settings">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">代理配置</p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight text-foreground">按国家维护解析代理</h3>
          </div>
          <button
            className="rounded-full border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground"
            onClick={addProxyEntry}
            type="button"
          >
            新增代理
          </button>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          按 AutoCashBack 的代理配置方式维护。每条代理绑定一个国家代码，调度器会优先选择与 Offer 国家匹配的代理，未命中时回退到
          `GLOBAL`。
        </p>

        <div className="mt-5 grid gap-3 rounded-xl border border-border bg-muted/40 p-5 text-sm text-muted-foreground lg:grid-cols-3">
          <p>活跃代理：{overview.activeProxyCount}</p>
          <p>覆盖国家/区域：{overview.configuredProxyCountries}</p>
          <p>GLOBAL 兜底：{overview.hasGlobalProxy ? "已配置" : "未配置"}</p>
        </div>

        <div className="mt-5 space-y-4">
          {proxyEntries.length ? (
            proxyEntries.map((entry, index) => (
              <div className="rounded-xl border border-border bg-muted/40 p-5" key={`${entry.label}-${index}`}>
                <div className="grid gap-4 lg:grid-cols-[140px,1fr,140px,120px]">
                  <label className="block text-sm font-medium text-foreground">
                    国家
                    <input
                      className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 uppercase"
                      maxLength={12}
                      value={entry.country}
                      onChange={(event) =>
                        updateProxyEntry(index, { country: event.target.value.toUpperCase() })
                      }
                    />
                  </label>
                  <label className="block text-sm font-medium text-foreground">
                    代理 URL
                    <input
                      className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2"
                      placeholder="http://user:pass@host:port"
                      value={entry.url}
                      onChange={(event) => updateProxyEntry(index, { url: event.target.value })}
                    />
                  </label>
                  <label className="block text-sm font-medium text-foreground">
                    标签
                    <input
                      className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2"
                      placeholder="US-main"
                      value={entry.label}
                      onChange={(event) => updateProxyEntry(index, { label: event.target.value })}
                    />
                  </label>
                  <label className="block text-sm font-medium text-foreground">
                    状态
                    <select
                      className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2"
                      value={entry.active ? "active" : "paused"}
                      onChange={(event) =>
                        updateProxyEntry(index, { active: event.target.value === "active" })
                      }
                    >
                      <option value="active">active</option>
                      <option value="paused">paused</option>
                    </select>
                  </label>
                </div>

                <div className="mt-4 flex justify-end">
                  <div className="flex flex-wrap items-center justify-end gap-3">
                    {proxyValidation[index]?.message ? (
                      <span
                        className={`text-xs ${
                          proxyValidation[index]?.status === "success"
                            ? "text-primary"
                            : proxyValidation[index]?.status === "error"
                              ? "text-destructive"
                              : "text-muted-foreground"
                        }`}
                      >
                        {proxyValidation[index]?.message}
                      </span>
                    ) : null}
                    <button
                      className="rounded-full border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground"
                      onClick={() => validateProxyEntry(index, entry.url)}
                      type="button"
                    >
                      验证代理
                    </button>
                    <button
                      className="rounded-full border border-destructive/20 bg-destructive/10 px-4 py-2 text-xs font-semibold text-destructive"
                      onClick={() => removeProxyEntry(index)}
                      type="button"
                    >
                      删除
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <EmptyState
              className="text-left"
              description="建议至少录入一个 GLOBAL 代理，确保终链解析任务可执行。"
              icon={Globe2}
              title="还没有代理配置"
            />
          )}
        </div>
      </section>

      <section className="bg-card text-card-foreground rounded-xl border shadow-sm p-5" id="google-ads-settings">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">Google Ads API</p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight text-foreground">OAuth 凭证配置</h3>
          </div>
          <button
            className="rounded-full border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground"
            onClick={() => {
              window.location.href = "/google-ads";
            }}
            type="button"
          >
            打开账号页
          </button>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          在这里保存 Google Ads OAuth 基础参数。首次保存后请发起授权；如果你修改了基础参数，系统会清除旧授权状态，需重新获取
          Refresh Token 并同步账号。
        </p>

        <div className="mt-5 grid gap-3 rounded-xl border border-border bg-muted/40 p-5 text-sm text-muted-foreground lg:grid-cols-3">
          <p>基础项完成度：{overview.googleAdsBaseConfigCount} / 4</p>
          <p>OAuth 状态：{googleAdsConfig.hasRefreshToken ? "已授权" : "未授权"}</p>
          <p>最近验证：{googleAdsConfig.lastVerifiedAt || "尚未验证"}</p>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <label className="block text-sm font-medium text-foreground">
            Client ID
            <input
              className="mt-2 w-full rounded-lg border border-border bg-muted/40 px-3 py-2"
              placeholder={
                googleAdsConfig.hasClientId ? "已配置，留空表示保持不变" : "Google OAuth Client ID"
              }
              value={googleAdsConfig.clientId}
              onChange={(event) =>
                setGoogleAdsConfig((current) => ({
                  ...current,
                  clientId: event.target.value
                }))
              }
            />
          </label>

          <label className="block text-sm font-medium text-foreground">
            Client Secret
            <input
              className="mt-2 w-full rounded-lg border border-border bg-muted/40 px-3 py-2"
              placeholder={
                googleAdsConfig.hasClientSecret ? "已配置，留空表示保持不变" : "Google OAuth Client Secret"
              }
              value={googleAdsConfig.clientSecret}
              onChange={(event) =>
                setGoogleAdsConfig((current) => ({
                  ...current,
                  clientSecret: event.target.value
                }))
              }
            />
          </label>

          <label className="block text-sm font-medium text-foreground">
            Developer Token
            <input
              className="mt-2 w-full rounded-lg border border-border bg-muted/40 px-3 py-2"
              placeholder={
                googleAdsConfig.hasDeveloperToken ? "已配置，留空表示保持不变" : "Google Ads Developer Token"
              }
              value={googleAdsConfig.developerToken}
              onChange={(event) =>
                setGoogleAdsConfig((current) => ({
                  ...current,
                  developerToken: event.target.value
                }))
              }
            />
          </label>

          <label className="block text-sm font-medium text-foreground">
            Login Customer ID
            <input
              className="mt-2 w-full rounded-lg border border-border bg-muted/40 px-3 py-2 font-mono tabular-nums"
              placeholder="1234567890"
              value={googleAdsConfig.loginCustomerId}
              onChange={(event) =>
                setGoogleAdsConfig((current) => ({
                  ...current,
                  loginCustomerId: event.target.value
                }))
              }
            />
          </label>
        </div>

        <div className="mt-5 grid gap-3 rounded-xl border border-border bg-muted/40 p-5 text-sm text-muted-foreground lg:grid-cols-3">
          <p>Client ID：{googleAdsConfig.hasClientId ? "已保存" : "未配置"}</p>
          <p>Client Secret：{googleAdsConfig.hasClientSecret ? "已保存" : "未配置"}</p>
          <p>Developer Token：{googleAdsConfig.hasDeveloperToken ? "已保存" : "未配置"}</p>
          <p>Refresh Token：{googleAdsConfig.hasRefreshToken ? "已获取" : "未授权"}</p>
          <p>最近验证：{googleAdsConfig.lastVerifiedAt || "尚未验证"}</p>
          <p>Token 过期：{googleAdsConfig.tokenExpiresAt || "未获取"}</p>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white"
            onClick={saveGoogleAdsConfig}
            type="button"
          >
            保存 Google Ads 配置
          </button>
          <button
            className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground"
            onClick={() => {
              window.location.href = "/api/auth/google-ads/authorize";
            }}
            type="button"
          >
            发起 OAuth 授权
          </button>
          <button
            className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground"
            onClick={verifyGoogleAdsConfig}
            type="button"
          >
            验证并同步
          </button>
          <button
            className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-2 text-sm font-semibold text-destructive"
            onClick={clearGoogleAdsConfig}
            type="button"
          >
            清除配置
          </button>
        </div>
      </section>

      <section className="bg-card text-card-foreground rounded-xl border shadow-sm p-5" id="platform-settings">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">返利网配置</p>
        <h3 className="mt-2 text-xl font-semibold tracking-tight text-foreground">平台接入策略</h3>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          在这里维护各返利平台的运营说明、登录入口和处理规范，方便团队统一查看和协作。
        </p>

        <div className="mt-5 rounded-xl border border-border bg-muted/40 p-5 text-sm text-muted-foreground">
          当前已填写 {overview.noteCount} / 3 份平台说明。建议至少补齐 TopCashback、Rakuten 和 Custom 的登录入口、风控点和操作规范。
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-3">
          <label className="rounded-xl border border-border bg-muted/40 p-5 text-sm font-medium text-foreground">
            TopCashback
            <textarea
              className="mt-3 min-h-36 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-normal"
              value={platformNotes.topcashback}
              onChange={(event) =>
                setPlatformNotes({ ...platformNotes, topcashback: event.target.value })
              }
            />
          </label>
          <label className="rounded-xl border border-border bg-muted/40 p-5 text-sm font-medium text-foreground">
            Rakuten
            <textarea
              className="mt-3 min-h-36 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-normal"
              value={platformNotes.rakuten}
              onChange={(event) =>
                setPlatformNotes({ ...platformNotes, rakuten: event.target.value })
              }
            />
          </label>
          <label className="rounded-xl border border-border bg-muted/40 p-5 text-sm font-medium text-foreground">
            Custom
            <textarea
              className="mt-3 min-h-36 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-normal"
              value={platformNotes.custom}
              onChange={(event) =>
                setPlatformNotes({ ...platformNotes, custom: event.target.value })
              }
            />
          </label>
        </div>
      </section>

      <section className="bg-card text-card-foreground rounded-xl border shadow-sm p-5" id="script-settings">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">换链接配置</p>
            <h3 className="mt-2 text-xl font-semibold tracking-tight text-foreground">默认 MCC 脚本</h3>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              系统已经把站点地址和 Script Token 注入到脚本里。Script Token 默认长期有效，同一时间只有当前这一枚 token 生效。
              你只需要复制后粘贴到 Google Ads Scripts / MCC，并确保对应 Campaign 已绑定好 Offer 的 `campaignLabel`。
            </p>
          </div>
          <div className="rounded-xl border border-border bg-muted/40 px-3 py-2">
            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Script Token</p>
            <p className="mt-2 font-mono tabular-nums text-sm text-foreground">{script.token || "尚未生成"}</p>
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-border bg-muted/40 p-5 text-sm text-muted-foreground">
          {overview.scriptReady ? (
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ShieldCheck className="h-4 w-4" />
              </span>
              <p>当前脚本模板和 Token 都已就绪，可以直接复制到 Google Ads Scripts / MCC 使用。</p>
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
                <AlertTriangle className="h-4 w-4" />
              </span>
              <p>脚本模板或 Token 尚未生成，建议先确认基础配置和当前登录状态。</p>
            </div>
          )}
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            className="rounded-full border border-border bg-background px-4 py-2 text-xs font-semibold text-foreground"
            disabled={rotatingToken}
            onClick={rotateToken}
            type="button"
          >
            {rotatingToken ? "更换中..." : "更换 Token"}
          </button>
          <button
            className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
            disabled={loading || !script.template || rotatingToken}
            onClick={() => navigator.clipboard.writeText(script.template)}
            type="button"
          >
            复制最新换链接脚本
          </button>
        </div>

        <div className="mt-4 space-y-2 text-sm leading-6 text-muted-foreground">
          <p>复制后无需再修改脚本内容。若你更换 Token，旧 Token 会立即失效，你需要重新复制一次最新脚本。</p>
          <p>快照接口地址：<span className="font-mono tabular-nums text-xs text-foreground">{scriptAppUrl}/api/script/link-swap/snapshot</span></p>
        </div>

        <textarea
          className="mt-5 min-h-72 w-full rounded-lg border border-border bg-muted/40 px-3 py-2 font-mono tabular-nums text-xs"
          readOnly
          value={script.template}
        />
      </section>

      <div className="flex items-center gap-4">
        <button
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          disabled={loading}
          onClick={saveSettings}
          type="button"
        >
          保存设置
        </button>
        {message ? <span className="text-sm text-muted-foreground">{message}</span> : null}
      </div>
    </div>
  );
}
