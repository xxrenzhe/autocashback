"use client";

import * as Tabs from "@radix-ui/react-tabs";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Save } from "lucide-react";

import type { ProxySettingEntry } from "@autocashback/domain";
import { toast } from "sonner";

import { AccountSecuritySettingsTab } from "@/components/settings/account-security-settings-tab";
import { GoogleAdsSettingsTab } from "@/components/settings/google-ads-settings-tab";
import { ProxySettingsTab } from "@/components/settings/proxy-settings-tab";
import { ScriptSettingsTab } from "@/components/settings/script-settings-tab";
import {
  SETTINGS_TAB_ITEMS,
  getHashForSettingsTab,
  getSettingsTabFromHash,
  type SettingsTabValue
} from "@/components/settings/tabs";
import type {
  GoogleAdsConfig,
  PlatformNotes,
  ProxyValidationState,
  ScriptTemplatePayload,
  SettingRow
} from "@/components/settings/types";
import { fetchJson } from "@/lib/api-error-handler";
import { getNextProxyCountryCode } from "@/lib/proxy-country-options";
import { buildSettingsOverview } from "@/lib/settings-overview";

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
  const [proxyValidation, setProxyValidation] = useState<Record<number, ProxyValidationState>>({});
  const [platformNotes, setPlatformNotes] = useState<PlatformNotes>({
    topcashback: "",
    rakuten: "",
    custom: ""
  });
  const [googleAdsConfig, setGoogleAdsConfig] = useState<GoogleAdsConfig>({
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
  const [loading, setLoading] = useState(true);
  const [rotatingToken, setRotatingToken] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTabValue>("proxy");

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

  const syncTabFromHash = useCallback((rawHash: string) => {
    const tab = getSettingsTabFromHash(rawHash);
    if (tab) {
      setActiveTab(tab);
    }
  }, []);

  const updateTabHash = useCallback((tab: SettingsTabValue) => {
    if (typeof window === "undefined") {
      return;
    }
    const nextHash = getHashForSettingsTab(tab);
    if (window.location.hash !== nextHash) {
      window.location.hash = nextHash;
    }
  }, []);

  const selectTab = useCallback(
    (tab: SettingsTabValue) => {
      setActiveTab(tab);
      updateTabHash(tab);
    },
    [updateTabHash]
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
      toast.error(failure.userMessage);
      setLoading(false);
      return false;
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
    setScriptAppUrl(typeof window === "undefined" ? "" : window.location.origin);
    setLoading(false);
    return true;
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    syncTabFromHash(window.location.hash);
    const handleHashChange = () => {
      syncTabFromHash(window.location.hash);
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, [syncTabFromHash]);

  const handleTabValueChange = useCallback(
    (nextValue: string) => {
      selectTab(nextValue as SettingsTabValue);
    },
    [selectTab]
  );

  async function saveSettings() {
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

    if (!result.success) {
      toast.error(result.userMessage);
      return;
    }

    if (await loadSettings()) {
      toast.success("已保存设置");
    }
  }

  async function rotateToken() {
    setRotatingToken(true);

    try {
      const result = await fetchJson("/api/script/link-swap/rotate-token", {
        method: "POST"
      });
      if (!result.success) {
        toast.error(result.userMessage);
        return;
      }

      if (await loadSettings()) {
        toast.success("Token 已更换，旧脚本立即失效，请重新复制最新换链接脚本。");
      }
    } catch {
      toast.error("Token 更换失败");
    } finally {
      setRotatingToken(false);
    }
  }

  async function saveGoogleAdsConfig() {
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
        toast.error(result.userMessage);
        return;
      }

      if (await loadSettings()) {
        toast.success(
          result.data.credentials?.hasRefreshToken
            ? "Google Ads 配置已保存"
            : "Google Ads 配置已保存，请重新发起 OAuth 授权"
        );
      }
    } catch {
      toast.error("Google Ads 配置保存失败");
    }
  }

  async function verifyGoogleAdsConfig() {
    try {
      const result = await fetchJson<{ accountCount?: number }>("/api/google-ads/credentials/verify", {
        method: "POST"
      });
      if (!result.success) {
        toast.error(result.userMessage);
        return;
      }

      if (await loadSettings()) {
        toast.success(`Google Ads 配置验证成功，已同步 ${result.data.accountCount || 0} 个账号`);
      }
    } catch {
      toast.error("Google Ads 配置验证失败");
    }
  }

  async function clearGoogleAdsConfig() {
    try {
      const result = await fetchJson("/api/google-ads/credentials", {
        method: "DELETE"
      });
      if (!result.success) {
        toast.error(result.userMessage);
        return;
      }

      if (await loadSettings()) {
        toast.success("Google Ads 配置已清除");
      }
    } catch {
      toast.error("Google Ads 配置清除失败");
    }
  }

  const updateGoogleAdsConfig = useCallback((next: Partial<GoogleAdsConfig>) => {
    setGoogleAdsConfig((current) => ({
      ...current,
      ...next
    }));
  }, []);

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
    setProxyValidation((current) => {
      if (!(index in current)) {
        return current;
      }

      const nextValidation = { ...current };
      delete nextValidation[index];
      return nextValidation;
    });
  }

  function addProxyEntry() {
    setProxyEntries((current) => [
      ...current,
      {
        ...emptyProxyEntry,
        country: getNextProxyCountryCode(current.map((entry) => entry.country))
      }
    ]);
  }

  function removeProxyEntry(index: number) {
    setProxyEntries((current) => current.filter((_, entryIndex) => entryIndex !== index));
    setProxyValidation((current) =>
      Object.entries(current).reduce<Record<number, ProxyValidationState>>((nextValidation, [key, value]) => {
        const numericIndex = Number(key);
        if (numericIndex === index) {
          return nextValidation;
        }

        nextValidation[numericIndex > index ? numericIndex - 1 : numericIndex] = value;
        return nextValidation;
      }, {})
    );
  }

  async function validateProxyEntry(index: number, url: string) {
    if (!url.trim()) {
      setProxyValidation((current) => ({
        ...current,
        [index]: { status: "error", message: "请先填写代理 URL" }
      }));
      return;
    }

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
    <div className="space-y-3">
      <section className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">设置</h1>
            <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
              {SETTINGS_TAB_ITEMS.find((tab) => tab.value === activeTab)?.label}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">代理、Google Ads、脚本与账户安全。</p>
        </div>

        <button
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          disabled={loading}
          onClick={saveSettings}
          type="button"
        >
          <Save className="h-4 w-4" />
          保存设置
        </button>
      </section>

      <Tabs.Root className="space-y-3" onValueChange={handleTabValueChange} value={activeTab}>
        <Tabs.List className="flex flex-wrap gap-2 rounded-xl border border-border bg-card p-2">
          {SETTINGS_TAB_ITEMS.map((tab) => (
            <Tabs.Trigger
              className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted/60 hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-white"
              key={tab.value}
              value={tab.value}
            >
              {tab.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <Tabs.Content className="outline-none" value="proxy">
          <ProxySettingsTab
            onAddProxyEntry={addProxyEntry}
            onRemoveProxyEntry={removeProxyEntry}
            onUpdateProxyEntry={updateProxyEntry}
            onValidateProxyEntry={validateProxyEntry}
            proxyEntries={proxyEntries}
            proxyValidation={proxyValidation}
          />
        </Tabs.Content>

        <Tabs.Content className="outline-none" value="google-ads">
          <GoogleAdsSettingsTab
            googleAdsConfig={googleAdsConfig}
            onAuthorizeGoogleAds={() => {
              window.location.href = "/api/auth/google-ads/authorize";
            }}
            onClearGoogleAdsConfig={clearGoogleAdsConfig}
            onGoogleAdsConfigChange={updateGoogleAdsConfig}
            onOpenGoogleAdsPage={() => {
              window.location.href = "/google-ads";
            }}
            onSaveGoogleAdsConfig={saveGoogleAdsConfig}
            onVerifyGoogleAdsConfig={verifyGoogleAdsConfig}
            overview={{ googleAdsBaseConfigCount: overview.googleAdsBaseConfigCount }}
          />
        </Tabs.Content>

        <Tabs.Content className="outline-none" value="script">
          <ScriptSettingsTab
            loading={loading}
            onCopyScriptTemplate={() => {
              void navigator.clipboard.writeText(script.template);
            }}
            onRotateToken={rotateToken}
            overview={{ scriptReady: overview.scriptReady }}
            rotatingToken={rotatingToken}
            script={script}
            scriptAppUrl={scriptAppUrl}
          />
        </Tabs.Content>

        <Tabs.Content className="outline-none" value="account-security">
          <AccountSecuritySettingsTab />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
