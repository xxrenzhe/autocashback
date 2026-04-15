import { GoogleAdsApi } from "google-ads-api";
import type { GoogleAdsAccountRecord } from "@autocashback/domain";

import { getServerEnv } from "./env";
import {
  getGoogleAdsCredentials,
  listGoogleAdsAccounts,
  markGoogleAdsCredentialsVerified,
  replaceGoogleAdsAccounts,
  updateGoogleAdsTokens
} from "./google-ads";

type GoogleAdsTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope?: string;
};

function normalizeCustomerId(value: string | null | undefined) {
  return String(value || "").replaceAll("-", "").trim();
}

function sanitizeFinalUrlSuffix(value: string) {
  return String(value || "").trim().replace(/^\?+/, "");
}

function createGoogleAdsApiClient(credentials: {
  clientId: string;
  clientSecret: string;
  developerToken: string;
}) {
  return new GoogleAdsApi({
    client_id: credentials.clientId,
    client_secret: credentials.clientSecret,
    developer_token: credentials.developerToken
  });
}

function getGoogleAdsRedirectUri() {
  const env = getServerEnv();
  return `${env.NEXT_PUBLIC_APP_URL}/api/auth/google-ads/callback`;
}

export function getGoogleAdsAuthorizationUrlForClient(clientId: string, state: string) {
  const redirectUri = getGoogleAdsRedirectUri();
  const scopes = "https://www.googleapis.com/auth/adwords";
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    scope: scopes,
    state
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeGoogleAdsCodeForTokens(input: {
  code: string;
  clientId: string;
  clientSecret: string;
}) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      code: input.code,
      client_id: input.clientId,
      client_secret: input.clientSecret,
      redirect_uri: getGoogleAdsRedirectUri(),
      grant_type: "authorization_code"
    })
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return (await response.json()) as GoogleAdsTokenResponse;
}

export async function ensureGoogleAdsAccessToken(userId: number) {
  const credentials = await getGoogleAdsCredentials(userId);
  if (!credentials) {
    throw new Error("Google Ads 凭证不存在");
  }

  if (!credentials.refreshToken) {
    throw new Error("Google Ads 未完成 OAuth 授权");
  }

  const expiresAt = credentials.tokenExpiresAt ? Date.parse(credentials.tokenExpiresAt) : NaN;
  if (credentials.accessToken && Number.isFinite(expiresAt) && expiresAt - Date.now() > 300_000) {
    return credentials.accessToken;
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      refresh_token: credentials.refreshToken,
      grant_type: "refresh_token"
    })
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const payload = (await response.json()) as GoogleAdsTokenResponse;
  const tokenExpiresAt = new Date(Date.now() + payload.expires_in * 1000).toISOString();

  await updateGoogleAdsTokens(userId, {
    accessToken: payload.access_token,
    refreshToken: credentials.refreshToken,
    tokenExpiresAt
  });

  return payload.access_token;
}

export async function syncGoogleAdsAccounts(userId: number): Promise<GoogleAdsAccountRecord[]> {
  const credentials = await getGoogleAdsCredentials(userId);
  if (!credentials) {
    throw new Error("Google Ads 凭证不存在");
  }

  if (!credentials.clientId || !credentials.clientSecret || !credentials.developerToken) {
    throw new Error("Google Ads 基础配置不完整");
  }

  if (!credentials.refreshToken) {
    throw new Error("Google Ads 未完成 OAuth 授权");
  }

  const client = createGoogleAdsApiClient({
    clientId: credentials.clientId,
    clientSecret: credentials.clientSecret,
    developerToken: credentials.developerToken
  });

  const response = await client.listAccessibleCustomers(credentials.refreshToken);
  const resourceNames = Array.isArray((response as { resource_names?: string[] }).resource_names)
    ? (response as { resource_names?: string[] }).resource_names || []
    : [];

  const accounts: Array<{
    customerId: string;
    descriptiveName: string | null;
    currencyCode: string | null;
    timeZone: string | null;
    manager: boolean;
    testAccount: boolean;
    status: string | null;
  }> = [];

  for (const resourceName of resourceNames) {
    const customerId = normalizeCustomerId(resourceName.split("/").pop());
    if (!customerId) {
      continue;
    }

    try {
      const customer = client.Customer({
        customer_id: customerId,
        refresh_token: credentials.refreshToken,
        login_customer_id: normalizeCustomerId(credentials.loginCustomerId) || undefined
      });

      const rows = (await customer.query(`
        SELECT
          customer.id,
          customer.descriptive_name,
          customer.currency_code,
          customer.time_zone,
          customer.manager,
          customer.test_account,
          customer.status
        FROM customer
        LIMIT 1
      `)) as Array<Record<string, unknown>>;

      const row = rows[0] as
        | {
            customer?: {
              id?: string;
              descriptive_name?: string;
              currency_code?: string;
              time_zone?: string;
              manager?: boolean;
              test_account?: boolean;
              status?: string;
            };
          }
        | undefined;

      accounts.push({
        customerId,
        descriptiveName: row?.customer?.descriptive_name || null,
        currencyCode: row?.customer?.currency_code || null,
        timeZone: row?.customer?.time_zone || null,
        manager: Boolean(row?.customer?.manager),
        testAccount: Boolean(row?.customer?.test_account),
        status: row?.customer?.status || null
      });
    } catch {
      accounts.push({
        customerId,
        descriptiveName: null,
        currencyCode: null,
        timeZone: null,
        manager: false,
        testAccount: false,
        status: null
      });
    }
  }

  await replaceGoogleAdsAccounts(userId, accounts);
  await markGoogleAdsCredentialsVerified(userId);
  return listGoogleAdsAccounts(userId);
}

export async function verifyGoogleAdsAccess(userId: number) {
  const accounts = await syncGoogleAdsAccounts(userId);

  return {
    valid: accounts.length > 0,
    accountCount: accounts.length
  };
}

export async function updateGoogleAdsCampaignSuffix(input: {
  userId: number;
  customerId: string;
  campaignId: string;
  finalUrlSuffix: string;
}) {
  const credentials = await getGoogleAdsCredentials(input.userId);
  if (!credentials) {
    throw new Error("Google Ads 凭证不存在");
  }

  if (!credentials.clientId || !credentials.clientSecret || !credentials.developerToken) {
    throw new Error("Google Ads 基础配置不完整");
  }

  if (!credentials.refreshToken) {
    throw new Error("Google Ads 未完成 OAuth 授权");
  }

  await ensureGoogleAdsAccessToken(input.userId);

  const client = createGoogleAdsApiClient({
    clientId: credentials.clientId,
    clientSecret: credentials.clientSecret,
    developerToken: credentials.developerToken
  });

  const customerId = normalizeCustomerId(input.customerId);
  const campaignId = normalizeCustomerId(input.campaignId);
  const customer = client.Customer({
    customer_id: customerId,
    refresh_token: credentials.refreshToken,
    login_customer_id: normalizeCustomerId(credentials.loginCustomerId) || undefined
  });

  await customer.campaigns.update([
    {
      resource_name: `customers/${customerId}/campaigns/${campaignId}`,
      final_url_suffix: sanitizeFinalUrlSuffix(input.finalUrlSuffix)
    }
  ]);
}
