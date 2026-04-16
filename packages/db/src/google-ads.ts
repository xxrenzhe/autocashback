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

export type GoogleAdsCredentialValidationResult =
  | {
      valid: true;
      normalizedInput: GoogleAdsCredentialInput;
    }
  | {
      valid: false;
      message: string;
    };

export type GoogleAdsTokenUpdate = {
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: string | null;
};

function looksLikeOAuthClientId(value: string) {
  return value.includes(".apps.googleusercontent.com");
}

function looksLikeOAuthClientSecret(value: string) {
  return /^GOCSPX[-_]?/i.test(value.trim());
}

function looksLikeOAuthAccessToken(value: string) {
  return /^ya29\./i.test(value.trim());
}

export function normalizeGoogleAdsCredentialInput(
  input: GoogleAdsCredentialInput
): GoogleAdsCredentialInput {
  return {
    clientId: String(input.clientId || "").trim(),
    clientSecret: String(input.clientSecret || "").trim(),
    developerToken: String(input.developerToken || "").trim(),
    loginCustomerId: String(input.loginCustomerId || "")
      .replaceAll("-", "")
      .replace(/\s+/g, "")
      .trim()
  };
}

export function validateGoogleAdsCredentialInput(
  input: GoogleAdsCredentialInput
): GoogleAdsCredentialValidationResult {
  const normalizedInput = normalizeGoogleAdsCredentialInput(input);

  if (
    !normalizedInput.clientId ||
    !normalizedInput.clientSecret ||
    !normalizedInput.developerToken ||
    !normalizedInput.loginCustomerId
  ) {
    return {
      valid: false,
      message: "Google Ads 配置不完整"
    };
  }

  if (!looksLikeOAuthClientId(normalizedInput.clientId)) {
    return {
      valid: false,
      message: "Client ID 格式不正确，应包含 .apps.googleusercontent.com"
    };
  }

  if (normalizedInput.clientSecret.length < 20) {
    return {
      valid: false,
      message: "Client Secret 格式不正确，长度过短"
    };
  }

  if (normalizedInput.developerToken === normalizedInput.clientSecret) {
    return {
      valid: false,
      message:
        "Developer Token 与 Client Secret 相同，疑似误填。Developer Token 需从 Google Ads API Center 获取。"
    };
  }

  if (looksLikeOAuthClientId(normalizedInput.developerToken)) {
    return {
      valid: false,
      message:
        "Developer Token 看起来像 Client ID（包含 .apps.googleusercontent.com），请填写 Google Ads Developer Token。"
    };
  }

  if (looksLikeOAuthClientSecret(normalizedInput.developerToken)) {
    return {
      valid: false,
      message:
        "Developer Token 看起来像 Client Secret（以 GOCSPX- 开头），请在 Google Ads API Center 获取正确的 Developer Token。"
    };
  }

  if (looksLikeOAuthAccessToken(normalizedInput.developerToken)) {
    return {
      valid: false,
      message:
        "Developer Token 看起来像 Access Token（以 ya29. 开头），请填写 Google Ads Developer Token。"
    };
  }

  if (normalizedInput.developerToken.length < 20) {
    return {
      valid: false,
      message: "Developer Token 格式不正确，长度过短"
    };
  }

  if (!/^\d{10}$/.test(normalizedInput.loginCustomerId)) {
    return {
      valid: false,
      message: "Login Customer ID 格式不正确，应为 10 位数字"
    };
  }

  return {
    valid: true,
    normalizedInput
  };
}

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
    UPDATE link_swap_tasks
    SET mode = ${"script"},
        google_customer_id = ${null},
        google_campaign_id = ${null}
    WHERE user_id = ${userId}
      AND mode = ${"google_ads_api"}
  `;

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
      hasClientId: false,
      hasClientSecret: false,
      hasDeveloperToken: false,
      hasRefreshToken: false,
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
    hasClientId: Boolean(credentials.clientId),
    hasClientSecret: Boolean(credentials.clientSecret),
    hasDeveloperToken: Boolean(credentials.developerToken),
    hasRefreshToken: Boolean(credentials.refreshToken),
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
