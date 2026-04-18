export type SettingsTabValue =
  | "proxy"
  | "google-ads"
  | "script"
  | "account-security"
  | "platform-notes";

export type SettingsTabItem = {
  value: SettingsTabValue;
  label: string;
  hash: string;
};

export const SETTINGS_TAB_ITEMS: SettingsTabItem[] = [
  { value: "proxy", label: "代理", hash: "#proxy-settings" },
  { value: "google-ads", label: "Google Ads", hash: "#google-ads-settings" },
  { value: "script", label: "脚本模板", hash: "#script-settings" },
  { value: "account-security", label: "账号安全", hash: "#account-security-settings" },
  { value: "platform-notes", label: "平台备注", hash: "#platform-settings" }
];

const hashToTabMap: Record<string, SettingsTabValue> = {
  "#proxy-settings": "proxy",
  "#google-ads-settings": "google-ads",
  "#script-settings": "script",
  "#account-security-settings": "account-security",
  "#platform-settings": "platform-notes"
};

const tabToHashMap = SETTINGS_TAB_ITEMS.reduce<Record<SettingsTabValue, string>>(
  (accumulator, item) => {
    accumulator[item.value] = item.hash;
    return accumulator;
  },
  {
    proxy: "#proxy-settings",
    "google-ads": "#google-ads-settings",
    script: "#script-settings",
    "account-security": "#account-security-settings",
    "platform-notes": "#platform-settings"
  }
);

export function getSettingsTabFromHash(rawHash: string): SettingsTabValue | null {
  if (!rawHash) {
    return null;
  }
  return hashToTabMap[rawHash.toLowerCase()] ?? null;
}

export function getHashForSettingsTab(tab: SettingsTabValue): string {
  return tabToHashMap[tab];
}
