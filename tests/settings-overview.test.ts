import { describe, expect, it } from "vitest";

import { buildSettingsOverview } from "../apps/web/lib/settings-overview";

describe("buildSettingsOverview", () => {
  it("summarizes current settings readiness", () => {
    const overview = buildSettingsOverview({
      proxyEntries: [
        { label: "global-main", country: "GLOBAL", url: "http://proxy-1", active: true },
        { label: "us-main", country: "US", url: "http://proxy-2", active: true },
        { label: "ca-paused", country: "CA", url: "http://proxy-3", active: false }
      ],
      platformNotes: {
        topcashback: "use with cookie isolation",
        rakuten: "",
        custom: "manual review required"
      },
      googleAdsConfig: {
        hasClientId: true,
        hasClientSecret: true,
        hasDeveloperToken: true,
        hasRefreshToken: false,
        loginCustomerId: "1234567890"
      },
      script: {
        token: "token-123",
        template: "function main() {}"
      }
    });

    expect(overview.activeProxyCount).toBe(2);
    expect(overview.configuredProxyCountries).toBe(2);
    expect(overview.hasGlobalProxy).toBe(true);
    expect(overview.googleAdsBaseConfigCount).toBe(4);
    expect(overview.googleAdsFullyConnected).toBe(false);
    expect(overview.googleAdsNeedsOAuth).toBe(true);
    expect(overview.noteCount).toBe(2);
    expect(overview.scriptReady).toBe(true);
  });
});
