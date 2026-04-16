import { NextResponse, type NextRequest } from "next/server";

import { getQueueStats } from "@autocashback/db";

import { getRequestUser } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stats = await getQueueStats();
  return NextResponse.json({ success: true, stats });
}
