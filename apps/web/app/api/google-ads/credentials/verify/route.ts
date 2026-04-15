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
    return NextResponse.json({
      success: result.valid,
      accountCount: result.accountCount
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Google Ads 配置验证失败";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
