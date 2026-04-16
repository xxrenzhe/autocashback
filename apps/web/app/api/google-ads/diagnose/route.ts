import { NextRequest, NextResponse } from "next/server";
import { GoogleAdsApi } from "google-ads-api";

import { getGoogleAdsCredentials, logAuditEvent } from "@autocashback/db";

import { getRequestUser } from "@/lib/api-auth";
import { getRequestMetadata } from "@/lib/request-metadata";

export const dynamic = "force-dynamic";

type DiagnoseRequestBody = {
  probeCustomerId?: string;
  maxCustomers?: number;
};

function normalizeCustomerId(input: string) {
  return String(input || "").replace(/[\s-]/g, "");
}

function extractSearchResults(searchResult: unknown) {
  if (!searchResult) {
    return [];
  }
  if (Array.isArray(searchResult)) {
    return searchResult;
  }

  const result = searchResult as {
    results?: unknown[];
    response?: { results?: unknown[] };
  };

  if (Array.isArray(result.results)) {
    return result.results;
  }
  if (Array.isArray(result.response?.results)) {
    return result.response.results;
  }

  return [];
}

function classifyErrorMessage(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes("developer token is not allowed with project")) {
    return {
      code: "DEVELOPER_TOKEN_PROJECT_MISMATCH",
      hint: "Developer Token 与 OAuth Client 所属 GCP Project 不匹配"
    };
  }
  if (normalized.includes("developer_token_not_approved") || normalized.includes("not approved")) {
    return {
      code: "DEVELOPER_TOKEN_NOT_APPROVED",
      hint: "Developer Token 仍是测试权限，或尚未通过审核"
    };
  }
  if (normalized.includes("permission_denied")) {
    return {
      code: "PERMISSION_DENIED",
      hint: "当前 OAuth 或 MCC 对目标账号没有访问权限"
    };
  }
  if (normalized.includes("invalid_grant")) {
    return {
      code: "INVALID_GRANT",
      hint: "Refresh Token 已失效，需要重新授权"
    };
  }
  if (normalized.includes("invalid_client")) {
    return {
      code: "INVALID_CLIENT",
      hint: "Client ID / Client Secret 无效或不匹配"
    };
  }

  return { code: "UNKNOWN", hint: undefined };
}

async function queryCustomerBasicInfo(input: {
  client: GoogleAdsApi;
  refreshToken: string;
  customerId: string;
  loginCustomerId: string;
}) {
  const query = `
    SELECT
      customer.id,
      customer.descriptive_name,
      customer.manager,
      customer.test_account,
      customer.currency_code,
      customer.time_zone,
      customer.status
    FROM customer
    WHERE customer.id = ${input.customerId}
  `;

  const attempts: Array<string | null> = [
    input.loginCustomerId || null,
    input.customerId || null,
    null
  ];
  let lastError: unknown = null;

  for (const loginCustomerId of attempts) {
    try {
      const customer = loginCustomerId
        ? input.client.Customer({
            customer_id: input.customerId,
            refresh_token: input.refreshToken,
            login_customer_id: loginCustomerId
          })
        : input.client.Customer({
            customer_id: input.customerId,
            refresh_token: input.refreshToken
          });

      const rows = extractSearchResults(await customer.query(query)) as Array<{
        customer?: {
          descriptive_name?: string;
          manager?: boolean;
          test_account?: boolean;
          currency_code?: string;
          time_zone?: string;
          status?: string;
        };
      }>;

      return {
        usedLoginCustomerId: loginCustomerId,
        row: rows[0] || null
      };
    } catch (error) {
      lastError = error;
    }
  }

  const message = lastError instanceof Error ? lastError.message : String(lastError || "");
  const classified = classifyErrorMessage(message);

  return {
    usedLoginCustomerId: null,
    error: {
      message,
      code: classified.code,
      hint: classified.hint
    }
  };
}

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as DiagnoseRequestBody;
  const maxCustomers = Math.min(Math.max(Number(body.maxCustomers || 20), 1), 100);
  const probeCustomerId = body.probeCustomerId
    ? normalizeCustomerId(body.probeCustomerId)
    : undefined;

  try {
    const credentials = await getGoogleAdsCredentials(user.id);
    if (!credentials) {
      return NextResponse.json(
        {
          error: "未配置 Google Ads 凭证",
          code: "CREDENTIALS_NOT_CONFIGURED"
        },
        { status: 404 }
      );
    }
    if (!credentials.refreshToken) {
      return NextResponse.json(
        {
          error: "Google Ads 尚未完成 OAuth 授权",
          code: "REFRESH_TOKEN_MISSING"
        },
        { status: 400 }
      );
    }

    const client = new GoogleAdsApi({
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      developer_token: credentials.developerToken
    });

    const listResponse = await client.listAccessibleCustomers(credentials.refreshToken);
    const resourceNames = Array.isArray((listResponse as { resource_names?: string[] }).resource_names)
      ? (listResponse as { resource_names?: string[] }).resource_names || []
      : [];
    const accessibleCustomers = resourceNames
      .map((resourceName) => resourceName.split("/").pop() || "")
      .filter(Boolean);
    const sampledCustomers = accessibleCustomers.slice(0, maxCustomers);
    const customers = [];

    for (const customerId of sampledCustomers) {
      const result = await queryCustomerBasicInfo({
        client,
        refreshToken: credentials.refreshToken,
        customerId,
        loginCustomerId: credentials.loginCustomerId
      });

      if ("error" in result && result.error) {
        customers.push({
          customerId,
          ok: false,
          usedLoginCustomerId: result.usedLoginCustomerId,
          error: result.error
        });
        continue;
      }

      customers.push({
        customerId,
        ok: true,
        usedLoginCustomerId: result.usedLoginCustomerId,
        descriptiveName: result.row?.customer?.descriptive_name || null,
        manager: result.row?.customer?.manager ?? null,
        testAccount: result.row?.customer?.test_account ?? null,
        currencyCode: result.row?.customer?.currency_code || null,
        timeZone: result.row?.customer?.time_zone || null,
        status: result.row?.customer?.status || null
      });
    }

    let probe = null;
    if (probeCustomerId) {
      probe = await queryCustomerBasicInfo({
        client,
        refreshToken: credentials.refreshToken,
        customerId: probeCustomerId,
        loginCustomerId: credentials.loginCustomerId
      });
    }

    await logAuditEvent({
      userId: user.id,
      eventType: "sensitive_data_access",
      ...getRequestMetadata(request),
      details: {
        scope: "google_ads_diagnose",
        sampledCount: customers.length,
        probeCustomerId: probeCustomerId || null
      }
    });

    const okCount = customers.filter((item) => item.ok).length;
    const errorCount = customers.length - okCount;

    return NextResponse.json({
      success: true,
      data: {
        loginCustomerId: credentials.loginCustomerId,
        accessibleCustomers,
        sampledCount: customers.length,
        customers,
        probeCustomerId: probeCustomerId || null,
        probe,
        summary: {
          totalAccessible: accessibleCustomers.length,
          okCount,
          errorCount,
          testAccountTrue: customers.filter((item) => item.ok && item.testAccount === true).length,
          testAccountFalse: customers.filter((item) => item.ok && item.testAccount === false).length
        }
      }
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Google Ads 诊断失败";
    const classified = classifyErrorMessage(message);

    return NextResponse.json(
      {
        error: "Google Ads 诊断失败",
        message,
        code: classified.code,
        hint: classified.hint
      },
      { status: 500 }
    );
  }
}
