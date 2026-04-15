import { NextResponse, type NextRequest } from "next/server";

import {
  exchangeGoogleAdsCodeForTokens,
  getGoogleAdsCredentials,
  syncGoogleAdsAccounts,
  updateGoogleAdsTokens
} from "@autocashback/db";

import { getRequestUser } from "@/lib/api-auth";

function decodeState(value: string | null) {
  if (!value) return null;

  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as {
      userId: number;
      timestamp: number;
    };
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  if (error) {
    return NextResponse.redirect(new URL(`/google-ads?error=${encodeURIComponent(error)}`, request.url));
  }

  const code = url.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(new URL("/google-ads?error=missing_code", request.url));
  }

  const currentUser = await getRequestUser(request);
  const state = decodeState(url.searchParams.get("state"));
  const userId = currentUser?.id ?? state?.userId;

  if (!userId) {
    return NextResponse.redirect(new URL("/login?error=google_ads_oauth", request.url));
  }

  try {
    const credentials = await getGoogleAdsCredentials(userId);
    if (!credentials) {
      return NextResponse.redirect(new URL("/settings?googleAdsError=missing_config", request.url));
    }

    const tokens = await exchangeGoogleAdsCodeForTokens({
      code,
      clientId: credentials.clientId,
      clientSecret: credentials.clientSecret
    });
    const refreshToken = tokens.refresh_token || credentials.refreshToken;

    if (!refreshToken) {
      throw new Error("Google Ads OAuth 未返回 refresh token");
    }

    await updateGoogleAdsTokens(userId, {
      accessToken: tokens.access_token,
      refreshToken,
      tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    });

    await syncGoogleAdsAccounts(userId).catch(() => null);

    return NextResponse.redirect(new URL("/google-ads?success=oauth_connected", request.url));
  } catch (oauthError: unknown) {
    const message = oauthError instanceof Error ? oauthError.message : "oauth_failed";
    return NextResponse.redirect(
      new URL(`/google-ads?error=${encodeURIComponent(message)}`, request.url)
    );
  }
}
