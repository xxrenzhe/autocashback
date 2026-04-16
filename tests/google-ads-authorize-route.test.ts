import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { getGoogleAdsAuthorizationUrlForClient, getGoogleAdsCredentials, validateGoogleAdsCredentialInput } =
  vi.hoisted(() => ({
    getGoogleAdsAuthorizationUrlForClient: vi.fn(),
    getGoogleAdsCredentials: vi.fn(),
    validateGoogleAdsCredentialInput: vi.fn()
  }));

const { getRequestUser } = vi.hoisted(() => ({
  getRequestUser: vi.fn()
}));

vi.mock("@autocashback/db", () => ({
  getGoogleAdsAuthorizationUrlForClient,
  getGoogleAdsCredentials,
  validateGoogleAdsCredentialInput
}));

vi.mock("@/lib/api-auth", () => ({
  getRequestUser
}));

import { GET } from "../apps/web/app/api/auth/google-ads/authorize/route";

describe("google ads authorize route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRequestUser.mockResolvedValue({ id: 17 });
    getGoogleAdsCredentials.mockResolvedValue({
      clientId: "client.apps.googleusercontent.com",
      clientSecret: "client-secret-value-1234567890",
      developerToken: "developer-token-value-1234567890",
      loginCustomerId: "1234567890"
    });
    validateGoogleAdsCredentialInput.mockReturnValue({
      valid: true,
      normalizedInput: {
        clientId: "client.apps.googleusercontent.com",
        clientSecret: "client-secret-value-1234567890",
        developerToken: "developer-token-value-1234567890",
        loginCustomerId: "1234567890"
      }
    });
    getGoogleAdsAuthorizationUrlForClient.mockReturnValue("https://accounts.google.com/o/oauth2/v2/auth?state=test");
  });

  it("redirects to google-ads with missing login customer id error", async () => {
    getGoogleAdsCredentials.mockResolvedValue({
      clientId: "client.apps.googleusercontent.com",
      clientSecret: "client-secret-value-1234567890",
      developerToken: "developer-token-value-1234567890",
      loginCustomerId: ""
    });

    const response = await GET(new NextRequest("https://www.autocashback.dev/api/auth/google-ads/authorize"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/google-ads?error=missing_login_customer_id");
    expect(getGoogleAdsAuthorizationUrlForClient).not.toHaveBeenCalled();
  });

  it("redirects to google-ads when developer token validation fails", async () => {
    validateGoogleAdsCredentialInput.mockReturnValue({
      valid: false,
      message: "Developer Token 看起来像 Client Secret（以 GOCSPX- 开头），请在 Google Ads API Center 获取正确的 Developer Token。"
    });

    const response = await GET(new NextRequest("https://www.autocashback.dev/api/auth/google-ads/authorize"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/google-ads?error=developer_token_invalid");
  });

  it("uses normalized credentials to build auth url when validation passes", async () => {
    const response = await GET(new NextRequest("https://www.autocashback.dev/api/auth/google-ads/authorize"));

    expect(response.status).toBe(307);
    expect(getGoogleAdsAuthorizationUrlForClient).toHaveBeenCalledTimes(1);
    expect(getGoogleAdsAuthorizationUrlForClient).toHaveBeenCalledWith(
      "client.apps.googleusercontent.com",
      expect.any(String)
    );
    expect(response.headers.get("location")).toBe("https://accounts.google.com/o/oauth2/v2/auth?state=test");
    expect(response.cookies.get("autocashback_google_ads_oauth_state")?.value).toBeTruthy();
  });
});
