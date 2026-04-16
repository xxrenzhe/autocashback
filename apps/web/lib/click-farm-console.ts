import type { ClickFarmTask, OfferRecord } from "@autocashback/domain";

export type ClickFarmConsoleSort =
  | "recent"
  | "success-rate"
  | "daily-clicks"
  | "progress";

export type ClickFarmConsoleFilters = {
  search: string;
  status: ClickFarmTask["status"] | "all";
  country: string;
  sort: ClickFarmConsoleSort;
};

export type ClickFarmConsoleRow = {
  task: ClickFarmTask;
  offer: OfferRecord | null;
  brandName: string;
  country: string;
  successRate: number | null;
  progressPercent: number;
  isPaused: boolean;
  needsAttention: boolean;
  nextRunMissing: boolean;
};

export type ClickFarmConsoleOverview = {
  totalTasks: number;
  activeTasks: number;
  pausedTasks: number;
  warningTasks: number;
  totalClicks: number;
  averageSuccessRate: number;
};

export type ClickFarmConsoleData = {
  overview: ClickFarmConsoleOverview;
  rows: ClickFarmConsoleRow[];
  countryOptions: string[];
};

function isPausedStatus(status: ClickFarmTask["status"]) {
  return status === "paused" || status === "stopped";
}

function isActiveStatus(status: ClickFarmTask["status"]) {
  return status === "pending" || status === "running";
}

function compareNullableNumbers(
  left: number | null,
  right: number | null,
  direction: "asc" | "desc"
) {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return direction === "asc" ? left - right : right - left;
}

export function buildClickFarmConsole(
  tasks: ClickFarmTask[],
  offers: OfferRecord[],
  filters: ClickFarmConsoleFilters
): ClickFarmConsoleData {
  const offerMap = new Map(offers.map((offer) => [offer.id, offer]));
  const search = filters.search.trim().toLowerCase();

  const rows = tasks.map<ClickFarmConsoleRow>((task) => {
    const offer = offerMap.get(task.offerId) || null;
    const country = offer?.targetCountry || "";
    const brandName = offer?.brandName || `Offer #${task.offerId}`;
    const successRate =
      task.totalClicks > 0 ? Number((task.successClicks / task.totalClicks).toFixed(4)) : null;
    const progressPercent =
      task.durationDays === -1
        ? Math.min(100, Math.max(0, task.progress || 0))
        : Math.min(100, Math.max(0, task.progress || 0));
    const nextRunMissing = isActiveStatus(task.status) && !task.nextRunAt;
    const needsAttention = Boolean(
      isPausedStatus(task.status) ||
        task.pauseReason ||
        nextRunMissing ||
        (successRate !== null && task.totalClicks >= 20 && successRate < 0.8)
    );

    return {
      task,
      offer,
      brandName,
      country,
      successRate,
      progressPercent,
      isPaused: isPausedStatus(task.status),
      needsAttention,
      nextRunMissing
    };
  });

  const filteredRows = rows.filter((row) => {
    if (filters.status !== "all" && row.task.status !== filters.status) {
      return false;
    }

    if (filters.country !== "all" && row.country !== filters.country) {
      return false;
    }

    if (!search) {
      return true;
    }

    const searchableText = [
      row.brandName,
      row.country,
      row.offer?.campaignLabel || "",
      row.offer?.promoLink || "",
      row.task.timezone,
      row.task.status,
      String(row.task.offerId),
      String(row.task.id)
    ]
      .join(" ")
      .toLowerCase();

    return searchableText.includes(search);
  });

  filteredRows.sort((left, right) => {
    switch (filters.sort) {
      case "success-rate":
        return (
          compareNullableNumbers(left.successRate, right.successRate, "asc") ||
          Date.parse(right.task.createdAt) - Date.parse(left.task.createdAt)
        );
      case "daily-clicks":
        return (
          right.task.dailyClickCount - left.task.dailyClickCount ||
          Date.parse(right.task.createdAt) - Date.parse(left.task.createdAt)
        );
      case "progress":
        return (
          right.progressPercent - left.progressPercent ||
          Date.parse(right.task.createdAt) - Date.parse(left.task.createdAt)
        );
      case "recent":
      default:
        return (
          Date.parse(right.task.createdAt) - Date.parse(left.task.createdAt) ||
          right.task.id - left.task.id
        );
    }
  });

  const countryOptions = Array.from(
    new Set(rows.map((row) => row.country).filter((value) => value.trim().length > 0))
  ).sort((left, right) => left.localeCompare(right, "en"));

  const activeRows = rows.filter((row) => isActiveStatus(row.task.status));
  const rateSamples = rows
    .map((row) => row.successRate)
    .filter((value): value is number => value !== null);
  const averageSuccessRate =
    rateSamples.length > 0
      ? Number(
          ((rateSamples.reduce((sum, value) => sum + value, 0) / rateSamples.length) * 100).toFixed(1)
        )
      : 0;

  return {
    overview: {
      totalTasks: rows.length,
      activeTasks: activeRows.length,
      pausedTasks: rows.filter((row) => row.isPaused).length,
      warningTasks: rows.filter((row) => row.needsAttention).length,
      totalClicks: rows.reduce((sum, row) => sum + row.task.totalClicks, 0),
      averageSuccessRate
    },
    rows: filteredRows,
    countryOptions
  };
}
