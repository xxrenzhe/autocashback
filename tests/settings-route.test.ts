import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { getSettings } = vi.hoisted(() => ({
  getSettings: vi.fn(),
}));

const { getRequestUser } = vi.hoisted(() => ({
  getRequestUser: vi.fn()
}));

vi.mock("@autocashback/db", () => ({
  getSettings
}));

vi.mock("@/lib/api-auth", () => ({
  getRequestUser
}));

import { GET } from "../apps/web/app/api/settings/route";

describe("settings route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRequestUser.mockResolvedValue({ id: 7 });
  });

  it("redacts sensitive values for browser clients", async () => {
    getSettings.mockResolvedValue([
      {
        category: "proxy",
        key: "proxy_urls",
        value: "[\"http://proxy.example.com\"]",
        isSensitive: false
      },
      {
        category: "googleAds",
        key: "client_secret",
        value: "super-secret",
        isSensitive: true
      }
    ]);

    const response = await GET(new NextRequest("https://www.autocashback.dev/api/settings"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.settings).toEqual([
      {
        category: "proxy",
        key: "proxy_urls",
        value: "[\"http://proxy.example.com\"]",
        hasValue: true,
        isSensitive: false
      },
      {
        category: "googleAds",
        key: "client_secret",
        value: null,
        hasValue: true,
        isSensitive: true
      }
    ]);
  });
});
