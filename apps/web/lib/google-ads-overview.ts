import type { GoogleAdsAccountRecord, GoogleAdsCredentialStatus } from "@autocashback/domain";

export type GoogleAdsOverview = {
  hasBaseConfig: boolean;
  fullyConnected: boolean;
  needsOAuth: boolean;
  accountCount: number;
  managerCount: number;
  testAccountCount: number;
  activeAccountCount: number;
};

export function buildGoogleAdsOverview(
  credentials: GoogleAdsCredentialStatus | null,
  accounts: GoogleAdsAccountRecord[]
): GoogleAdsOverview {
  const hasBaseConfig = Boolean(credentials?.hasCredentials);
  const fullyConnected = Boolean(hasBaseConfig && credentials?.hasRefreshToken);
  const needsOAuth = Boolean(hasBaseConfig && !credentials?.hasRefreshToken);

  return {
    hasBaseConfig,
    fullyConnected,
    needsOAuth,
    accountCount: accounts.length,
    managerCount: accounts.filter((account) => account.manager).length,
    testAccountCount: accounts.filter((account) => account.testAccount).length,
    activeAccountCount: accounts.filter((account) => String(account.status || "").toUpperCase() === "ENABLED").length
  };
}
