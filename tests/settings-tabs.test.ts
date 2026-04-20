import { describe, expect, it } from "vitest";

import { SETTINGS_TAB_ITEMS, getSettingsTabFromHash } from "../apps/web/components/settings/tabs";

describe("settings tabs", () => {
  it("does not expose platform settings in the visible tabs", () => {
    expect(SETTINGS_TAB_ITEMS.some((item) => item.hash === "#platform-settings")).toBe(false);
  });

  it("ignores the removed platform settings hash", () => {
    expect(getSettingsTabFromHash("#platform-settings")).toBeNull();
  });
});
