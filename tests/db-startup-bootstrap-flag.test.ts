import { afterEach, describe, expect, it } from "vitest";

import { ensureDatabaseReady, resetDatabaseReadyStateForTests } from "@autocashback/db";

const originalSkipRuntimeDbInit = process.env.SKIP_RUNTIME_DB_INIT;

afterEach(() => {
  resetDatabaseReadyStateForTests();

  if (originalSkipRuntimeDbInit === undefined) {
    delete process.env.SKIP_RUNTIME_DB_INIT;
  } else {
    process.env.SKIP_RUNTIME_DB_INIT = originalSkipRuntimeDbInit;
  }
});

describe("startup bootstrap skip flag", () => {
  it("short-circuits lazy database initialization after startup bootstrap", async () => {
    process.env.SKIP_RUNTIME_DB_INIT = "true";

    await expect(ensureDatabaseReady()).resolves.toBeUndefined();
  });
});
