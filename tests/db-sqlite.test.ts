import path from "node:path";
import { tmpdir } from "node:os";
import { mkdtempSync, rmSync } from "node:fs";

import { afterAll, describe, expect, it } from "vitest";

import {
  closeDatabase,
  createClickFarmTask,
  createAccount,
  createOffer,
  createUser,
  ensureDatabaseReady,
  getClickFarmTaskByOfferId,
  getGoogleAdsCredentialStatus,
  getScriptSnapshot,
  getSql,
  getDashboardSummary,
  getSettings,
  listLinkSwapTasks,
  listUsers,
  saveGoogleAdsCredentials,
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

    const migrations = await getSql()<{
      migration_name: string;
      file_hash: string | null;
    }[]>`
      SELECT migration_name, file_hash
      FROM migration_history
      ORDER BY migration_name ASC
    `;
    expect(migrations.some((row) => row.migration_name === "000_init_schema_consolidated.sqlite.sql"))
      .toBe(true);
    expect(
      migrations.find((row) => row.migration_name === "000_init_schema_consolidated.sqlite.sql")
        ?.file_hash
    ).toBeTruthy();

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

  it("supports Google Ads credentials, click-farm tasks, and script-only snapshots", async () => {
    const user = await createUser({
      username: "sqlite-user-advanced",
      email: "sqlite-user-advanced@example.com",
      password: "password",
      role: "user"
    });

    const account = await createAccount(user.id, {
      platformCode: "topcashback",
      accountName: "Advanced Cashback Account",
      registerEmail: "sqlite-user-advanced@example.com",
      payoutMethod: "paypal",
      notes: "advanced test account"
    });

    const offer = await createOffer(user.id, {
      platformCode: "topcashback",
      cashbackAccountId: account.id,
      promoLink: "https://example.com/advanced-offer",
      targetCountry: "US",
      brandName: "Brand B",
      campaignLabel: "Campaign B",
      commissionCapUsd: 180,
      manualRecordedCommissionUsd: 10
    });

    await saveGoogleAdsCredentials(user.id, {
      clientId: "client-id",
      clientSecret: "client-secret",
      developerToken: "developer-token",
      loginCustomerId: "1234567890"
    });

    const credentials = await getGoogleAdsCredentialStatus(user.id);
    expect(credentials.hasCredentials).toBe(true);
    expect(credentials.hasRefreshToken).toBe(false);

    const [task] = await listLinkSwapTasks(user.id);
    expect(task).toBeTruthy();

    await getSql()`
      UPDATE link_swap_tasks
      SET mode = ${"google_ads_api"},
          google_customer_id = ${"1111111111"},
          google_campaign_id = ${"2222222222"},
          duration_days = ${14}
      WHERE id = ${task?.id || 0}
    `;

    const updatedTasks = await listLinkSwapTasks(user.id);
    expect(updatedTasks[0]?.mode).toBe("google_ads_api");
    expect(updatedTasks[0]?.googleCustomerId).toBe("1111111111");
    expect(updatedTasks[0]?.googleCampaignId).toBe("2222222222");

    const scriptToken = "script-token-for-test";
    await getSql()`
      INSERT INTO script_tokens (user_id, token)
      VALUES (${user.id}, ${scriptToken})
      ON CONFLICT (user_id) DO UPDATE SET token = EXCLUDED.token
    `;

    expect(await getScriptSnapshot(scriptToken)).toHaveLength(0);

    await getSql()`
      UPDATE link_swap_tasks
      SET mode = ${"script"}
      WHERE id = ${task?.id || 0}
    `;

    const scriptSnapshot = await getScriptSnapshot(scriptToken);
    expect(scriptSnapshot).toHaveLength(1);

    const clickFarmTask = await createClickFarmTask(user.id, {
      offerId: offer.id,
      dailyClickCount: 120,
      startTime: "06:00",
      endTime: "24:00",
      durationDays: 14,
      scheduledStartDate: "2026-04-16",
      hourlyDistribution: Array.from({ length: 24 }, (_, hour) => (hour >= 6 ? 6 : 0)),
      refererConfig: {
        type: "random"
      }
    });

    expect(clickFarmTask.offerId).toBe(offer.id);
    expect(clickFarmTask.status).toBe("pending");
    expect(clickFarmTask.timezone).toBe("America/New_York");

    const storedClickFarmTask = await getClickFarmTaskByOfferId(user.id, offer.id);
    expect(storedClickFarmTask?.id).toBe(clickFarmTask.id);
    expect(storedClickFarmTask?.refererConfig?.type).toBe("random");
  });
});
