import type { ProxySettingEntry } from "@autocashback/domain";

export type SettingRow = {
  category: string;
  key: string;
  value: string;
  isSensitive?: boolean;
};

export type ProxyValidationState = {
  status: "idle" | "success" | "error" | "loading";
  message: string;
};

export type PlatformNotes = {
  topcashback: string;
  rakuten: string;
  custom: string;
};

export type GoogleAdsConfig = {
  clientId: string;
  clientSecret: string;
  developerToken: string;
  loginCustomerId: string;
  hasClientId: boolean;
  hasClientSecret: boolean;
  hasDeveloperToken: boolean;
  hasRefreshToken: boolean;
  tokenExpiresAt: string;
  lastVerifiedAt: string;
};

export type ScriptTemplatePayload = {
  token: string;
  template: string;
};

export type ProxySettingsTabOverview = {
  activeProxyCount: number;
  configuredProxyCountries: number;
  hasGlobalProxy: boolean;
};

export type GoogleAdsSettingsTabOverview = {
  googleAdsBaseConfigCount: number;
};

export type PlatformNotesSettingsTabOverview = {
  noteCount: number;
};

export type ScriptSettingsTabOverview = {
  scriptReady: boolean;
};

export type ProxySettingsTabProps = {
  overview: ProxySettingsTabOverview;
  proxyEntries: ProxySettingEntry[];
  proxyValidation: Record<number, ProxyValidationState>;
  onAddProxyEntry: () => void;
  onUpdateProxyEntry: (index: number, next: Partial<ProxySettingEntry>) => void;
  onRemoveProxyEntry: (index: number) => void;
  onValidateProxyEntry: (index: number, url: string) => void;
};

export type GoogleAdsSettingsTabProps = {
  overview: GoogleAdsSettingsTabOverview;
  googleAdsConfig: GoogleAdsConfig;
  onGoogleAdsConfigChange: (next: Partial<GoogleAdsConfig>) => void;
  onOpenGoogleAdsPage: () => void;
  onSaveGoogleAdsConfig: () => void;
  onAuthorizeGoogleAds: () => void;
  onVerifyGoogleAdsConfig: () => void;
  onClearGoogleAdsConfig: () => void;
};

export type PlatformNotesSettingsTabProps = {
  overview: PlatformNotesSettingsTabOverview;
  platformNotes: PlatformNotes;
  onPlatformNoteChange: (key: keyof PlatformNotes, value: string) => void;
};

export type ScriptSettingsTabProps = {
  overview: ScriptSettingsTabOverview;
  script: ScriptTemplatePayload;
  scriptAppUrl: string;
  loading: boolean;
  rotatingToken: boolean;
  onRotateToken: () => void;
  onCopyScriptTemplate: () => void;
};
