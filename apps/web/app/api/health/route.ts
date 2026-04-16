import { NextResponse } from "next/server";

import { ensureDatabaseReady, getQueueSchedulerHeartbeat, getQueueStats } from "@autocashback/db";

function getSchedulerHealth(heartbeatAt: string | null) {
  if (!heartbeatAt) {
    return "missing";
  }

  const timestamp = Date.parse(heartbeatAt);
  if (!Number.isFinite(timestamp)) {
    return "invalid";
  }

  const ageMs = Date.now() - timestamp;
  if (ageMs <= 3 * 60_000) {
    return "ok";
  }
  if (ageMs <= 15 * 60_000) {
    return "stale";
  }
  return "timeout";
}

export async function GET() {
  try {
    await ensureDatabaseReady();
    const [queueStats, heartbeat] = await Promise.all([getQueueStats(), getQueueSchedulerHeartbeat()]);
    const scheduler = getSchedulerHealth(heartbeat.heartbeatAt);
    const healthy = scheduler === "ok" || scheduler === "stale";

    return NextResponse.json(
      {
        status: healthy ? "healthy" : "unhealthy",
        timestamp: new Date().toISOString(),
        checks: {
          database: "ok",
          scheduler,
          queue: {
            pending: queueStats.pending,
            running: queueStats.running,
            failed: queueStats.failed
          }
        }
      },
      { status: healthy ? 200 : 503 }
    );
  } catch (error: unknown) {
    return NextResponse.json(
      {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "health check failed"
      },
      { status: 503 }
    );
  }
}
