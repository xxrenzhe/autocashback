import { NextResponse, type NextRequest } from "next/server";

import { verifyGoogleAdsAccess } from "@autocashback/db";

import { getRequestUser } from "@/lib/api-auth";

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await verifyGoogleAdsAccess(user.id);
    if (!result.valid) {
      return NextResponse.json(
        {
          error: "Google Ads 验证失败，当前 OAuth 账号下没有可访问的 Google Ads 客户号"
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      accountCount: result.accountCount
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Google Ads 配置验证失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
