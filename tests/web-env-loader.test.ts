import path from "node:path";

import { describe, expect, it } from "vitest";

describe("web env loader", async () => {
  const { getEnvCandidates } = await import("../apps/web/env-loader.mjs");

  it("checks workspace env files before root env files", () => {
    const appDir = path.resolve("/tmp/autocashback/apps/web");
    const candidates = getEnvCandidates(appDir, "development");

    expect(candidates).toEqual([
      path.join(appDir, ".env.development.local"),
      path.join(appDir, ".env.local"),
      path.join(appDir, ".env.development"),
      path.join(appDir, ".env"),
      path.resolve(appDir, "../../.env.development.local"),
      path.resolve(appDir, "../../.env.local"),
      path.resolve(appDir, "../../.env.development"),
      path.resolve(appDir, "../../.env")
    ]);
  });
});
