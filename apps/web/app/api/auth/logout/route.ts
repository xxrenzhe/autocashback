import { NextResponse } from "next/server";

import { getAuthCookieName } from "@autocashback/db";

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(getAuthCookieName(), "", {
    httpOnly: true,
    path: "/",
    maxAge: 0
  });
  return response;
}
