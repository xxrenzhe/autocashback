import { NextResponse, type NextRequest } from "next/server";

import {
  getGoogleAdsAuthorizationUrlForClient,
  getGoogleAdsCredentials
} from "@autocashback/db";

import { getRequestUser } from "@/lib/api-auth";

function encodeState(input: { userId: number; timestamp: number }) {
  return Buffer.from(JSON.stringify(input)).toString("base64url");
}

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const credentials = await getGoogleAdsCredentials(user.id);
  if (!credentials?.clientId || !credentials.clientSecret || !credentials.developerToken) {
    return NextResponse.redirect(
      new URL("/settings?googleAdsError=missing_config", request.url)
    );
  }

  const authUrl = getGoogleAdsAuthorizationUrlForClient(
    credentials.clientId,
    encodeState({
      userId: user.id,
      timestamp: Date.now()
    })
  );

  return NextResponse.redirect(authUrl);
}
