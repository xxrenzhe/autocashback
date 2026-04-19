"use client";

import * as Tabs from "@radix-ui/react-tabs";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Globe2,
  KeyRound,
  LockKeyhole,
  Link2,
  NotebookPen,
  ShieldCheck
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { ProxySettingEntry } from "@autocashback/domain";
import { PageHeader, ShortcutCard, StatCard } from "@autocashback/ui";
import { toast } from "sonner";

import { AccountSecuritySettingsTab } from "@/components/settings/account-security-settings-tab";
import { GoogleAdsSettingsTab } from "@/components/settings/google-ads-settings-tab";
import { PlatformNotesSettingsTab } from "@/components/settings/platform-notes-settings-tab";
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
import { buildSettingsOverview } from "@/lib/settings-overview";

type HeroShortcut = {
  tab: SettingsTabValue;
  title: string;
  description: string;
  icon: LucideIcon;
};

const heroShortcuts: HeroShortcut[] = [
  {
    tab: "proxy",
    title: "代理与国家覆盖",
    description: "确认目标国家代理是否齐备，避免换链和诊断任务失败。",
    icon: Globe2
  },
  {
    tab: "google-ads",
    title: "Google Ads 授权",
    description: "基础参数齐全后再做 OAuth 授权和账号同步。",
    icon: ShieldCheck
  },
  {
    tab: "script",
    title: "脚本与 Token",
    description: "统一维护 MCC 脚本模板和当前有效 Script Token。",
    icon: KeyRound
  },
  {
    tab: "account-security",
    title: "账号安全",
    description: "统一管理密码更新和活跃会话撤销。",
    icon: LockKeyhole
  },
  {
    tab: "platform-notes",
    title: "平台接入备注",
    description: "沉淀返利平台处理规范，减少账号和 Offer 操作分歧。",
    icon: NotebookPen
  }
];

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

  const updatePlatformNote = useCallback((key: keyof PlatformNotes, value: string) => {
    setPlatformNotes((current) => ({
      ...current,
      [key]: value
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
            <PageHeader
              eyebrow="Settings"
              title="系统配置控制台"
            />

            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {heroShortcuts.map((shortcut) => (
                <button
                  className="w-full text-left"
                  key={shortcut.tab}
                  onClick={() => selectTab(shortcut.tab)}
                  type="button"
                >
                  <ShortcutCard
                    description={shortcut.description}
                    icon={shortcut.icon}
                    title={shortcut.title}
                    trailing={
                      <ArrowRight className="h-4 w-4 text-muted-foreground/80 transition group-hover:text-primary" />
                    }
                  />
                </button>
              ))}
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

      <Tabs.Root className="space-y-4" onValueChange={handleTabValueChange} value={activeTab}>
        <Tabs.List className="flex flex-wrap gap-2 rounded-xl border border-border bg-muted/30 p-2">
          {SETTINGS_TAB_ITEMS.map((tab) => (
            <Tabs.Trigger
              className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-background/80 hover:text-foreground data-[state=active]:bg-primary data-[state=active]:text-white"
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
            overview={{
              activeProxyCount: overview.activeProxyCount,
              configuredProxyCountries: overview.configuredProxyCountries,
              hasGlobalProxy: overview.hasGlobalProxy
            }}
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

        <Tabs.Content className="outline-none" value="platform-notes">
          <PlatformNotesSettingsTab
            onPlatformNoteChange={updatePlatformNote}
            overview={{ noteCount: overview.noteCount }}
            platformNotes={platformNotes}
          />
        </Tabs.Content>
      </Tabs.Root>

      <div className="flex items-center gap-4">
        <button
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          disabled={loading}
          onClick={saveSettings}
          type="button"
        >
          保存设置
        </button>
      </div>
    </div>
  );
}
