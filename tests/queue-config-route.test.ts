import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  getQueueSystemConfigState,
  saveQueueSystemConfig
} = vi.hoisted(() => ({
  getQueueSystemConfigState: vi.fn(),
  saveQueueSystemConfig: vi.fn()
}));

const { getRequestUser } = vi.hoisted(() => ({
  getRequestUser: vi.fn()
}));

vi.mock("@autocashback/db", () => ({
  getQueueSystemConfigState,
  saveQueueSystemConfig
}));

vi.mock("@/lib/api-auth", () => ({
  getRequestUser
}));

import { GET, PUT } from "../apps/web/app/api/queue/config/route";

describe("queue config route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRequestUser.mockResolvedValue({ id: 1, role: "admin" });
    getQueueSystemConfigState.mockResolvedValue({
      config: {
        globalConcurrency: 12,
        pollIntervalMs: 250,
        staleTimeoutMs: 900000,
        perTypeConcurrency: {
          "click-farm-trigger": 2,
          "click-farm-batch": 2,
          "click-farm": 8,
          "url-swap": 2
        }
      },
      source: "database"
    });
    saveQueueSystemConfig.mockResolvedValue({
      globalConcurrency: 20,
      pollIntervalMs: 500,
      staleTimeoutMs: 1200000,
      perTypeConcurrency: {
        "click-farm-trigger": 3,
        "click-farm-batch": 4,
        "click-farm": 16,
        "url-swap": 2
      }
    });
  });

  it("returns queue config", async () => {
    const response = await GET(new NextRequest("https://www.autocashback.dev/api/queue/config"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.config.globalConcurrency).toBe(12);
    expect(payload.configSource).toBe("database");
  });

  it("rejects non-admin reads", async () => {
    getRequestUser.mockResolvedValue({ id: 2, role: "user" });

    const response = await GET(new NextRequest("https://www.autocashback.dev/api/queue/config"));
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.error).toBe("Forbidden");
    expect(getQueueSystemConfigState).not.toHaveBeenCalled();
  });

  it("rejects non-admin updates", async () => {
    getRequestUser.mockResolvedValue({ id: 2, role: "user" });

    const response = await PUT(
      new NextRequest("https://www.autocashback.dev/api/queue/config", {
        method: "PUT",
        body: JSON.stringify({ globalConcurrency: 20 }),
        headers: {
          "Content-Type": "application/json"
        }
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.error).toBe("Forbidden");
    expect(saveQueueSystemConfig).not.toHaveBeenCalled();
  });

  it("saves queue config updates", async () => {
    const response = await PUT(
      new NextRequest("https://www.autocashback.dev/api/queue/config", {
        method: "PUT",
        body: JSON.stringify({
          globalConcurrency: 20,
          pollIntervalMs: 500,
          staleTimeoutMs: 1200000,
          perTypeConcurrency: {
            "click-farm-trigger": 3,
            "click-farm-batch": 4,
            "click-farm": 16
          }
        }),
        headers: {
          "Content-Type": "application/json"
        }
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(saveQueueSystemConfig).toHaveBeenCalledWith({
      globalConcurrency: 20,
      pollIntervalMs: 500,
      staleTimeoutMs: 1200000,
      perTypeConcurrency: {
        "click-farm-trigger": 3,
        "click-farm-batch": 4,
        "click-farm": 16
      }
    });
    expect(payload.success).toBe(true);
    expect(payload.message).toContain("60 秒内自动应用");
  });
});
