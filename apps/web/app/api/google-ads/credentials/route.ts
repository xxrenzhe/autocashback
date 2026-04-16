import { NextResponse, type NextRequest } from "next/server";

import {
  clearGoogleAdsCredentials,
  getGoogleAdsCredentialStatus,
  saveGoogleAdsCredentials,
  validateGoogleAdsCredentialInput
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
  const validation = validateGoogleAdsCredentialInput({
    clientId: String(body.clientId || ""),
    clientSecret: String(body.clientSecret || ""),
    developerToken: String(body.developerToken || ""),
    loginCustomerId: String(body.loginCustomerId || "")
  });

  if (!validation.valid) {
    return NextResponse.json({ error: validation.message }, { status: 400 });
  }

  const credentials = await saveGoogleAdsCredentials(user.id, validation.normalizedInput);

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
