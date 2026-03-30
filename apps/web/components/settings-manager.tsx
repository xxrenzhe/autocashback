"use client";

import { useEffect, useState } from "react";

type SettingRow = {
  category: string;
  key: string;
  value: string;
  isSensitive?: boolean;
};

export function SettingsManager() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [scriptToken, setScriptToken] = useState("");

  async function loadSettings() {
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
    if (scriptPayload.template) {
      normalized["linkSwap.script_template"] = scriptPayload.template;
      setScriptToken(scriptPayload.token || "");
    }
    setSettings(normalized);
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
        value: settings["proxy.proxy_urls"] || "[]"
      },
      {
        category: "cashback",
        key: "platform_notes",
        value: settings["cashback.platform_notes"] || ""
      },
      {
        category: "linkSwap",
        key: "script_template",
        value: settings["linkSwap.script_template"] || ""
      }
    ];

    const response = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ updates })
    });

    setMessage(response.ok ? "已保存设置" : "保存失败");
  }

  async function rotateToken() {
    const response = await fetch("/api/script/link-swap/rotate-token", {
      method: "POST"
    });
    const payload = await response.json();
    setScriptToken(payload.token || "");
    await loadSettings();
  }

  return (
    <div className="space-y-6">
      <section className="surface-panel p-6">
        <p className="eyebrow">代理配置</p>
        <textarea
          className="mt-4 min-h-32 w-full rounded-2xl border border-brand-line bg-stone-50 px-4 py-3 text-sm"
          value={settings["proxy.proxy_urls"] || ""}
          onChange={(event) =>
            setSettings({ ...settings, "proxy.proxy_urls": event.target.value })
          }
        />
        <p className="mt-2 text-sm text-slate-500">使用 JSON 数组保存代理 URL，调度器会优先读取这里的配置。</p>
      </section>

      <section className="surface-panel p-6">
        <p className="eyebrow">返利网配置</p>
        <textarea
          className="mt-4 min-h-28 w-full rounded-2xl border border-brand-line bg-stone-50 px-4 py-3 text-sm"
          value={settings["cashback.platform_notes"] || ""}
          onChange={(event) =>
            setSettings({ ...settings, "cashback.platform_notes": event.target.value })
          }
        />
      </section>

      <section className="surface-panel p-6">
        <p className="eyebrow">换链接配置</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-stone-100 px-3 py-2 text-xs text-slate-600">
            Script Token: {scriptToken || "尚未生成"}
          </span>
          <button className="rounded-full border border-brand-line bg-white px-4 py-2 text-xs font-semibold text-slate-700" onClick={rotateToken} type="button">
            轮换 Token
          </button>
          <button
            className="rounded-full border border-brand-line bg-white px-4 py-2 text-xs font-semibold text-slate-700"
            onClick={() => navigator.clipboard.writeText(settings["linkSwap.script_template"] || "")}
            type="button"
          >
            复制脚本
          </button>
        </div>
        <textarea
          className="mt-4 min-h-56 w-full rounded-2xl border border-brand-line bg-stone-50 px-4 py-3 font-mono text-xs"
          value={settings["linkSwap.script_template"] || ""}
          onChange={(event) =>
            setSettings({ ...settings, "linkSwap.script_template": event.target.value })
          }
        />
      </section>

      <div className="flex items-center gap-4">
        <button className="rounded-2xl bg-brand-emerald px-5 py-3 text-sm font-semibold text-white" onClick={saveSettings} type="button">
          保存设置
        </button>
        {message ? <span className="text-sm text-slate-600">{message}</span> : null}
      </div>
    </div>
  );
}
