"use client";

import { useEffect, useState } from "react";

import type { ProxySettingEntry } from "@autocashback/domain";

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

  async function loadSettings() {
    setLoading(true);
    const [settingsResponse, scriptResponse, googleAdsResponse] = await Promise.all([
      fetch("/api/settings"),
      fetch("/api/script/link-swap/template"),
      fetch("/api/google-ads/credentials")
    ]);
    const payload = await settingsResponse.json();
    const scriptPayload = (await scriptResponse.json()) as ScriptTemplatePayload;
    const googleAdsPayload = await googleAdsResponse.json();
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
      clientId: googleAdsPayload.credentials?.clientId || "",
      clientSecret: googleAdsPayload.credentials?.clientSecret || "",
      developerToken: googleAdsPayload.credentials?.developerToken || "",
      loginCustomerId: googleAdsPayload.credentials?.loginCustomerId || "",
      hasRefreshToken: Boolean(googleAdsPayload.credentials?.hasRefreshToken),
      tokenExpiresAt: googleAdsPayload.credentials?.tokenExpiresAt || "",
      lastVerifiedAt: googleAdsPayload.credentials?.lastVerifiedAt || ""
    });
    setScriptAppUrl(window.location.origin);
    setLoading(false);
  }

  useEffect(() => {
    loadSettings();
  }, []);

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

    const response = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ updates })
    });

    setMessage(response.ok ? "已保存设置" : "保存失败");
    if (response.ok) {
      await loadSettings();
    }
  }

  async function rotateToken() {
    setRotatingToken(true);
    setMessage("");

    try {
      const response = await fetch("/api/script/link-swap/rotate-token", {
        method: "POST"
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage(payload.error || "Token 更换失败");
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
      const response = await fetch("/api/google-ads/credentials", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: googleAdsConfig.clientId,
          clientSecret: googleAdsConfig.clientSecret,
          developerToken: googleAdsConfig.developerToken,
          loginCustomerId: googleAdsConfig.loginCustomerId
        })
      });
      const payload = await response.json();
      if (!response.ok) {
        setMessage(payload.error || "Google Ads 配置保存失败");
        return;
      }

      await loadSettings();
      setMessage(
        payload.credentials?.hasRefreshToken
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
      const response = await fetch("/api/google-ads/credentials/verify", {
        method: "POST"
      });
      const payload = await response.json();
      if (!response.ok) {
        setMessage(payload.error || "Google Ads 配置验证失败");
        return;
      }

      await loadSettings();
      setMessage(`Google Ads 配置验证成功，已同步 ${payload.accountCount || 0} 个账号`);
    } catch {
      setMessage("Google Ads 配置验证失败");
    }
  }

  async function clearGoogleAdsConfig() {
    setMessage("");

    try {
      const response = await fetch("/api/google-ads/credentials", {
        method: "DELETE"
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(payload.error || "Google Ads 配置清除失败");
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

    const response = await fetch("/api/settings/proxy/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ proxy_url: url })
    });
    const payload = await response.json();

    if (!response.ok || !payload.success) {
      setProxyValidation((current) => ({
        ...current,
        [index]: { status: "error", message: payload.error || "验证失败" }
      }));
      return;
    }

    setProxyValidation((current) => ({
      ...current,
      [index]: {
        status: "success",
        message: payload.data?.origin
          ? `验证成功，出口 IP: ${payload.data.origin}`
          : "验证成功"
      }
    }));
  }

  return (
    <div className="space-y-6">
      <section className="surface-panel p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="eyebrow">代理配置</p>
            <h3 className="mt-2 text-2xl font-semibold text-slate-900">按国家维护解析代理</h3>
          </div>
          <button
            className="rounded-full border border-brand-line bg-white px-4 py-2 text-xs font-semibold text-slate-700"
            onClick={addProxyEntry}
            type="button"
          >
            新增代理
          </button>
        </div>

        <p className="mt-3 text-sm leading-6 text-slate-600">
          按 AutoCashBack 的代理配置方式维护。每条代理绑定一个国家代码，调度器会优先选择与 Offer 国家匹配的代理，未命中时回退到
          `GLOBAL`。
        </p>

        <div className="mt-5 space-y-4">
          {proxyEntries.length ? (
            proxyEntries.map((entry, index) => (
              <div className="rounded-[28px] border border-brand-line bg-stone-50 p-5" key={`${entry.label}-${index}`}>
                <div className="grid gap-4 lg:grid-cols-[140px,1fr,140px,120px]">
                  <label className="block text-sm font-medium text-slate-700">
                    国家
                    <input
                      className="mt-2 w-full rounded-2xl border border-brand-line bg-white px-4 py-3 uppercase"
                      maxLength={12}
                      value={entry.country}
                      onChange={(event) =>
                        updateProxyEntry(index, { country: event.target.value.toUpperCase() })
                      }
                    />
                  </label>
                  <label className="block text-sm font-medium text-slate-700">
                    代理 URL
                    <input
                      className="mt-2 w-full rounded-2xl border border-brand-line bg-white px-4 py-3"
                      placeholder="http://user:pass@host:port"
                      value={entry.url}
                      onChange={(event) => updateProxyEntry(index, { url: event.target.value })}
                    />
                  </label>
                  <label className="block text-sm font-medium text-slate-700">
                    标签
                    <input
                      className="mt-2 w-full rounded-2xl border border-brand-line bg-white px-4 py-3"
                      placeholder="US-main"
                      value={entry.label}
                      onChange={(event) => updateProxyEntry(index, { label: event.target.value })}
                    />
                  </label>
                  <label className="block text-sm font-medium text-slate-700">
                    状态
                    <select
                      className="mt-2 w-full rounded-2xl border border-brand-line bg-white px-4 py-3"
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
                            ? "text-brand-emerald"
                            : proxyValidation[index]?.status === "error"
                              ? "text-red-600"
                              : "text-slate-500"
                        }`}
                      >
                        {proxyValidation[index]?.message}
                      </span>
                    ) : null}
                    <button
                      className="rounded-full border border-brand-line bg-white px-4 py-2 text-xs font-semibold text-slate-700"
                      onClick={() => validateProxyEntry(index, entry.url)}
                      type="button"
                    >
                      验证代理
                    </button>
                    <button
                      className="rounded-full border border-red-200 bg-red-50 px-4 py-2 text-xs font-semibold text-red-600"
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
            <div className="rounded-[28px] border border-dashed border-brand-line bg-stone-50 px-5 py-6 text-sm text-slate-500">
              还没有代理配置。建议至少录入一个 `GLOBAL` 代理，确保终链解析任务可执行。
            </div>
          )}
        </div>
      </section>

      <section className="surface-panel p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="eyebrow">Google Ads API</p>
            <h3 className="mt-2 text-2xl font-semibold text-slate-900">OAuth 凭证配置</h3>
          </div>
          <button
            className="rounded-full border border-brand-line bg-white px-4 py-2 text-xs font-semibold text-slate-700"
            onClick={() => {
              window.location.href = "/google-ads";
            }}
            type="button"
          >
            打开账号页
          </button>
        </div>

        <p className="mt-3 text-sm leading-6 text-slate-600">
          这里保存 Google Ads OAuth 基础参数。首次保存后请发起授权；如果你修改了基础参数，系统会清除旧授权状态，需重新获取
          Refresh Token 并同步账号。
        </p>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700">
            Client ID
            <input
              className="mt-2 w-full rounded-2xl border border-brand-line bg-stone-50 px-4 py-3"
              value={googleAdsConfig.clientId}
              onChange={(event) =>
                setGoogleAdsConfig((current) => ({
                  ...current,
                  clientId: event.target.value
                }))
              }
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Client Secret
            <input
              className="mt-2 w-full rounded-2xl border border-brand-line bg-stone-50 px-4 py-3"
              value={googleAdsConfig.clientSecret}
              onChange={(event) =>
                setGoogleAdsConfig((current) => ({
                  ...current,
                  clientSecret: event.target.value
                }))
              }
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Developer Token
            <input
              className="mt-2 w-full rounded-2xl border border-brand-line bg-stone-50 px-4 py-3"
              value={googleAdsConfig.developerToken}
              onChange={(event) =>
                setGoogleAdsConfig((current) => ({
                  ...current,
                  developerToken: event.target.value
                }))
              }
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Login Customer ID
            <input
              className="mt-2 w-full rounded-2xl border border-brand-line bg-stone-50 px-4 py-3 font-mono"
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

        <div className="mt-5 grid gap-3 rounded-[28px] border border-brand-line bg-stone-50 p-5 text-sm text-slate-600 lg:grid-cols-3">
          <p>Refresh Token：{googleAdsConfig.hasRefreshToken ? "已连接" : "未授权"}</p>
          <p>最近验证：{googleAdsConfig.lastVerifiedAt || "尚未验证"}</p>
          <p>Token 过期：{googleAdsConfig.tokenExpiresAt || "未获取"}</p>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            className="rounded-2xl bg-brand-emerald px-5 py-3 text-sm font-semibold text-white"
            onClick={saveGoogleAdsConfig}
            type="button"
          >
            保存 Google Ads 配置
          </button>
          <button
            className="rounded-2xl border border-brand-line bg-white px-5 py-3 text-sm font-semibold text-slate-700"
            onClick={() => {
              window.location.href = "/api/auth/google-ads/authorize";
            }}
            type="button"
          >
            发起 OAuth 授权
          </button>
          <button
            className="rounded-2xl border border-brand-line bg-white px-5 py-3 text-sm font-semibold text-slate-700"
            onClick={verifyGoogleAdsConfig}
            type="button"
          >
            验证并同步
          </button>
          <button
            className="rounded-2xl border border-red-200 bg-red-50 px-5 py-3 text-sm font-semibold text-red-600"
            onClick={clearGoogleAdsConfig}
            type="button"
          >
            清除配置
          </button>
        </div>
      </section>

      <section className="surface-panel p-6">
        <p className="eyebrow">返利网配置</p>
        <h3 className="mt-2 text-2xl font-semibold text-slate-900">平台接入策略</h3>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          V1 统一按“无公开 API”平台处理。这里保存的是运营说明、登录入口和人工处理规范，方便团队共享。
        </p>

        <div className="mt-5 grid gap-4 xl:grid-cols-3">
          <label className="rounded-[28px] border border-brand-line bg-stone-50 p-5 text-sm font-medium text-slate-700">
            TopCashback
            <textarea
              className="mt-3 min-h-36 w-full rounded-2xl border border-brand-line bg-white px-4 py-3 text-sm font-normal"
              value={platformNotes.topcashback}
              onChange={(event) =>
                setPlatformNotes({ ...platformNotes, topcashback: event.target.value })
              }
            />
          </label>
          <label className="rounded-[28px] border border-brand-line bg-stone-50 p-5 text-sm font-medium text-slate-700">
            Rakuten
            <textarea
              className="mt-3 min-h-36 w-full rounded-2xl border border-brand-line bg-white px-4 py-3 text-sm font-normal"
              value={platformNotes.rakuten}
              onChange={(event) =>
                setPlatformNotes({ ...platformNotes, rakuten: event.target.value })
              }
            />
          </label>
          <label className="rounded-[28px] border border-brand-line bg-stone-50 p-5 text-sm font-medium text-slate-700">
            Custom
            <textarea
              className="mt-3 min-h-36 w-full rounded-2xl border border-brand-line bg-white px-4 py-3 text-sm font-normal"
              value={platformNotes.custom}
              onChange={(event) =>
                setPlatformNotes({ ...platformNotes, custom: event.target.value })
              }
            />
          </label>
        </div>
      </section>

      <section className="surface-panel p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow">换链接配置</p>
            <h3 className="mt-2 text-2xl font-semibold text-slate-900">默认 MCC 脚本</h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              系统已经把站点地址和 Script Token 注入到脚本里。Script Token 默认长期有效，同一时间只有当前这一枚 token 生效。
              你只需要复制后粘贴到 Google Ads Scripts / MCC，并确保对应 Campaign 已绑定好 Offer 的 `campaignLabel`。
            </p>
          </div>
          <div className="rounded-[24px] border border-brand-line bg-stone-50 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Script Token</p>
            <p className="mt-2 font-mono text-sm text-slate-800">{script.token || "尚未生成"}</p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            className="rounded-full border border-brand-line bg-white px-4 py-2 text-xs font-semibold text-slate-700"
            disabled={rotatingToken}
            onClick={rotateToken}
            type="button"
          >
            {rotatingToken ? "更换中..." : "更换 Token"}
          </button>
          <button
            className="rounded-full bg-brand-emerald px-4 py-2 text-xs font-semibold text-white disabled:opacity-60"
            disabled={loading || !script.template || rotatingToken}
            onClick={() => navigator.clipboard.writeText(script.template)}
            type="button"
          >
            复制最新换链接脚本
          </button>
        </div>

        <div className="mt-4 space-y-2 text-sm leading-6 text-slate-600">
          <p>复制后无需再修改脚本内容。若你更换 Token，旧 Token 会立即失效，你需要重新复制一次最新脚本。</p>
          <p>快照接口地址：<span className="font-mono text-xs text-slate-700">{scriptAppUrl}/api/script/link-swap/snapshot</span></p>
        </div>

        <textarea
          className="mt-5 min-h-72 w-full rounded-2xl border border-brand-line bg-stone-50 px-4 py-3 font-mono text-xs"
          readOnly
          value={script.template}
        />
      </section>

      <div className="flex items-center gap-4">
        <button
          className="rounded-2xl bg-brand-emerald px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
          disabled={loading}
          onClick={saveSettings}
          type="button"
        >
          保存设置
        </button>
        {message ? <span className="text-sm text-slate-600">{message}</span> : null}
      </div>
    </div>
  );
}
