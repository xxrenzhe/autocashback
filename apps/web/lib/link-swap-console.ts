import type { LinkSwapRunRecord, LinkSwapTaskRecord, OfferRecord } from "@autocashback/domain";

export type LinkSwapConsoleStatus = "running" | "paused" | "warning" | "error";

export type LinkSwapConsoleStats = {
  totalTasks: number;
  runningTasks: number;
  pausedTasks: number;
  warningTasks: number;
  apiModeTasks: number;
  recentSuccessRate: number;
};

export type LinkSwapConsoleRow = {
  task: LinkSwapTaskRecord;
  offer: OfferRecord | null;
  latestRun: LinkSwapRunRecord | null;
  recentSuccessCount: number;
  recentFailureCount: number;
  recentRunCount: number;
  statusGroup: LinkSwapConsoleStatus;
  searchText: string;
};

function resolveStatusGroup(task: LinkSwapTaskRecord): LinkSwapConsoleStatus {
  if (task.status === "error") {
    return "error";
  }

  if (task.status === "warning" || task.consecutiveFailures > 0) {
    return "warning";
  }

  if (!task.enabled || task.status === "idle") {
    return "paused";
  }

  return "running";
}

export function buildLinkSwapConsole(
  tasks: LinkSwapTaskRecord[],
  offers: OfferRecord[],
  runs: LinkSwapRunRecord[]
): {
  stats: LinkSwapConsoleStats;
  rows: LinkSwapConsoleRow[];
} {
  const offersMap = new Map(offers.map((offer) => [offer.id, offer]));
  const runsByTaskId = new Map<number, LinkSwapRunRecord[]>();

  for (const run of runs) {
    const entries = runsByTaskId.get(run.taskId) || [];
    entries.push(run);
    runsByTaskId.set(run.taskId, entries);
  }

  const rows = tasks.map((task) => {
    const offer = offersMap.get(task.offerId) || null;
    const taskRuns = runsByTaskId.get(task.id) || [];
    const latestRun = taskRuns[0] || null;
    const recentSuccessCount = taskRuns.filter((run) => run.status === "success").length;
    const recentFailureCount = taskRuns.filter((run) => run.status === "failed").length;
    const statusGroup = resolveStatusGroup(task);

    return {
      task,
      offer,
      latestRun,
      recentSuccessCount,
      recentFailureCount,
      recentRunCount: taskRuns.length,
      statusGroup,
      searchText: [
        String(task.id),
        String(task.offerId),
        task.mode,
        task.googleCustomerId || "",
        task.googleCampaignId || "",
        offer?.brandName || "",
        offer?.campaignLabel || "",
        offer?.targetCountry || ""
      ]
        .join(" ")
        .toLowerCase()
    } satisfies LinkSwapConsoleRow;
  });

  const totalRunCount = runs.length;
  const successRunCount = runs.filter((run) => run.status === "success").length;

  return {
    stats: {
      totalTasks: rows.length,
      runningTasks: rows.filter((row) => row.statusGroup === "running").length,
      pausedTasks: rows.filter((row) => row.statusGroup === "paused").length,
      warningTasks: rows.filter(
        (row) => row.statusGroup === "warning" || row.statusGroup === "error"
      ).length,
      apiModeTasks: rows.filter((row) => row.task.mode === "google_ads_api").length,
      recentSuccessRate:
        totalRunCount > 0 ? Math.round((successRunCount / totalRunCount) * 100) : 0
    },
    rows
  };
}
