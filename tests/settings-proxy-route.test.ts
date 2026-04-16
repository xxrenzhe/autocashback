import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { getProxyUrls } = vi.hoisted(() => ({
  getProxyUrls: vi.fn()
}));

const { getRequestUser } = vi.hoisted(() => ({
  getRequestUser: vi.fn()
}));

vi.mock("@autocashback/db", () => ({
  getProxyUrls
}));

vi.mock("@/lib/api-auth", () => ({
  getRequestUser
}));

import { GET } from "../apps/web/app/api/settings/proxy/route";

describe("settings proxy route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRequestUser.mockResolvedValue({ id: 11 });
  });

  it("returns autobb-compatible proxy payload for the requested country", async () => {
    getProxyUrls.mockResolvedValue(["http://us-proxy.example.com:8080", "http://global-proxy:8080"]);

    const request = new NextRequest("https://www.autocashback.dev/api/settings/proxy?country=us");
    const response = await GET(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(getProxyUrls).toHaveBeenCalledWith(11, "US");
    expect(payload.success).toBe(true);
    expect(payload.data.proxy_url).toBe("http://us-proxy.example.com:8080");
    expect(payload.data.proxy_urls).toHaveLength(2);
  });
});
