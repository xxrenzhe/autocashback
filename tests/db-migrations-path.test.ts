import path from "node:path";

import { describe, expect, it } from "vitest";

import { resolveMigrationsDir } from "../packages/db/src/migrations";

describe("migration directory resolution", () => {
  const repoRoot = process.cwd();

  it("finds postgres migrations when running from the web workspace", () => {
    expect(resolveMigrationsDir("postgres", path.join(repoRoot, "apps/web"))).toBe(
      path.join(repoRoot, "pg-migrations")
    );
  });

  it("finds sqlite migrations when running from a nested package directory", () => {
    expect(resolveMigrationsDir("sqlite", path.join(repoRoot, "packages/db/src"))).toBe(
      path.join(repoRoot, "migrations")
    );
  });

  it("throws when the search path does not contain migrations", () => {
    expect(() => resolveMigrationsDir("postgres", "/tmp/autocashback-no-migrations")).toThrow(
      "Migration directory not found"
    );
  });
});
