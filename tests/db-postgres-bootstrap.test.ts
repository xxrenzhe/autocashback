import { beforeEach, describe, expect, it, vi } from "vitest";

const { postgresMock, sqlTag } = vi.hoisted(() => {
  const sqlTagMock = vi.fn() as ReturnType<typeof vi.fn> & {
    unsafe: ReturnType<typeof vi.fn>;
    end: ReturnType<typeof vi.fn>;
  };
  sqlTagMock.unsafe = vi.fn();
  sqlTagMock.end = vi.fn();

  const postgresModuleMock = vi.fn(() => sqlTagMock);

  return {
    postgresMock: postgresModuleMock,
    sqlTag: sqlTagMock
  };
});

vi.mock("postgres", () => ({
  default: postgresMock
}));

import { ensurePostgresDatabaseExists } from "../packages/db/src/postgres-bootstrap";

describe("postgres database bootstrap", () => {
  beforeEach(() => {
    postgresMock.mockClear();
    postgresMock.mockReturnValue(sqlTag);
    sqlTag.mockReset();
    sqlTag.unsafe.mockReset();
    sqlTag.end.mockReset();
    sqlTag.end.mockResolvedValue(undefined);
  });

  it("connects to the admin database and skips creation when the target exists", async () => {
    sqlTag.mockResolvedValueOnce([{ exists: true }]);

    await ensurePostgresDatabaseExists(
      "postgresql://postgres:password@127.0.0.1:5432/autocashback?sslmode=require"
    );

    expect(postgresMock).toHaveBeenCalledWith(
      "postgresql://postgres:password@127.0.0.1:5432/postgres?sslmode=require",
      expect.objectContaining({
        max: 1,
        idle_timeout: 5,
        prepare: false
      })
    );
    expect(sqlTag.unsafe).not.toHaveBeenCalled();
    expect(sqlTag.end).toHaveBeenCalledTimes(1);
  });

  it("creates the target database when it is missing", async () => {
    sqlTag.mockResolvedValueOnce([{ exists: false }]);
    sqlTag.unsafe.mockResolvedValueOnce([]);

    await ensurePostgresDatabaseExists(
      "postgresql://postgres:password@127.0.0.1:5432/cash-back"
    );

    expect(sqlTag.unsafe).toHaveBeenCalledWith('CREATE DATABASE "cash-back"');
    expect(sqlTag.end).toHaveBeenCalledTimes(1);
  });

  it("treats duplicate database creation as success", async () => {
    sqlTag.mockResolvedValueOnce([{ exists: false }]);
    sqlTag.unsafe.mockRejectedValueOnce({ code: "42P04" });

    await expect(
      ensurePostgresDatabaseExists("postgresql://postgres:password@127.0.0.1:5432/autocashback")
    ).resolves.toBeUndefined();

    expect(sqlTag.end).toHaveBeenCalledTimes(1);
  });
});
