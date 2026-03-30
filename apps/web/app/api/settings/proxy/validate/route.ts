import { NextResponse, type NextRequest } from "next/server";
import axios from "axios";
import { HttpsProxyAgent } from "https-proxy-agent";

import { getRequestUser } from "@/lib/api-auth";

function normalizeProxyUrl(raw: string) {
  const value = raw.trim();
  if (!value) {
    throw new Error("proxy_url 不能为空");
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  return `http://${value}`;
}

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const proxyUrl = normalizeProxyUrl(String(body.proxy_url || ""));
    const agent = new HttpsProxyAgent(proxyUrl);

    const response = await axios.get("https://httpbin.org/ip", {
      timeout: 15_000,
      httpsAgent: agent,
      httpAgent: agent,
      validateStatus: (status) => status >= 200 && status < 300
    });

    return NextResponse.json({
      success: true,
      message: "代理验证成功",
      data: {
        origin: response.data?.origin || null,
        normalizedProxyUrl: proxyUrl
      }
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "代理验证失败";
    return NextResponse.json(
      {
        success: false,
        error: message
      },
      { status: 400 }
    );
  }
}
