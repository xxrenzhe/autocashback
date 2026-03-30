import type { NextRequest } from "next/server";

import { getAuthCookieName, getCurrentUser } from "@autocashback/db";

export async function getRequestUser(request: NextRequest) {
  const token = request.cookies.get(getAuthCookieName())?.value;
  return getCurrentUser(token);
}
