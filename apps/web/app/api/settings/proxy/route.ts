import { NextResponse, type NextRequest } from "next/server";

import { getProxyUrls } from "@autocashback/db";

import { getRequestUser } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const country = String(searchParams.get("country") || "")
    .trim()
    .toUpperCase();
  const proxyUrls = await getProxyUrls(user.id, country || undefined);

  return NextResponse.json({
    success: true,
    data: {
      country: country || null,
      proxy_url: proxyUrls[0] || null,
      proxy_urls: proxyUrls
    }
  });
}
