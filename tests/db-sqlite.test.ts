import path from "node:path";
import { tmpdir } from "node:os";
import { mkdtempSync, rmSync } from "node:fs";

import { afterAll, describe, expect, it } from "vitest";

import {
  closeDatabase,
  createAccount,
  createOffer,
  createUser,
  ensureDatabaseReady,
  getDashboardSummary,
  getSettings,
  listLinkSwapTasks,
  listUsers,
  saveSettings
} from "@autocashback/db";

const tempDir = mkdtempSync(path.join(tmpdir(), "autocashback-db-"));
const databasePath = path.join(tempDir, "autocashback.sqlite");

delete process.env.DATABASE_URL;
Object.assign(process.env, {
  DATABASE_PATH: databasePath,
  REDIS_URL: "redis://127.0.0.1:6379",
  JWT_SECRET: "12345678901234567890123456789012",
  ENCRYPTION_KEY: "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  INTERNAL_APP_URL: "http://127.0.0.1:3000",
  NODE_ENV: "development",
  TZ: "Asia/Shanghai",
  DEFAULT_ADMIN_PASSWORD: "password"
});

afterAll(async () => {
  await closeDatabase();
  rmSync(tempDir, { recursive: true, force: true });
});

describe.sequential("sqlite database bootstrap", () => {
  it("creates the schema and seeds the default admin", async () => {
    await ensureDatabaseReady();

    const users = await listUsers();
    expect(users.some((user) => user.role === "admin")).toBe(true);

    const settings = await getSettings(null, "linkSwap");
    expect(settings.find((item) => item.key === "script_template")?.value).toContain(
      "function main()"
    );
  });

  it("supports the core sqlite CRUD flow", async () => {
    const user = await createUser({
      username: "sqlite-user",
      email: "sqlite-user@example.com",
      password: "password",
      role: "user"
    });

    const account = await createAccount(user.id, {
      platformCode: "topcashback",
      accountName: "Main Cashback Account",
      registerEmail: "sqlite-user@example.com",
      payoutMethod: "paypal",
      notes: "test account"
    });

    const offer = await createOffer(user.id, {
      platformCode: "topcashback",
      cashbackAccountId: account.id,
      promoLink: "https://example.com/offer",
      targetCountry: "US",
      brandName: "Brand A",
      campaignLabel: "Campaign A",
      commissionCapUsd: 120,
      manualRecordedCommissionUsd: 20
    });

    expect(offer.status).toBe("active");

    const tasks = await listLinkSwapTasks(user.id);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]?.offerId).toBe(offer.id);
    expect(tasks[0]?.enabled).toBe(true);

    const summary = await getDashboardSummary(user.id);
    expect(summary).toEqual({
      activeOffers: 1,
      activeTasks: 1,
      successRate: 0,
      warningOffers: 0
    });
  });

  it("updates global settings idempotently when userId is null", async () => {
    await saveSettings(null, [
      {
        category: "proxy",
        key: "global_proxy_test",
        value: "https://proxy-1.example.com"
      }
    ]);

    await saveSettings(null, [
      {
        category: "proxy",
        key: "global_proxy_test",
        value: "https://proxy-2.example.com"
      }
    ]);

    const settings = await getSettings(null, "proxy");
    const matches = settings.filter((item) => item.key === "global_proxy_test");

    expect(matches).toHaveLength(1);
    expect(matches[0]?.value).toBe("https://proxy-2.example.com");
  });
});
