import { NextResponse, type NextRequest } from "next/server";

import {
  clearGoogleAdsCredentials,
  getGoogleAdsCredentialStatus,
  saveGoogleAdsCredentials
} from "@autocashback/db";

import { getRequestUser } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    credentials: await getGoogleAdsCredentialStatus(user.id)
  });
}

export async function PUT(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const clientId = String(body.clientId || "").trim();
  const clientSecret = String(body.clientSecret || "").trim();
  const developerToken = String(body.developerToken || "").trim();
  const loginCustomerId = String(body.loginCustomerId || "").trim();

  if (!clientId || !clientSecret || !developerToken || !loginCustomerId) {
    return NextResponse.json({ error: "Google Ads 配置不完整" }, { status: 400 });
  }

  const credentials = await saveGoogleAdsCredentials(user.id, {
    clientId,
    clientSecret,
    developerToken,
    loginCustomerId
  });

  return NextResponse.json({ credentials });
}

export async function DELETE(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await clearGoogleAdsCredentials(user.id);
  return NextResponse.json({ success: true });
}
