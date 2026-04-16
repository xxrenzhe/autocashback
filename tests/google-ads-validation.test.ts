import { describe, expect, it } from "vitest";

import { validateGoogleAdsCredentialInput } from "@autocashback/db";

describe("google ads credential validation", () => {
  it("rejects a developer token that looks like a client secret", () => {
    const result = validateGoogleAdsCredentialInput({
      clientId: "test.apps.googleusercontent.com",
      clientSecret: "client-secret-value-1234567890",
      developerToken: "GOCSPX-secret-value",
      loginCustomerId: "123-456-7890"
    });

    expect(result.valid).toBe(false);
    if (result.valid) {
      throw new Error("expected invalid result");
    }
    expect(result.message).toContain("Client Secret");
  });

  it("normalizes login customer id before accepting valid input", () => {
    const result = validateGoogleAdsCredentialInput({
      clientId: "test.apps.googleusercontent.com",
      clientSecret: "client-secret-value-1234567890",
      developerToken: "developer-token-value-1234567890",
      loginCustomerId: "123-456-7890"
    });

    expect(result.valid).toBe(true);
    if (!result.valid) {
      throw new Error("expected valid result");
    }
    expect(result.normalizedInput.loginCustomerId).toBe("1234567890");
  });
});
