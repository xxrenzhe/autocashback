import { NextResponse, type NextRequest } from "next/server";

import {
  getGoogleAdsCredentialStatus,
  listGoogleAdsAccounts,
  syncGoogleAdsAccounts
} from "@autocashback/db";

import { getRequestUser } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const refresh = request.nextUrl.searchParams.get("refresh") === "true";

  try {
    if (refresh) {
      const credentials = await getGoogleAdsCredentialStatus(user.id);
      if (!credentials.hasRefreshToken) {
        return NextResponse.json({ error: "Google Ads 未完成 OAuth 授权" }, { status: 400 });
      }

      return NextResponse.json({
        accounts: await syncGoogleAdsAccounts(user.id)
      });
    }

    return NextResponse.json({
      accounts: await listGoogleAdsAccounts(user.id)
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Google Ads 账号同步失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
