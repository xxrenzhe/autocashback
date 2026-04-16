import type { ProxySettingEntry } from "@autocashback/domain";

export type SettingsOverview = {
  activeProxyCount: number;
  configuredProxyCountries: number;
  hasGlobalProxy: boolean;
  googleAdsBaseConfigCount: number;
  googleAdsFullyConnected: boolean;
  googleAdsNeedsOAuth: boolean;
  noteCount: number;
  scriptReady: boolean;
};

export function buildSettingsOverview(input: {
  proxyEntries: ProxySettingEntry[];
  platformNotes: {
    topcashback: string;
    rakuten: string;
    custom: string;
  };
  googleAdsConfig: {
    hasClientId: boolean;
    hasClientSecret: boolean;
    hasDeveloperToken: boolean;
    hasRefreshToken: boolean;
    loginCustomerId: string;
  };
  script: {
    token: string;
    template: string;
  };
}): SettingsOverview {
  const activeProxyEntries = input.proxyEntries.filter(
    (entry) => entry.active && entry.url.trim() && entry.country.trim()
  );

  const configuredProxyCountries = new Set(
    activeProxyEntries.map((entry) => entry.country.trim().toUpperCase())
  );

  const googleAdsBaseConfigCount = [
    input.googleAdsConfig.hasClientId,
    input.googleAdsConfig.hasClientSecret,
    input.googleAdsConfig.hasDeveloperToken,
    Boolean(input.googleAdsConfig.loginCustomerId.trim())
  ].filter(Boolean).length;

  const noteCount = [
    input.platformNotes.topcashback,
    input.platformNotes.rakuten,
    input.platformNotes.custom
  ].filter((value) => value.trim().length > 0).length;

  return {
    activeProxyCount: activeProxyEntries.length,
    configuredProxyCountries: configuredProxyCountries.size,
    hasGlobalProxy: configuredProxyCountries.has("GLOBAL"),
    googleAdsBaseConfigCount,
    googleAdsFullyConnected: googleAdsBaseConfigCount === 4 && input.googleAdsConfig.hasRefreshToken,
    googleAdsNeedsOAuth: googleAdsBaseConfigCount === 4 && !input.googleAdsConfig.hasRefreshToken,
    noteCount,
    scriptReady: Boolean(input.script.token && input.script.template)
  };
}
