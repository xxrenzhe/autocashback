import { describe, expect, it } from "vitest";

import { DEFAULT_SCRIPT_TEMPLATE, PLATFORM_OPTIONS } from "@autocashback/domain";

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
  });
});
