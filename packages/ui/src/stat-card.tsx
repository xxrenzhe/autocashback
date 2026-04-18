import type { ComponentType } from "react";

import { cn } from "./cn";
import { getToneStyles, type Tone } from "./tone";

export function StatCard({
  className,
  icon: Icon,
  label,
  note,
  tone = "slate",
  value
}: {
  className?: string;
  icon?: ComponentType<{ className?: string }>;
  label: string;
  note: string;
  tone?: Tone;
  value: string;
}) {
  const styles = getToneStyles(tone);

  return (
    <div className={cn("bg-card text-card-foreground rounded-xl border shadow-sm p-5", className)}>
      <div className="flex items-start justify-between gap-4">
        <span className={cn("inline-flex rounded-full px-3 py-1 text-xs font-semibold", styles.badge)}>
          {label}
        </span>
        {Icon ? (
          <span className={cn("flex h-10 w-10 items-center justify-center rounded-lg", styles.icon)}>
            <Icon className="h-4 w-4" />
          </span>
        ) : null}
      </div>
      <p className={cn("mt-5 font-mono tabular-nums text-4xl font-semibold", styles.value)}>{value}</p>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{note}</p>
    </div>
  );
}
