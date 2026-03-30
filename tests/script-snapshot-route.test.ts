import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { getScriptSnapshot, getScriptTokenOwnerId, takeScriptSnapshotRateLimit } = vi.hoisted(() => ({
  getScriptSnapshot: vi.fn(),
  getScriptTokenOwnerId: vi.fn(),
  takeScriptSnapshotRateLimit: vi.fn()
}));

vi.mock("@autocashback/db", () => ({
  getScriptSnapshot,
  getScriptTokenOwnerId
}));

vi.mock("@/lib/script-snapshot-security", () => ({
  takeScriptSnapshotRateLimit
}));

import { GET } from "../apps/web/app/api/script/link-swap/snapshot/route";

describe("script snapshot route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    takeScriptSnapshotRateLimit.mockResolvedValue({
      allowed: true,
      limit: 120,
      remaining: 119,
      retryAfterSec: 60
    });
  });

  it("rejects requests without the header token", async () => {
    const request = new NextRequest(
      "https://www.autocashback.dev/api/script/link-swap/snapshot?token=legacy-query-token"
    );

    const response = await GET(request);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Missing token" });
    expect(getScriptTokenOwnerId).not.toHaveBeenCalled();
  });

  it("rejects invalid header tokens", async () => {
    getScriptTokenOwnerId.mockResolvedValue(null);
    const request = new NextRequest("https://www.autocashback.dev/api/script/link-swap/snapshot", {
      headers: {
        "x-script-token": "invalid-token"
      }
    });

    const response = await GET(request);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(getScriptTokenOwnerId).toHaveBeenCalledWith("invalid-token");
    expect(getScriptSnapshot).not.toHaveBeenCalled();
  });

  it("returns 429 when the request is rate limited", async () => {
    takeScriptSnapshotRateLimit.mockResolvedValue({
      allowed: false,
      limit: 120,
      remaining: 0,
      retryAfterSec: 18
    });
    const request = new NextRequest("https://www.autocashback.dev/api/script/link-swap/snapshot");

    const response = await GET(request);

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("18");
    await expect(response.json()).resolves.toEqual({ error: "Too Many Requests" });
    expect(getScriptTokenOwnerId).not.toHaveBeenCalled();
  });

  it("returns the owner id even when there are no tasks", async () => {
    getScriptTokenOwnerId.mockResolvedValue(42);
    getScriptSnapshot.mockResolvedValue([]);
    const request = new NextRequest("https://www.autocashback.dev/api/script/link-swap/snapshot", {
      headers: {
        "x-script-token": "valid-token"
      }
    });

    const response = await GET(request);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      userId: 42,
      tasks: []
    });
    expect(getScriptSnapshot).toHaveBeenCalledWith("valid-token", undefined);
  });

  it("maps task rows into the snapshot payload", async () => {
    getScriptTokenOwnerId.mockResolvedValue(99);
    getScriptSnapshot.mockResolvedValue([
      {
        task_id: 7,
        offer_id: 8,
        user_id: 99,
        brand_name: "Nike",
        campaign_label: "Campaign A",
        target_country: "US",
        latest_resolved_url: "https://example.com/final",
        latest_resolved_suffix: "aff_id=1",
        last_resolved_at: "2026-03-30T05:00:00.000Z"
      }
    ]);
    const request = new NextRequest(
      "https://www.autocashback.dev/api/script/link-swap/snapshot?campaignLabel=Campaign%20A",
      {
        headers: {
          "x-script-token": "valid-token"
        }
      }
    );

    const response = await GET(request);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      userId: 99,
      tasks: [
        {
          taskId: 7,
          offerId: 8,
          brandName: "Nike",
          campaignLabel: "Campaign A",
          targetCountry: "US",
          finalUrl: "https://example.com/final",
          finalUrlSuffix: "aff_id=1",
          updatedAt: "2026-03-30T05:00:00.000Z"
        }
      ]
    });
    expect(getScriptSnapshot).toHaveBeenCalledWith("valid-token", "Campaign A");
  });
});
