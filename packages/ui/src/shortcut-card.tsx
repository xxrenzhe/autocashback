import type { ComponentType, ReactNode } from "react";

import { cn } from "./cn";
import { getToneStyles, type Tone } from "./tone";

export function ShortcutCard({
  className,
  description,
  icon: Icon,
  title,
  tone = "emerald",
  trailing
}: {
  className?: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  title: string;
  tone?: Exclude<Tone, "red">;
  trailing?: ReactNode;
}) {
  const styles = getToneStyles(tone);

  return (
    <div
      className={cn(
        "group rounded-xl border border-border bg-background/90 p-4 transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-md motion-reduce:transform-none",
        className
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span className={cn("flex h-11 w-11 items-center justify-center rounded-lg", styles.icon)}>
          <Icon className="h-5 w-5" />
        </span>
        {trailing}
      </div>
      <p className="mt-4 text-sm font-semibold text-foreground">{title}</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  );
}
