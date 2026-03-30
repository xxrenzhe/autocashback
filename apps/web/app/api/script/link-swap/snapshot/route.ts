import { NextResponse, type NextRequest } from "next/server";

import { getScriptSnapshot } from "@autocashback/db";

export async function GET(request: NextRequest) {
  const token = request.headers.get("x-script-token") || request.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 401 });
  }

  const campaignLabel = request.nextUrl.searchParams.get("campaignLabel") || undefined;
  const rows = await getScriptSnapshot(token, campaignLabel);

  if (!rows.length) {
    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      userId: null,
      tasks: []
    });
  }

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    userId: rows[0].user_id,
    tasks: rows.map((row) => ({
      taskId: row.task_id,
      offerId: row.offer_id,
      brandName: row.brand_name,
      campaignLabel: row.campaign_label,
      targetCountry: row.target_country,
      finalUrl: row.latest_resolved_url,
      finalUrlSuffix: row.latest_resolved_suffix,
      updatedAt: row.last_resolved_at
    }))
  });
}
