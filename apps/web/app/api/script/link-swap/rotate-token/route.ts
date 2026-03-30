import { NextResponse, type NextRequest } from "next/server";

import { rotateScriptToken } from "@autocashback/db";

import { getRequestUser } from "@/lib/api-auth";

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = await rotateScriptToken(user.id);
  return NextResponse.json({ token });
}
