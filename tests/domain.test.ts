import { describe, expect, it } from "vitest";

import {
  DEFAULT_SCRIPT_TEMPLATE,
  PLATFORM_OPTIONS,
  renderScriptTemplate
} from "@autocashback/domain";

describe("domain defaults", () => {
  it("exposes the supported manual cashback platforms", () => {
    expect(PLATFORM_OPTIONS.map((item) => item.value)).toEqual([
      "topcashback",
      "rakuten",
      "custom"
    ]);
  });

  it("ships a full MCC script template", () => {
    expect(DEFAULT_SCRIPT_TEMPLATE).toContain("function main()");
    expect(DEFAULT_SCRIPT_TEMPLATE).toContain("/api/script/link-swap/snapshot");
    expect(DEFAULT_SCRIPT_TEMPLATE).toContain("__APP_URL__");
    expect(DEFAULT_SCRIPT_TEMPLATE).toContain("__SCRIPT_TOKEN__");
    expect(DEFAULT_SCRIPT_TEMPLATE).toContain("setFinalUrlSuffix");
    expect(DEFAULT_SCRIPT_TEMPLATE).toContain("buildTaskMap");
    expect(DEFAULT_SCRIPT_TEMPLATE).not.toContain("__CAMPAIGN_LABEL__");
  });

  it("renders runtime values into the MCC script template", () => {
    const rendered = renderScriptTemplate(DEFAULT_SCRIPT_TEMPLATE, {
      appUrl: "https://www.autocashback.dev",
      scriptToken: "token-123"
    });

    expect(rendered).toContain("https://www.autocashback.dev");
    expect(rendered).toContain("token-123");
    expect(rendered).toContain("fetchSnapshot()");
    expect(rendered).not.toContain("__APP_URL__");
    expect(rendered).not.toContain("__SCRIPT_TOKEN__");
  });
});
