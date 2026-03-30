import { NextResponse, type NextRequest } from "next/server";

import { DEFAULT_SCRIPT_TEMPLATE } from "@autocashback/domain";
import { getOrCreateScriptToken } from "@autocashback/db";

import { getRequestUser } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = await getOrCreateScriptToken(user.id);
  return NextResponse.json({
    token,
    template: DEFAULT_SCRIPT_TEMPLATE
      .replace("https://www.autocashback.dev", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000")
      .replace("replace-me", token)
  });
}
