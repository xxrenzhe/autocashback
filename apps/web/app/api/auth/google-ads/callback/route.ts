import { NextResponse, type NextRequest } from "next/server";

import {
  exchangeGoogleAdsCodeForTokens,
  getGoogleAdsCredentials,
  syncGoogleAdsAccounts,
  updateGoogleAdsTokens,
  validateGoogleAdsCredentialInput
} from "@autocashback/db";

import { getRequestUser } from "@/lib/api-auth";
import {
  clearGoogleAdsOAuthStateCookie,
  verifyGoogleAdsOAuthState
} from "@/lib/google-ads-oauth-state";

function buildGoogleAdsRedirect(request: NextRequest, error: string) {
  return clearGoogleAdsOAuthStateCookie(
    NextResponse.redirect(
      new URL(`/google-ads?error=${encodeURIComponent(error)}`, request.url)
    )
  );
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  if (error) {
    return buildGoogleAdsRedirect(request, error);
  }

  const code = url.searchParams.get("code");
  if (!code) {
    return buildGoogleAdsRedirect(request, "missing_code");
  }

  const currentUser = await getRequestUser(request);
  if (!currentUser) {
    return buildGoogleAdsRedirect(request, "google_ads_oauth");
  }

  const stateError = verifyGoogleAdsOAuthState(
    request,
    url.searchParams.get("state"),
    currentUser.id
  );
  if (stateError) {
    return buildGoogleAdsRedirect(request, stateError);
  }

  const userId = currentUser.id;

  try {
    const credentials = await getGoogleAdsCredentials(userId);
    if (!credentials) {
      return buildGoogleAdsRedirect(request, "missing_google_ads_config");
    }

    const validation = validateGoogleAdsCredentialInput({
      clientId: credentials.clientId,
      clientSecret: credentials.clientSecret,
      developerToken: credentials.developerToken,
      loginCustomerId: credentials.loginCustomerId
    });

    if (!validation.valid) {
      if (validation.message.includes("Developer Token")) {
        return buildGoogleAdsRedirect(request, "developer_token_invalid");
      }

      return buildGoogleAdsRedirect(request, "missing_google_ads_config");
    }

    const tokens = await exchangeGoogleAdsCodeForTokens({
      code,
      clientId: validation.normalizedInput.clientId,
      clientSecret: validation.normalizedInput.clientSecret
    });
    const refreshToken = tokens.refresh_token || credentials.refreshToken;

    if (!refreshToken) {
      return buildGoogleAdsRedirect(request, "missing_refresh_token");
    }

    await updateGoogleAdsTokens(userId, {
      accessToken: tokens.access_token,
      refreshToken,
      tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    });

    await syncGoogleAdsAccounts(userId).catch(() => null);

    return clearGoogleAdsOAuthStateCookie(
      NextResponse.redirect(new URL("/google-ads?success=oauth_connected", request.url))
    );
  } catch (oauthError: unknown) {
    const message = oauthError instanceof Error ? oauthError.message : "oauth_failed";
    return buildGoogleAdsRedirect(request, message);
  }
}
