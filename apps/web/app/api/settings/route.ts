import { NextResponse, type NextRequest } from "next/server";

import { getSettings, logAuditEvent, saveSettings } from "@autocashback/db";

import { getRequestUser } from "@/lib/api-auth";
import { getRequestMetadata } from "@/lib/request-metadata";
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
  await logAuditEvent({
    userId: user.id,
    eventType: "configuration_changed",
    ...getRequestMetadata(request),
    details: {
      scope: "settings",
      updateCount: Array.isArray(body.updates) ? body.updates.length : 0,
      keys: Array.isArray(body.updates)
        ? body.updates
            .slice(0, 20)
            .map((item: { category?: unknown; key?: unknown }) => `${item.category}.${item.key}`)
        : []
    }
  });
  return NextResponse.json({ success: true });
}
