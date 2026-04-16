import { NextResponse, type NextRequest } from "next/server";

import { getSettings, saveSettings } from "@autocashback/db";

import { getRequestUser } from "@/lib/api-auth";
import { serializeSettingForClient } from "@/lib/settings-client-serialization";

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const settings = await getSettings(user.id);
  return NextResponse.json({
    settings: settings.map(serializeSettingForClient)
  });
}

export async function PUT(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  await saveSettings(user.id, body.updates || []);
  return NextResponse.json({ success: true });
}
