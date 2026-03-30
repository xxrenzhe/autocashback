import { NextResponse, type NextRequest } from "next/server";

import { DEFAULT_SCRIPT_TEMPLATE, renderScriptTemplate } from "@autocashback/domain";
import { getOrCreateScriptToken } from "@autocashback/db";

import { getRequestUser } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const token = await getOrCreateScriptToken(user.id);

  return NextResponse.json({
    token,
    template: renderScriptTemplate(DEFAULT_SCRIPT_TEMPLATE, {
      appUrl,
      scriptToken: token
    })
  });
}
