import { NextResponse } from "next/server";

import { getAuthCookieName, loginUser } from "@autocashback/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await loginUser(body.username, body.password);
    const response = NextResponse.json({ user: result.user });
    response.cookies.set(getAuthCookieName(), result.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7
    });

    return response;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "登录失败";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
