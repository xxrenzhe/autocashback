import { beforeEach, describe, expect, it, vi } from "vitest";

const { unsafeMock, ensureDatabaseReadyMock } = vi.hoisted(() => ({
  unsafeMock: vi.fn(),
  ensureDatabaseReadyMock: vi.fn()
}));

vi.mock("../packages/db/src/client", () => ({
  getDbType: vi.fn(() => "postgres"),
  getSql: vi.fn(() => ({
    unsafe: unsafeMock
  }))
}));

vi.mock("../packages/db/src/schema", () => ({
  ensureDatabaseReady: ensureDatabaseReadyMock
}));

vi.mock("../packages/db/src/crypto", () => ({
  decryptText: vi.fn((value: string | null) => value),
  encryptText: vi.fn((value: string) => value)
}));

vi.mock("../packages/db/src/queue-cleanup", () => ({
  removePendingClickFarmQueueTasksByTaskIds: vi.fn(),
  removePendingLinkSwapQueueTasksByTaskIds: vi.fn()
}));

import { getSettings } from "../packages/db/src/operations";

describe("getSettings query construction", () => {
  beforeEach(() => {
    unsafeMock.mockReset();
    ensureDatabaseReadyMock.mockReset();
    ensureDatabaseReadyMock.mockResolvedValue(undefined);
    unsafeMock.mockResolvedValue([]);
  });

  it("avoids untyped IS NULL checks when filtering by category", async () => {
    await getSettings(null, "queue");

    expect(ensureDatabaseReadyMock).toHaveBeenCalledTimes(1);
    expect(unsafeMock).toHaveBeenCalledTimes(1);

    const [query, params] = unsafeMock.mock.calls[0] as [string, unknown[]];

    expect(query).toContain("WHERE user_id IS NULL");
    expect(query).toContain("AND category = ?");
    expect(query).not.toContain("? IS NULL");
    expect(params).toEqual(["queue"]);
  });

  it("keeps global fallback rows when loading user scoped settings", async () => {
    await getSettings(42);

    expect(unsafeMock).toHaveBeenCalledTimes(1);

    const [query, params] = unsafeMock.mock.calls[0] as [string, unknown[]];

    expect(query).toContain("WHERE (user_id = ? OR user_id IS NULL)");
    expect(query).not.toContain("category = ?");
    expect(params).toEqual([42]);
  });
});
