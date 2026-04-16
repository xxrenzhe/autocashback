import { NextResponse, type NextRequest } from "next/server";

import {
  getGoogleAdsAuthorizationUrlForClient,
  getGoogleAdsCredentials,
  validateGoogleAdsCredentialInput
} from "@autocashback/db";

import { getRequestUser } from "@/lib/api-auth";
import {
  attachGoogleAdsOAuthStateCookie,
  issueGoogleAdsOAuthState
} from "@/lib/google-ads-oauth-state";

function buildGoogleAdsRedirect(request: NextRequest, error: string) {
  return NextResponse.redirect(
    new URL(`/google-ads?error=${encodeURIComponent(error)}`, request.url)
  );
}

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const credentials = await getGoogleAdsCredentials(user.id);
  if (!credentials?.loginCustomerId) {
    return buildGoogleAdsRedirect(request, "missing_login_customer_id");
  }

  const validation = validateGoogleAdsCredentialInput({
    clientId: credentials?.clientId || "",
    clientSecret: credentials?.clientSecret || "",
    developerToken: credentials?.developerToken || "",
    loginCustomerId: credentials?.loginCustomerId || ""
  });

  if (!validation.valid) {
    if (validation.message.includes("Developer Token")) {
      return buildGoogleAdsRedirect(request, "developer_token_invalid");
    }

    return buildGoogleAdsRedirect(request, "missing_google_ads_config");
  }

  const state = issueGoogleAdsOAuthState(user.id);
  const authUrl = getGoogleAdsAuthorizationUrlForClient(validation.normalizedInput.clientId, state);

  return attachGoogleAdsOAuthStateCookie(NextResponse.redirect(authUrl), state);
}
