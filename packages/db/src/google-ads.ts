import type { GoogleAdsAccountRecord, GoogleAdsCredentialStatus } from "@autocashback/domain";

import { decryptText, encryptText } from "./crypto";
import { ensureDatabaseReady } from "./schema";
import { getSql } from "./client";

type DbRow = Record<string, unknown>;

export type GoogleAdsCredentialInput = {
  clientId: string;
  clientSecret: string;
  developerToken: string;
  loginCustomerId: string;
};

export type GoogleAdsTokenUpdate = {
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: string | null;
};

export async function saveGoogleAdsCredentials(
  userId: number,
  input: GoogleAdsCredentialInput
) {
  await ensureDatabaseReady();
  const sql = getSql();
  const existing = await getGoogleAdsCredentials(userId);

  if (!existing) {
    await sql`
      INSERT INTO google_ads_credentials (
        user_id,
        client_id,
        client_secret,
        developer_token,
        login_customer_id,
        updated_at
      )
      VALUES (
        ${userId},
        ${encryptText(input.clientId)},
        ${encryptText(input.clientSecret)},
        ${encryptText(input.developerToken)},
        ${input.loginCustomerId},
        CURRENT_TIMESTAMP
      )
    `;

    return getGoogleAdsCredentialStatus(userId);
  }

  const credentialsChanged =
    existing.clientId !== input.clientId ||
    existing.clientSecret !== input.clientSecret ||
    existing.developerToken !== input.developerToken ||
    existing.loginCustomerId !== input.loginCustomerId;

  await sql`
    UPDATE google_ads_credentials
    SET client_id = ${encryptText(input.clientId)},
        client_secret = ${encryptText(input.clientSecret)},
        developer_token = ${encryptText(input.developerToken)},
        login_customer_id = ${input.loginCustomerId},
        updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ${userId}
  `;

  if (credentialsChanged) {
    await sql`
      UPDATE google_ads_credentials
      SET access_token = ${null},
          refresh_token = ${null},
          token_expires_at = ${null},
          last_verified_at = ${null},
          updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ${userId}
    `;

    await sql`
      DELETE FROM google_ads_accounts
      WHERE user_id = ${userId}
    `;
  }

  return getGoogleAdsCredentialStatus(userId);
}

export async function getGoogleAdsCredentials(userId: number) {
  await ensureDatabaseReady();
  const sql = getSql();
  const rows = await sql<DbRow[]>`
    SELECT *
    FROM google_ads_credentials
    WHERE user_id = ${userId}
    LIMIT 1
  `;

  if (!rows[0]) {
    return null;
  }

  return {
    userId,
    clientId: decryptText(String(rows[0].client_id || "")) || "",
    clientSecret: decryptText(String(rows[0].client_secret || "")) || "",
    developerToken: decryptText(String(rows[0].developer_token || "")) || "",
    loginCustomerId: rows[0].login_customer_id ? String(rows[0].login_customer_id) : "",
    accessToken: rows[0].access_token ? decryptText(String(rows[0].access_token)) : null,
    refreshToken: rows[0].refresh_token ? decryptText(String(rows[0].refresh_token)) : null,
    tokenExpiresAt: rows[0].token_expires_at ? String(rows[0].token_expires_at) : null,
    lastVerifiedAt: rows[0].last_verified_at ? String(rows[0].last_verified_at) : null
  };
}

export async function updateGoogleAdsTokens(userId: number, input: GoogleAdsTokenUpdate) {
  await ensureDatabaseReady();
  const sql = getSql();

  await sql`
    UPDATE google_ads_credentials
    SET access_token = ${encryptText(input.accessToken)},
        refresh_token = ${encryptText(input.refreshToken)},
        token_expires_at = ${input.tokenExpiresAt},
        updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ${userId}
  `;
}

export async function markGoogleAdsCredentialsVerified(userId: number) {
  await ensureDatabaseReady();
  const sql = getSql();

  await sql`
    UPDATE google_ads_credentials
    SET last_verified_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE user_id = ${userId}
  `;
}

export async function clearGoogleAdsCredentials(userId: number) {
  await ensureDatabaseReady();
  const sql = getSql();

  await sql`
    DELETE FROM google_ads_credentials
    WHERE user_id = ${userId}
  `;

  await sql`
    DELETE FROM google_ads_accounts
    WHERE user_id = ${userId}
  `;
}

export async function getGoogleAdsCredentialStatus(
  userId: number
): Promise<GoogleAdsCredentialStatus> {
  const credentials = await getGoogleAdsCredentials(userId);

  if (!credentials) {
    return {
      hasCredentials: false,
      hasRefreshToken: false,
      clientId: null,
      clientSecret: null,
      developerToken: null,
      loginCustomerId: null,
      tokenExpiresAt: null,
      lastVerifiedAt: null
    };
  }

  return {
    hasCredentials: Boolean(
      credentials.clientId &&
        credentials.clientSecret &&
        credentials.developerToken &&
        credentials.loginCustomerId
    ),
    hasRefreshToken: Boolean(credentials.refreshToken),
    clientId: credentials.clientId || null,
    clientSecret: credentials.clientSecret || null,
    developerToken: credentials.developerToken || null,
    loginCustomerId: credentials.loginCustomerId || null,
    tokenExpiresAt: credentials.tokenExpiresAt,
    lastVerifiedAt: credentials.lastVerifiedAt
  };
}

export async function replaceGoogleAdsAccounts(
  userId: number,
  accounts: Array<{
    customerId: string;
    descriptiveName: string | null;
    currencyCode: string | null;
    timeZone: string | null;
    manager: boolean;
    testAccount: boolean;
    status: string | null;
  }>
) {
  await ensureDatabaseReady();
  const sql = getSql();

  await sql`
    DELETE FROM google_ads_accounts
    WHERE user_id = ${userId}
  `;

  for (const account of accounts) {
    await sql`
      INSERT INTO google_ads_accounts (
        user_id,
        customer_id,
        descriptive_name,
        currency_code,
        time_zone,
        manager,
        test_account,
        status,
        last_sync_at,
        updated_at
      )
      VALUES (
        ${userId},
        ${account.customerId},
        ${account.descriptiveName},
        ${account.currencyCode},
        ${account.timeZone},
        ${account.manager},
        ${account.testAccount},
        ${account.status},
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
    `;
  }
}

export async function listGoogleAdsAccounts(userId: number): Promise<GoogleAdsAccountRecord[]> {
  await ensureDatabaseReady();
  const sql = getSql();
  const rows = await sql<DbRow[]>`
    SELECT *
    FROM google_ads_accounts
    WHERE user_id = ${userId}
    ORDER BY manager DESC, customer_id ASC
  `;

  return rows.map((row) => ({
    id: Number(row.id),
    userId: Number(row.user_id),
    customerId: String(row.customer_id),
    descriptiveName: row.descriptive_name ? String(row.descriptive_name) : null,
    currencyCode: row.currency_code ? String(row.currency_code) : null,
    timeZone: row.time_zone ? String(row.time_zone) : null,
    manager: Boolean(row.manager),
    testAccount: Boolean(row.test_account),
    status: row.status ? String(row.status) : null,
    lastSyncAt: row.last_sync_at ? String(row.last_sync_at) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  }));
}
