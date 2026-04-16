import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  exchangeGoogleAdsCodeForTokens,
  getGoogleAdsCredentials,
  syncGoogleAdsAccounts,
  updateGoogleAdsTokens,
  validateGoogleAdsCredentialInput
} = vi.hoisted(() => ({
  exchangeGoogleAdsCodeForTokens: vi.fn(),
  getGoogleAdsCredentials: vi.fn(),
  syncGoogleAdsAccounts: vi.fn(),
  updateGoogleAdsTokens: vi.fn(),
  validateGoogleAdsCredentialInput: vi.fn()
}));

const { getRequestUser } = vi.hoisted(() => ({
  getRequestUser: vi.fn()
}));

vi.mock("@autocashback/db", () => ({
  exchangeGoogleAdsCodeForTokens,
  getGoogleAdsCredentials,
  syncGoogleAdsAccounts,
  updateGoogleAdsTokens,
  validateGoogleAdsCredentialInput
}));

vi.mock("@/lib/api-auth", () => ({
  getRequestUser
}));

import { GET } from "../apps/web/app/api/auth/google-ads/callback/route";

function encodeState(state: { userId: number; timestamp: number }) {
  return Buffer.from(JSON.stringify(state)).toString("base64url");
}

describe("google ads callback route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRequestUser.mockResolvedValue(null);
    getGoogleAdsCredentials.mockResolvedValue({
      clientId: "client.apps.googleusercontent.com",
      clientSecret: "client-secret-value-1234567890",
      developerToken: "developer-token-value-1234567890",
      loginCustomerId: "1234567890",
      refreshToken: null
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
    exchangeGoogleAdsCodeForTokens.mockResolvedValue({
      access_token: "access-token",
      refresh_token: "refresh-token",
      expires_in: 3600
    });
    syncGoogleAdsAccounts.mockResolvedValue([]);
  });

  it("rejects callback when state is missing", async () => {
    const request = new NextRequest("https://www.autocashback.dev/api/auth/google-ads/callback?code=test-code");
    const response = await GET(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/google-ads?error=invalid_state");
  });

  it("rejects expired oauth state", async () => {
    const request = new NextRequest(
      `https://www.autocashback.dev/api/auth/google-ads/callback?code=test-code&state=${encodeState({
        userId: 17,
        timestamp: Date.now() - 11 * 60 * 1000
      })}`
    );

    const response = await GET(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/google-ads?error=state_expired");
  });

  it("rejects callback when logged-in user does not match state user", async () => {
    getRequestUser.mockResolvedValue({ id: 99 });

    const request = new NextRequest(
      `https://www.autocashback.dev/api/auth/google-ads/callback?code=test-code&state=${encodeState({
        userId: 17,
        timestamp: Date.now()
      })}`
    );

    const response = await GET(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/google-ads?error=invalid_state");
  });

  it("uses state user id to exchange tokens and save oauth result", async () => {
    const request = new NextRequest(
      `https://www.autocashback.dev/api/auth/google-ads/callback?code=test-code&state=${encodeState({
        userId: 17,
        timestamp: Date.now()
      })}`
    );

    const response = await GET(request);

    expect(response.status).toBe(307);
    expect(getGoogleAdsCredentials).toHaveBeenCalledWith(17);
    expect(exchangeGoogleAdsCodeForTokens).toHaveBeenCalledWith({
      code: "test-code",
      clientId: "client.apps.googleusercontent.com",
      clientSecret: "client-secret-value-1234567890"
    });
    expect(updateGoogleAdsTokens).toHaveBeenCalledWith(
      17,
      expect.objectContaining({
        accessToken: "access-token",
        refreshToken: "refresh-token"
      })
    );
    expect(syncGoogleAdsAccounts).toHaveBeenCalledWith(17);
    expect(response.headers.get("location")).toContain("/google-ads?success=oauth_connected");
  });
});
