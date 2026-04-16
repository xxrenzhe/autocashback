import path from "node:path";
import { tmpdir } from "node:os";
import { mkdtempSync, rmSync } from "node:fs";

import { afterAll, describe, expect, it } from "vitest";

import {
  clearGoogleAdsCredentials,
  closeDatabase,
  createClickFarmTask,
  createAccount,
  createOffer,
  createUser,
  deleteClickFarmTask,
  deleteOffer,
  disableLinkSwapTask,
  completeClickFarmTask,
  expireLinkSwapTask,
  enableLinkSwapTask,
  enqueueQueueTask,
  ensureDatabaseReady,
  getClickFarmTaskByOfferId,
  getGoogleAdsCredentialStatus,
  getScriptSnapshot,
  getSql,
  getDashboardSummary,
  getSettings,
  listLinkSwapTasks,
  restartClickFarmTask,
  setClickFarmTaskPaused,
  stopClickFarmTask,
  listUsers,
  saveGoogleAdsCredentials,
  saveSettings,
  scheduleLinkSwapTaskNow,
  updateClickFarmTask,
  updateLinkSwapTask
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

    await clearGoogleAdsCredentials(user.id);

    const downgradedTasks = await listLinkSwapTasks(user.id);
    expect(downgradedTasks[0]?.mode).toBe("script");
    expect(downgradedTasks[0]?.googleCustomerId).toBeNull();
    expect(downgradedTasks[0]?.googleCampaignId).toBeNull();

    const clearedCredentials = await getGoogleAdsCredentialStatus(user.id);
    expect(clearedCredentials.hasCredentials).toBe(false);
    expect(clearedCredentials.hasRefreshToken).toBe(false);

    const scriptToken = "script-token-for-test";
    await getSql()`
      INSERT INTO script_tokens (user_id, token)
      VALUES (${user.id}, ${scriptToken})
      ON CONFLICT (user_id) DO UPDATE SET token = EXCLUDED.token
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

  it("cleans pending queue tasks when link swap or click farm tasks are stopped or deleted", async () => {
    const user = await createUser({
      username: "sqlite-user-queue-cleanup",
      email: "sqlite-user-queue-cleanup@example.com",
      password: "password",
      role: "user"
    });

    const account = await createAccount(user.id, {
      platformCode: "topcashback",
      accountName: "Queue Cleanup Account",
      registerEmail: "sqlite-user-queue-cleanup@example.com",
      payoutMethod: "paypal",
      notes: "queue cleanup"
    });

    const offer = await createOffer(user.id, {
      platformCode: "topcashback",
      cashbackAccountId: account.id,
      promoLink: "https://example.com/queue-cleanup-offer",
      targetCountry: "US",
      brandName: "Brand Queue",
      campaignLabel: "Campaign Queue",
      commissionCapUsd: 100,
      manualRecordedCommissionUsd: 10
    });

    const [linkSwapTask] = await listLinkSwapTasks(user.id);
    expect(linkSwapTask).toBeTruthy();

    const clickFarmTask = await createClickFarmTask(user.id, {
      offerId: offer.id,
      dailyClickCount: 40,
      startTime: "06:00",
      endTime: "24:00",
      durationDays: 7,
      scheduledStartDate: "2026-04-16",
      hourlyDistribution: Array.from({ length: 24 }, (_, hour) => (hour >= 6 ? 2 : 0)),
      refererConfig: {
        type: "random"
      }
    });

    await enqueueQueueTask({
      id: `url-swap-cleanup-${linkSwapTask?.id}`,
      type: "url-swap",
      userId: user.id,
      payload: { linkSwapTaskId: linkSwapTask?.id }
    });
    await enqueueQueueTask({
      id: `click-farm-trigger-cleanup-${clickFarmTask.id}`,
      type: "click-farm-trigger",
      userId: user.id,
      payload: { clickFarmTaskId: clickFarmTask.id }
    });
    await enqueueQueueTask({
      id: `click-farm-batch-cleanup-${clickFarmTask.id}`,
      type: "click-farm-batch",
      userId: user.id,
      payload: { clickFarmTaskId: clickFarmTask.id }
    });
    await enqueueQueueTask({
      id: `click-farm-run-cleanup-${clickFarmTask.id}`,
      type: "click-farm",
      userId: user.id,
      payload: { clickFarmTaskId: clickFarmTask.id }
    });
    await enqueueQueueTask({
      id: `url-swap-cleanup-unrelated-${linkSwapTask?.id}`,
      type: "url-swap",
      userId: user.id,
      payload: { linkSwapTaskId: 999999 }
    });

    await disableLinkSwapTask(user.id, Number(linkSwapTask?.id));
    await stopClickFarmTask(user.id, clickFarmTask.id);

    let remainingQueueTasks = await getSql()<{
      id: string;
      type: string;
    }[]>`
      SELECT id, type
      FROM unified_queue_tasks
      WHERE user_id = ${user.id}
      ORDER BY id ASC
    `;

    expect(remainingQueueTasks.map((task) => task.id)).toEqual([
      `url-swap-cleanup-unrelated-${linkSwapTask?.id}`
    ]);

    await enqueueQueueTask({
      id: `click-farm-trigger-delete-${clickFarmTask.id}`,
      type: "click-farm-trigger",
      userId: user.id,
      payload: { clickFarmTaskId: clickFarmTask.id }
    });
    await enqueueQueueTask({
      id: `click-farm-run-delete-${clickFarmTask.id}`,
      type: "click-farm",
      userId: user.id,
      payload: { clickFarmTaskId: clickFarmTask.id }
    });

    const deleted = await deleteClickFarmTask(user.id, clickFarmTask.id);
    expect(deleted).toBe(true);

    remainingQueueTasks = await getSql()<{
      id: string;
      type: string;
    }[]>`
      SELECT id, type
      FROM unified_queue_tasks
      WHERE user_id = ${user.id}
      ORDER BY id ASC
    `;

    expect(remainingQueueTasks.map((task) => task.id)).toEqual([
      `url-swap-cleanup-unrelated-${linkSwapTask?.id}`
    ]);
  });

  it("cleans pending queue tasks before deleting an offer", async () => {
    const user = await createUser({
      username: "sqlite-user-offer-delete-cleanup",
      email: "sqlite-user-offer-delete-cleanup@example.com",
      password: "password",
      role: "user"
    });

    const account = await createAccount(user.id, {
      platformCode: "topcashback",
      accountName: "Offer Delete Cleanup Account",
      registerEmail: "sqlite-user-offer-delete-cleanup@example.com",
      payoutMethod: "paypal",
      notes: "offer cleanup"
    });

    const offer = await createOffer(user.id, {
      platformCode: "topcashback",
      cashbackAccountId: account.id,
      promoLink: "https://example.com/delete-offer-cleanup",
      targetCountry: "US",
      brandName: "Brand Delete",
      campaignLabel: "Campaign Delete",
      commissionCapUsd: 120,
      manualRecordedCommissionUsd: 15
    });

    const [linkSwapTask] = await listLinkSwapTasks(user.id);
    const clickFarmTask = await createClickFarmTask(user.id, {
      offerId: offer.id,
      dailyClickCount: 30,
      startTime: "06:00",
      endTime: "24:00",
      durationDays: 7,
      scheduledStartDate: "2026-04-16",
      hourlyDistribution: Array.from({ length: 24 }, (_, hour) => (hour >= 6 ? 1 : 0)),
      refererConfig: {
        type: "random"
      }
    });

    await enqueueQueueTask({
      id: `offer-delete-url-swap-${linkSwapTask?.id}`,
      type: "url-swap",
      userId: user.id,
      payload: { linkSwapTaskId: linkSwapTask?.id }
    });
    await enqueueQueueTask({
      id: `offer-delete-click-farm-${clickFarmTask.id}`,
      type: "click-farm-trigger",
      userId: user.id,
      payload: { clickFarmTaskId: clickFarmTask.id }
    });
    await enqueueQueueTask({
      id: `offer-delete-unrelated-${offer.id}`,
      type: "url-swap",
      userId: user.id,
      payload: { linkSwapTaskId: 888888 }
    });

    const deleted = await deleteOffer(user.id, offer.id);
    expect(deleted).toBe(true);

    const remainingQueueTasks = await getSql()<{
      id: string;
      type: string;
    }[]>`
      SELECT id, type
      FROM unified_queue_tasks
      WHERE user_id = ${user.id}
      ORDER BY id ASC
    `;

    expect(remainingQueueTasks.map((task) => task.id)).toEqual([
      `offer-delete-unrelated-${offer.id}`
    ]);
  });

  it("replaces stale pending queue tasks when tasks are rescheduled", async () => {
    const user = await createUser({
      username: "sqlite-user-reschedule-cleanup",
      email: "sqlite-user-reschedule-cleanup@example.com",
      password: "password",
      role: "user"
    });

    const account = await createAccount(user.id, {
      platformCode: "topcashback",
      accountName: "Reschedule Cleanup Account",
      registerEmail: "sqlite-user-reschedule-cleanup@example.com",
      payoutMethod: "paypal",
      notes: "reschedule cleanup"
    });

    const offer = await createOffer(user.id, {
      platformCode: "topcashback",
      cashbackAccountId: account.id,
      promoLink: "https://example.com/reschedule-cleanup",
      targetCountry: "US",
      brandName: "Brand Reschedule",
      campaignLabel: "Campaign Reschedule",
      commissionCapUsd: 99,
      manualRecordedCommissionUsd: 10
    });

    const [linkSwapTask] = await listLinkSwapTasks(user.id);
    expect(linkSwapTask).toBeTruthy();

    const clickFarmTask = await createClickFarmTask(user.id, {
      offerId: offer.id,
      dailyClickCount: 36,
      startTime: "06:00",
      endTime: "24:00",
      durationDays: 14,
      scheduledStartDate: "2026-04-16",
      hourlyDistribution: Array.from({ length: 24 }, (_, hour) => (hour >= 6 ? 2 : 0)),
      refererConfig: {
        type: "random"
      }
    });

    await enqueueQueueTask({
      id: `reschedule-url-swap-old-${linkSwapTask?.id}`,
      type: "url-swap",
      userId: user.id,
      payload: { linkSwapTaskId: linkSwapTask?.id }
    });
    await enqueueQueueTask({
      id: `reschedule-click-trigger-old-${clickFarmTask.id}`,
      type: "click-farm-trigger",
      userId: user.id,
      payload: { clickFarmTaskId: clickFarmTask.id }
    });
    await enqueueQueueTask({
      id: `reschedule-click-batch-old-${clickFarmTask.id}`,
      type: "click-farm-batch",
      userId: user.id,
      payload: { clickFarmTaskId: clickFarmTask.id }
    });

    await updateLinkSwapTask(user.id, offer.id, {
      enabled: true,
      intervalMinutes: 120,
      durationDays: 30,
      mode: "script",
      googleCustomerId: null,
      googleCampaignId: null
    });

    await updateClickFarmTask(user.id, clickFarmTask.id, {
      offerId: offer.id,
      dailyClickCount: 48,
      startTime: "07:00",
      endTime: "23:00",
      durationDays: 30,
      scheduledStartDate: "2026-04-17",
      hourlyDistribution: Array.from({ length: 24 }, (_, hour) => (hour >= 7 && hour <= 22 ? 3 : 0)),
      timezone: "America/New_York",
      refererConfig: {
        type: "specific",
        referer: "https://www.facebook.com/"
      }
    });

    let remainingQueueTasks = await getSql()<{
      id: string;
    }[]>`
      SELECT id
      FROM unified_queue_tasks
      WHERE user_id = ${user.id}
      ORDER BY id ASC
    `;

    expect(remainingQueueTasks).toHaveLength(0);

    await enqueueQueueTask({
      id: `reschedule-url-swap-enable-old-${linkSwapTask?.id}`,
      type: "url-swap",
      userId: user.id,
      payload: { linkSwapTaskId: linkSwapTask?.id }
    });
    await enqueueQueueTask({
      id: `reschedule-click-trigger-restart-old-${clickFarmTask.id}`,
      type: "click-farm-trigger",
      userId: user.id,
      payload: { clickFarmTaskId: clickFarmTask.id }
    });
    await enqueueQueueTask({
      id: `reschedule-click-run-restart-old-${clickFarmTask.id}`,
      type: "click-farm",
      userId: user.id,
      payload: { clickFarmTaskId: clickFarmTask.id }
    });

    await disableLinkSwapTask(user.id, Number(linkSwapTask?.id));
    await enableLinkSwapTask(user.id, Number(linkSwapTask?.id));
    await scheduleLinkSwapTaskNow(user.id, Number(linkSwapTask?.id));
    await stopClickFarmTask(user.id, clickFarmTask.id);
    await restartClickFarmTask(user.id, clickFarmTask.id);

    remainingQueueTasks = await getSql()<{
      id: string;
    }[]>`
      SELECT id
      FROM unified_queue_tasks
      WHERE user_id = ${user.id}
      ORDER BY id ASC
    `;

    expect(remainingQueueTasks).toHaveLength(0);
  });

  it("cleans pending queue tasks when tasks are auto-paused, auto-completed, or auto-expired", async () => {
    const user = await createUser({
      username: "sqlite-user-auto-cleanup",
      email: "sqlite-user-auto-cleanup@example.com",
      password: "password",
      role: "user"
    });

    const account = await createAccount(user.id, {
      platformCode: "topcashback",
      accountName: "Auto Cleanup Account",
      registerEmail: "sqlite-user-auto-cleanup@example.com",
      payoutMethod: "paypal",
      notes: "auto cleanup"
    });

    const offer = await createOffer(user.id, {
      platformCode: "topcashback",
      cashbackAccountId: account.id,
      promoLink: "https://example.com/auto-cleanup",
      targetCountry: "US",
      brandName: "Brand Auto Cleanup",
      campaignLabel: "Campaign Auto Cleanup",
      commissionCapUsd: 88,
      manualRecordedCommissionUsd: 12
    });

    const [linkSwapTask] = await listLinkSwapTasks(user.id);
    expect(linkSwapTask).toBeTruthy();

    const clickFarmTask = await createClickFarmTask(user.id, {
      offerId: offer.id,
      dailyClickCount: 24,
      startTime: "06:00",
      endTime: "24:00",
      durationDays: 7,
      scheduledStartDate: "2026-04-16",
      hourlyDistribution: Array.from({ length: 24 }, (_, hour) => (hour >= 6 ? 1 : 0)),
      refererConfig: {
        type: "random"
      }
    });

    await enqueueQueueTask({
      id: `auto-cleanup-click-pause-trigger-${clickFarmTask.id}`,
      type: "click-farm-trigger",
      userId: user.id,
      payload: { clickFarmTaskId: clickFarmTask.id }
    });
    await enqueueQueueTask({
      id: `auto-cleanup-click-pause-batch-${clickFarmTask.id}`,
      type: "click-farm-batch",
      userId: user.id,
      payload: { clickFarmTaskId: clickFarmTask.id }
    });
    await setClickFarmTaskPaused(clickFarmTask.id, "缺少 US 或 GLOBAL 代理");

    let remainingQueueTasks = await getSql()<{
      id: string;
    }[]>`
      SELECT id
      FROM unified_queue_tasks
      WHERE user_id = ${user.id}
      ORDER BY id ASC
    `;

    expect(remainingQueueTasks).toHaveLength(0);

    await enqueueQueueTask({
      id: `auto-cleanup-click-complete-trigger-${clickFarmTask.id}`,
      type: "click-farm-trigger",
      userId: user.id,
      payload: { clickFarmTaskId: clickFarmTask.id }
    });
    await enqueueQueueTask({
      id: `auto-cleanup-click-complete-run-${clickFarmTask.id}`,
      type: "click-farm",
      userId: user.id,
      payload: { clickFarmTaskId: clickFarmTask.id }
    });
    await completeClickFarmTask(clickFarmTask.id);

    remainingQueueTasks = await getSql()<{
      id: string;
    }[]>`
      SELECT id
      FROM unified_queue_tasks
      WHERE user_id = ${user.id}
      ORDER BY id ASC
    `;

    expect(remainingQueueTasks).toHaveLength(0);

    await enqueueQueueTask({
      id: `auto-cleanup-link-expire-${linkSwapTask?.id}`,
      type: "url-swap",
      userId: user.id,
      payload: { linkSwapTaskId: linkSwapTask?.id }
    });
    await expireLinkSwapTask(Number(linkSwapTask?.id));

    remainingQueueTasks = await getSql()<{
      id: string;
    }[]>`
      SELECT id
      FROM unified_queue_tasks
      WHERE user_id = ${user.id}
      ORDER BY id ASC
    `;

    expect(remainingQueueTasks).toHaveLength(0);
  });
});
