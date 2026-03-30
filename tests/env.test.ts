import { describe, expect, it } from "vitest";

import { getServerEnv } from "@autocashback/db";

describe("getServerEnv", () => {
  it("parses the minimum production variables", () => {
    const env = getServerEnv({
      DATABASE_URL: "postgresql://postgres:password@127.0.0.1:5432/autocashback",
      REDIS_URL: "redis://127.0.0.1:6379",
      JWT_SECRET: "12345678901234567890123456789012",
      ENCRYPTION_KEY: "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      NEXT_PUBLIC_APP_URL: "https://www.autocashback.dev",
      INTERNAL_APP_URL: "http://127.0.0.1:3000",
      NODE_ENV: "production",
      TZ: "Asia/Shanghai",
      DEFAULT_ADMIN_PASSWORD: "password"
    });

    expect(env.NODE_ENV).toBe("production");
    expect(env.NEXT_PUBLIC_APP_URL).toBe("https://www.autocashback.dev");
  });
});
