import { NextResponse, type NextRequest } from "next/server";

import {
  getDashboardSummary,
  getGoogleAdsCredentialStatus,
  listAccounts,
  listLinkSwapRuns
} from "@autocashback/db";

import { getRequestUser } from "@/lib/api-auth";
import { buildDashboardConsoleData } from "@/lib/dashboard-summary";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [summary, accounts, runs, credentials] = await Promise.all([
    getDashboardSummary(user.id),
    listAccounts(user.id),
    listLinkSwapRuns(user.id),
    getGoogleAdsCredentialStatus(user.id)
  ]);

  const recentSuccessfulRuns = runs.filter((run) => run.status === "success").length;
  const recentFailedRuns = runs.filter((run) => run.status === "failed").length;

  return NextResponse.json(
    buildDashboardConsoleData({
      overview: {
        ...summary,
        activeAccounts: accounts.filter((account) => account.status === "active").length,
        hasGoogleAdsCredentials: credentials.hasCredentials,
        recentSuccessfulRuns,
        recentFailedRuns,
        latestRunAt: runs[0]?.createdAt ?? null
      },
      actions: [],
      risks: [],
      recentRuns: runs.map((run) => ({
        id: run.id,
        offerId: run.offerId,
        status: run.status,
        createdAt: run.createdAt,
        resolvedSuffix: run.resolvedSuffix,
        errorMessage: run.errorMessage
      }))
    })
  );
}
