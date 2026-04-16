"use client";

import { useEffect } from "react";

function sendJson(url: string, payload: Record<string, unknown>) {
  const body = JSON.stringify(payload);

  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    const blob = new Blob([body], { type: "application/json" });
    navigator.sendBeacon(url, blob);
    return;
  }

  void fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body,
    keepalive: true
  });
}

export function FrontendMonitoringReporter() {
  useEffect(() => {
    let latestLcp: { id?: string; value: number; rating: string } | null = null;
    let clsValue = 0;
    let flushed = false;

    const path = window.location.pathname;
    const now = () => Date.now();

    const flushVitals = () => {
      if (flushed) {
        return;
      }
      flushed = true;

      const navigationEntry = performance.getEntriesByType("navigation")[0] as
        | PerformanceNavigationTiming
        | undefined;
      if (navigationEntry) {
        sendJson("/api/monitoring/web-vitals", {
          name: "TTFB",
          value: navigationEntry.responseStart,
          delta: navigationEntry.responseStart,
          rating: navigationEntry.responseStart < 800 ? "good" : "needs-improvement",
          path,
          timestamp: now()
        });
      }

      const fcpEntry = performance
        .getEntriesByType("paint")
        .find((entry) => entry.name === "first-contentful-paint");
      if (fcpEntry) {
        sendJson("/api/monitoring/web-vitals", {
          name: "FCP",
          value: fcpEntry.startTime,
          delta: fcpEntry.startTime,
          rating: fcpEntry.startTime < 1800 ? "good" : "needs-improvement",
          path,
          timestamp: now()
        });
      }

      if (latestLcp) {
        sendJson("/api/monitoring/web-vitals", {
          name: "LCP",
          id: latestLcp.id,
          value: latestLcp.value,
          delta: latestLcp.value,
          rating: latestLcp.rating,
          path,
          timestamp: now()
        });
      }

      sendJson("/api/monitoring/web-vitals", {
        name: "CLS",
        value: Number(clsValue.toFixed(4)),
        delta: Number(clsValue.toFixed(4)),
        rating: clsValue < 0.1 ? "good" : clsValue < 0.25 ? "needs-improvement" : "poor",
        path,
        timestamp: now()
      });
    };

    const errorHandler = (event: ErrorEvent) => {
      sendJson("/api/monitoring/frontend-errors", {
        type: "error",
        name: event.error?.name || "Error",
        message: event.message || "Unknown error",
        stack: event.error?.stack || null,
        path,
        timestamp: now()
      });
    };

    const rejectionHandler = (event: PromiseRejectionEvent) => {
      const reason =
        event.reason instanceof Error ? event.reason : new Error(String(event.reason || "Promise rejection"));
      sendJson("/api/monitoring/frontend-errors", {
        type: "unhandledrejection",
        name: reason.name || "UnhandledRejection",
        message: reason.message || "Unhandled rejection",
        stack: reason.stack || null,
        path,
        timestamp: now()
      });
    };

    const visibilityHandler = () => {
      if (document.visibilityState === "hidden") {
        flushVitals();
      }
    };

    const lcpObserver =
      typeof PerformanceObserver !== "undefined"
        ? new PerformanceObserver((entryList) => {
            const entries = entryList.getEntries();
            const lastEntry = entries[entries.length - 1] as PerformanceEntry & { id?: string };
            latestLcp = {
              id: lastEntry?.id,
              value: lastEntry?.startTime || 0,
              rating:
                (lastEntry?.startTime || 0) < 2500
                  ? "good"
                  : (lastEntry?.startTime || 0) < 4000
                    ? "needs-improvement"
                    : "poor"
            };
          })
        : null;

    const clsObserver =
      typeof PerformanceObserver !== "undefined"
        ? new PerformanceObserver((entryList) => {
            for (const entry of entryList.getEntries() as Array<PerformanceEntry & { value?: number; hadRecentInput?: boolean }>) {
              if (!entry.hadRecentInput) {
                clsValue += Number(entry.value || 0);
              }
            }
          })
        : null;

    try {
      lcpObserver?.observe({ type: "largest-contentful-paint", buffered: true });
      clsObserver?.observe({ type: "layout-shift", buffered: true });
    } catch {
      // Ignore browsers without the corresponding observers.
    }

    window.addEventListener("error", errorHandler);
    window.addEventListener("unhandledrejection", rejectionHandler);
    window.addEventListener("pagehide", flushVitals);
    document.addEventListener("visibilitychange", visibilityHandler);
    const timer = window.setTimeout(flushVitals, 10_000);

    return () => {
      window.removeEventListener("error", errorHandler);
      window.removeEventListener("unhandledrejection", rejectionHandler);
      window.removeEventListener("pagehide", flushVitals);
      document.removeEventListener("visibilitychange", visibilityHandler);
      window.clearTimeout(timer);
      lcpObserver?.disconnect();
      clsObserver?.disconnect();
    };
  }, []);

  return null;
}
