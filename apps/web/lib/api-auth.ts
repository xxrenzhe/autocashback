import type { NextRequest } from "next/server";

import { getAuthCookieName, getUserById, verifySessionToken } from "@autocashback/db";

export async function getRequestAuth(request: NextRequest) {
  const token = request.cookies.get(getAuthCookieName())?.value || null;
  if (!token) {
    return {
      token: null,
      session: null,
      user: null
    };
  }

  const session = await verifySessionToken(token);
  if (!session) {
    return {
      token: null,
      session: null,
      user: null
    };
  }

  return {
    token,
    session,
    user: await getUserById(session.userId)
  };
}

export async function getRequestUser(request: NextRequest) {
  return (await getRequestAuth(request)).user;
}
