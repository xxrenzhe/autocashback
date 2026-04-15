import { NextResponse, type NextRequest } from "next/server";

import { listGoogleAdsAccounts, syncGoogleAdsAccounts } from "@autocashback/db";

import { getRequestUser } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const refresh = request.nextUrl.searchParams.get("refresh") === "true";

  try {
    const accounts = refresh
      ? await syncGoogleAdsAccounts(user.id)
      : await listGoogleAdsAccounts(user.id);

    if (!accounts.length && !refresh) {
      return NextResponse.json({
        accounts: await syncGoogleAdsAccounts(user.id)
      });
    }

    return NextResponse.json({ accounts });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Google Ads 账号同步失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
