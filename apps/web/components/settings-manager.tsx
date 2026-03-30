"use client";

import { useEffect, useState } from "react";

import type { ProxySettingEntry } from "@autocashback/domain";

type SettingRow = {
  category: string;
  key: string;
  value: string;
  isSensitive?: boolean;
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
  const [platformNotes, setPlatformNotes] = useState({
    topcashback: "",
    rakuten: "",
    custom: ""
  });
  const [scriptTemplate, setScriptTemplate] = useState("");
  const [scriptToken, setScriptToken] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadSettings() {
    setLoading(true);
    const [settingsResponse, scriptResponse] = await Promise.all([
      fetch("/api/settings"),
      fetch("/api/script/link-swap/template")
    ]);
    const payload = await settingsResponse.json();
    const scriptPayload = await scriptResponse.json();
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
    setScriptTemplate(scriptPayload.template || normalized["linkSwap.script_template"] || "");
    setScriptToken(scriptPayload.token || "");
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
      },
      {
        category: "linkSwap",
        key: "script_template",
        value: scriptTemplate
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
    const response = await fetch("/api/script/link-swap/rotate-token", {
      method: "POST"
    });
    const payload = await response.json();
    setScriptToken(payload.token || "");
    await loadSettings();
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
          参考 autobb 的代理配置方式。每条代理绑定一个国家代码，调度器会优先选择与 Offer 国家匹配的代理，未命中时回退到
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
                  <button
                    className="rounded-full border border-red-200 bg-red-50 px-4 py-2 text-xs font-semibold text-red-600"
                    onClick={() => removeProxyEntry(index)}
                    type="button"
                  >
                    删除
                  </button>
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
              平台通过快照接口提供只读数据。你只需要复制脚本、填入 Google Ads 标签、配置定时执行。
            </p>
          </div>
          <div className="rounded-[24px] border border-brand-line bg-stone-50 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Script Token</p>
            <p className="mt-2 font-mono text-sm text-slate-800">{scriptToken || "尚未生成"}</p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            className="rounded-full border border-brand-line bg-white px-4 py-2 text-xs font-semibold text-slate-700"
            onClick={rotateToken}
            type="button"
          >
            轮换 Token
          </button>
          <button
            className="rounded-full bg-brand-emerald px-4 py-2 text-xs font-semibold text-white"
            onClick={() => navigator.clipboard.writeText(scriptTemplate)}
            type="button"
          >
            复制脚本
          </button>
        </div>

        <textarea
          className="mt-5 min-h-72 w-full rounded-2xl border border-brand-line bg-stone-50 px-4 py-3 font-mono text-xs"
          readOnly
          value={scriptTemplate}
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
