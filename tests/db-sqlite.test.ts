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
  getDueClickFarmTasks,
  getDueLinkSwapTasks,
  getGoogleAdsCredentialStatus,
  getScriptSnapshot,
  getSql,
  getDashboardSummary,
  getSettings,
  getUserSecurityAlertsByAdmin,
  loginUser,
  listLinkSwapTasks,
  listUserLoginHistoryByAdmin,
  restartClickFarmTask,
  setClickFarmTaskPaused,
  stopClickFarmTask,
  listUsers,
  logAuditEvent,
  saveGoogleAdsCredentials,
  saveSettings,
  scheduleLinkSwapTaskNow,
  updateGoogleAdsTokens,
  updateClickFarmTask,
  updateLinkSwapTask,
  updateUserByAdmin
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
    expect(credentials.hasClientId).toBe(true);
    expect(credentials.hasClientSecret).toBe(true);
    expect(credentials.hasDeveloperToken).toBe(true);
    expect(credentials.hasRefreshToken).toBe(false);

    await updateGoogleAdsTokens(user.id, {
      accessToken: "access-token",
      refreshToken: "refresh-token-value",
      tokenExpiresAt: "2026-04-16T12:00:00.000Z"
    });

    const authorizedCredentials = await getGoogleAdsCredentialStatus(user.id);
    expect(authorizedCredentials.hasRefreshToken).toBe(true);
    expect(authorizedCredentials.tokenExpiresAt).toBe("2026-04-16T12:00:00.000Z");

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
    expect(clearedCredentials.hasClientId).toBe(false);
    expect(clearedCredentials.hasClientSecret).toBe(false);
    expect(clearedCredentials.hasDeveloperToken).toBe(false);
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

    await getSql()`
      UPDATE click_farm_tasks
      SET progress = 42,
          total_clicks = 30,
          success_clicks = 24,
          failed_clicks = 6,
          daily_history = ${JSON.stringify([
            {
              date: "2026-04-16",
              target: 120,
              actual: 30,
              success: 24,
              failed: 6,
              hourlyBreakdown: Array.from({ length: 24 }, () => ({
                target: 5,
                actual: 1,
                success: 1,
                failed: 0
              }))
            }
          ])},
          started_at = ${"2026-04-16T01:00:00.000Z"},
          completed_at = ${"2026-04-16T02:00:00.000Z"}
      WHERE id = ${clickFarmTask.id}
    `;

    const recreatedTask = await createClickFarmTask(user.id, {
      offerId: offer.id,
      dailyClickCount: 180,
      startTime: "08:00",
      endTime: "24:00",
      durationDays: 21,
      scheduledStartDate: "2026-04-18",
      hourlyDistribution: Array.from({ length: 24 }, (_, hour) => (hour >= 8 ? 9 : 0)),
      refererConfig: {
        type: "specific",
        referer: "https://www.google.com/"
      }
    });

    expect(recreatedTask.id).toBe(clickFarmTask.id);
    expect(recreatedTask.dailyClickCount).toBe(180);
    expect(recreatedTask.progress).toBe(0);
    expect(recreatedTask.totalClicks).toBe(0);
    expect(recreatedTask.successClicks).toBe(0);
    expect(recreatedTask.failedClicks).toBe(0);
    expect(recreatedTask.startedAt).toBeNull();
    expect(recreatedTask.completedAt).toBeNull();
    expect(recreatedTask.dailyHistory).toHaveLength(1);
    expect(recreatedTask.dailyHistory[0]?.date).toBe("2026-04-18");
    expect(recreatedTask.dailyHistory[0]?.target).toBe(180);
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

  it("keeps future click-farm tasks out of immediate scheduling until their start date", async () => {
    const user = await createUser({
      username: "sqlite-user-future-click-farm",
      email: "sqlite-user-future-click-farm@example.com",
      password: "password",
      role: "user"
    });

    const account = await createAccount(user.id, {
      platformCode: "topcashback",
      accountName: "Future Click Farm Account",
      registerEmail: "sqlite-user-future-click-farm@example.com",
      payoutMethod: "paypal",
      notes: "future click farm"
    });

    const offer = await createOffer(user.id, {
      platformCode: "topcashback",
      cashbackAccountId: account.id,
      promoLink: "https://example.com/future-click-farm",
      targetCountry: "US",
      brandName: "Brand Future Click Farm",
      campaignLabel: "Campaign Future Click Farm",
      commissionCapUsd: 66,
      manualRecordedCommissionUsd: 10
    });

    const futureTask = await createClickFarmTask(user.id, {
      offerId: offer.id,
      dailyClickCount: 32,
      startTime: "08:00",
      endTime: "24:00",
      durationDays: 14,
      scheduledStartDate: "2099-04-16",
      hourlyDistribution: Array.from({ length: 24 }, (_, hour) => (hour >= 8 ? 2 : 0)),
      timezone: "America/New_York",
      refererConfig: {
        type: "random"
      }
    });

    expect(Date.parse(futureTask.nextRunAt || "")).toBeGreaterThan(Date.now());

    let dueTasks = await getDueClickFarmTasks();
    expect(dueTasks.some((task) => task.id === futureTask.id)).toBe(false);

    await getSql()`
      UPDATE click_farm_tasks
      SET started_at = CURRENT_TIMESTAMP
      WHERE id = ${futureTask.id}
    `;

    const restartedTask = await restartClickFarmTask(user.id, futureTask.id);
    expect(Date.parse(restartedTask.nextRunAt || "")).toBeGreaterThan(Date.now());

    dueTasks = await getDueClickFarmTasks();
    expect(dueTasks.some((task) => task.id === futureTask.id)).toBe(false);

    const updatedTask = await updateClickFarmTask(user.id, futureTask.id, {
      offerId: offer.id,
      dailyClickCount: 48,
      startTime: "09:00",
      endTime: "24:00",
      durationDays: 30,
      scheduledStartDate: "2099-05-01",
      hourlyDistribution: Array.from({ length: 24 }, (_, hour) => (hour >= 9 ? 3 : 0)),
      timezone: "America/New_York",
      refererConfig: {
        type: "specific",
        referer: "https://www.facebook.com/"
      }
    });

    expect(Date.parse(updatedTask.nextRunAt || "")).toBeGreaterThan(Date.now());
    dueTasks = await getDueClickFarmTasks();
    expect(dueTasks.some((task) => task.id === futureTask.id)).toBe(false);
  });

  it("keeps link-swap tasks out of orchestration until activation start and preserves next_run_at", async () => {
    const user = await createUser({
      username: "sqlite-user-future-link-swap",
      email: "sqlite-user-future-link-swap@example.com",
      password: "password",
      role: "user"
    });

    const account = await createAccount(user.id, {
      platformCode: "topcashback",
      accountName: "Future Link Swap Account",
      registerEmail: "sqlite-user-future-link-swap@example.com",
      payoutMethod: "paypal",
      notes: "future link swap"
    });

    const offer = await createOffer(user.id, {
      platformCode: "topcashback",
      cashbackAccountId: account.id,
      promoLink: "https://example.com/future-link-swap",
      targetCountry: "US",
      brandName: "Brand Future Link Swap",
      campaignLabel: "Campaign Future Link Swap",
      commissionCapUsd: 88,
      manualRecordedCommissionUsd: 12
    });

    const [task] = await listLinkSwapTasks(user.id);
    expect(task?.offerId).toBe(offer.id);

    await getSql()`
      UPDATE link_swap_tasks
      SET activation_started_at = ${"2099-04-16T00:00:00.000Z"},
          next_run_at = CURRENT_TIMESTAMP
      WHERE id = ${task?.id}
    `;

    let dueTasks = await getDueLinkSwapTasks();
    expect(dueTasks.some((row) => Number(row.id) === task?.id)).toBe(false);

    await getSql()`
      UPDATE link_swap_tasks
      SET activation_started_at = CURRENT_TIMESTAMP,
          next_run_at = ${"2099-04-16T01:02:03.000Z"}
      WHERE id = ${task?.id}
    `;

    dueTasks = await getDueLinkSwapTasks();
    const dueTask = dueTasks.find((row) => Number(row.id) === task?.id);
    expect(dueTask).toBeUndefined();

    await getSql()`
      UPDATE link_swap_tasks
      SET next_run_at = CURRENT_TIMESTAMP
      WHERE id = ${task?.id}
    `;

    dueTasks = await getDueLinkSwapTasks();
    const orchestratedTask = dueTasks.find((row) => Number(row.id) === task?.id);
    expect(orchestratedTask).toBeTruthy();
    expect(String(orchestratedTask?.next_run_at || "")).toBeTruthy();
  });

  it("tracks login failures, unlocks accounts, and revokes sessions when a user is disabled", async () => {
    const user = await createUser({
      username: "sqlite-user-security",
      email: "sqlite-user-security@example.com",
      password: "password",
      role: "user"
    });

    for (let attempt = 0; attempt < 4; attempt += 1) {
      await expect(loginUser(user.username, "wrong-password")).rejects.toThrow("用户名或密码错误");
    }

    let securityRows = await getSql()<{
      failed_login_count: number;
      locked_until: string | null;
      is_active: number | boolean;
    }[]>`
      SELECT failed_login_count, locked_until, is_active
      FROM users
      WHERE id = ${user.id}
    `;
    expect(Number(securityRows[0]?.failed_login_count || 0)).toBe(4);
    expect(securityRows[0]?.locked_until).toBeNull();

    await expect(loginUser(user.username, "wrong-password")).rejects.toThrow(
      "密码错误次数过多，账号已锁定 30 分钟"
    );

    securityRows = await getSql()<{
      failed_login_count: number;
      locked_until: string | null;
      is_active: number | boolean;
    }[]>`
      SELECT failed_login_count, locked_until, is_active
      FROM users
      WHERE id = ${user.id}
    `;
    expect(Number(securityRows[0]?.failed_login_count || 0)).toBe(5);
    expect(securityRows[0]?.locked_until).toBeTruthy();

    await updateUserByAdmin(user.id, { unlock: true });

    securityRows = await getSql()<{
      failed_login_count: number;
      locked_until: string | null;
      is_active: number | boolean;
    }[]>`
      SELECT failed_login_count, locked_until, is_active
      FROM users
      WHERE id = ${user.id}
    `;
    expect(Number(securityRows[0]?.failed_login_count || 0)).toBe(0);
    expect(securityRows[0]?.locked_until).toBeNull();

    await logAuditEvent({
      userId: user.id,
      eventType: "login_failed",
      ipAddress: "203.0.113.10",
      userAgent: "Mozilla/5.0 Chrome/124.0",
      details: { username: user.username }
    });
    await logAuditEvent({
      userId: user.id,
      eventType: "login_failed",
      ipAddress: "198.51.100.8",
      userAgent: "Mozilla/5.0 Safari/605.1.15",
      details: { username: user.username }
    });
    await logAuditEvent({
      userId: user.id,
      eventType: "login_failed",
      ipAddress: "198.51.100.9",
      userAgent: "Mozilla/5.0 Firefox/124.0",
      details: {
        username: user.username,
        failureReason: "密码错误次数过多，账号已锁定 30 分钟"
      }
    });

    const session = await loginUser(user.username, "password", {
      ipAddress: "203.0.113.10",
      userAgent: "Mozilla/5.0 Chrome/124.0"
    });
    expect(session.user.id).toBe(user.id);

    const secondSession = await loginUser(user.username, "password", {
      ipAddress: "198.51.100.8",
      userAgent: "Mozilla/5.0 Safari/605.1.15"
    });
    expect(secondSession.user.id).toBe(user.id);

    const alerts = await getUserSecurityAlertsByAdmin(user.id);
    expect(alerts.some((alert) => alert.category === "failed-login")).toBe(true);
    expect(alerts.some((alert) => alert.category === "active-session-spread")).toBe(true);
    expect(alerts.some((alert) => alert.category === "recent-ip-spread")).toBe(true);

    const loginHistory = await listUserLoginHistoryByAdmin(user.id, 10);
    expect(loginHistory.some((record) => record.eventType === "login_success")).toBe(true);
    expect(loginHistory.some((record) => record.eventType === "login_failed")).toBe(true);
    expect(loginHistory.some((record) => record.eventType === "account_locked")).toBe(true);

    const activeSessionsBeforeDisable = await getSql()<{
      count: number;
    }[]>`
      SELECT COUNT(*) AS count
      FROM user_sessions
      WHERE user_id = ${user.id}
        AND revoked_at IS NULL
    `;
    expect(Number(activeSessionsBeforeDisable[0]?.count || 0)).toBe(2);

    await updateUserByAdmin(user.id, { isActive: false });

    const activeSessionsAfterDisable = await getSql()<{
      count: number;
    }[]>`
      SELECT COUNT(*) AS count
      FROM user_sessions
      WHERE user_id = ${user.id}
        AND revoked_at IS NULL
    `;
    expect(Number(activeSessionsAfterDisable[0]?.count || 0)).toBe(0);

    await expect(loginUser(user.username, "password")).rejects.toThrow("账号已停用，请联系管理员");
  });
});
