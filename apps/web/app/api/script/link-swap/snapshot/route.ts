import { NextResponse, type NextRequest } from "next/server";

import { getScriptSnapshot, getScriptTokenOwnerId } from "@autocashback/db";

import { takeScriptSnapshotRateLimit } from "@/lib/script-snapshot-security";

export async function GET(request: NextRequest) {
  const rateLimit = await takeScriptSnapshotRateLimit(request);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too Many Requests" },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfterSec)
        }
      }
    );
  }

  const token = request.headers.get("x-script-token");
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 401 });
  }

  const ownerId = await getScriptTokenOwnerId(token);
  if (!ownerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const campaignLabel = request.nextUrl.searchParams.get("campaignLabel") || undefined;
  const rows = await getScriptSnapshot(token, campaignLabel);

  if (!rows.length) {
    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      userId: ownerId,
      tasks: []
    });
  }

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    userId: ownerId,
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
