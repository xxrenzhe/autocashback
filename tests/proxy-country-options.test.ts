import { describe, expect, it } from "vitest";

import {
  getNextProxyCountryCode,
  getProxyCountryLabel,
  getProxyCountryOptions
} from "../apps/web/lib/proxy-country-options";

describe("proxy country options", () => {
  it("keeps GLOBAL as the first fallback option", () => {
    const options = getProxyCountryOptions();

    expect(options[0]).toEqual({
      code: "GLOBAL",
      label: "默认兜底 (GLOBAL)"
    });
    expect(options.some((option) => option.code === "US")).toBe(true);
    expect(options.some((option) => option.code === "DE")).toBe(true);
  });

  it("picks the next unused country when adding a proxy", () => {
    expect(getNextProxyCountryCode([])).toBe("GLOBAL");
    expect(getNextProxyCountryCode(["global"])).toBe("US");
    expect(getNextProxyCountryCode(["GLOBAL", "US", "CA"])).toBe("MX");
  });

  it("renders readable labels for both fallback and regional entries", () => {
    expect(getProxyCountryLabel("GLOBAL")).toBe("默认兜底 (GLOBAL)");
    expect(getProxyCountryLabel("us")).toContain("(US)");
  });
});
