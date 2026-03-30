import { NextResponse, type NextRequest } from "next/server";

import { listLinkSwapTasks, updateLinkSwapTask } from "@autocashback/db";

import { getRequestUser } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ tasks: await listLinkSwapTasks(user.id) });
}

export async function PUT(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const task = await updateLinkSwapTask(user.id, body.offerId, {
    enabled: body.enabled,
    intervalMinutes: body.intervalMinutes
  });

  return NextResponse.json({ task });
}
