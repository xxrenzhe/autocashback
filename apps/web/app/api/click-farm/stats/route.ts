import { NextResponse, type NextRequest } from "next/server";

import { getClickFarmStats } from "@autocashback/db";

import { getRequestUser } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    stats: await getClickFarmStats(user.id)
  });
}
