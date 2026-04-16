import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { verifyGoogleAdsAccess } = vi.hoisted(() => ({
  verifyGoogleAdsAccess: vi.fn()
}));

const { getRequestUser } = vi.hoisted(() => ({
  getRequestUser: vi.fn()
}));

vi.mock("@autocashback/db", () => ({
  verifyGoogleAdsAccess
}));

vi.mock("@/lib/api-auth", () => ({
  getRequestUser
}));

import { POST } from "../apps/web/app/api/google-ads/credentials/verify/route";

describe("google ads verify route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRequestUser.mockResolvedValue({ id: 11 });
  });

  it("returns account count when verification succeeds", async () => {
    verifyGoogleAdsAccess.mockResolvedValue({
      valid: true,
      accountCount: 3
    });

    const response = await POST(
      new NextRequest("https://www.autocashback.dev/api/google-ads/credentials/verify", {
        method: "POST"
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.accountCount).toBe(3);
  });

  it("returns 400 when oauth user has no accessible accounts", async () => {
    verifyGoogleAdsAccess.mockResolvedValue({
      valid: false,
      accountCount: 0
    });

    const response = await POST(
      new NextRequest("https://www.autocashback.dev/api/google-ads/credentials/verify", {
        method: "POST"
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toContain("没有可访问的 Google Ads 客户号");
  });

  it("returns 401 when unauthenticated", async () => {
    getRequestUser.mockResolvedValue(null);

    const response = await POST(
      new NextRequest("https://www.autocashback.dev/api/google-ads/credentials/verify", {
        method: "POST"
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error).toBe("Unauthorized");
  });
});
