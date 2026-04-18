import type { ComponentType, ReactNode } from "react";

import { cn } from "./cn";

export function EmptyState({
  action,
  className,
  description,
  icon: Icon,
  title
}: {
  action?: ReactNode;
  className?: string;
  description: string;
  icon?: ComponentType<{ className?: string }>;
  title: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-dashed border-border bg-muted/40 px-5 py-6 text-center",
        className
      )}
    >
      {Icon ? (
        <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-background text-muted-foreground shadow-sm">
          <Icon className="h-4 w-4" />
        </span>
      ) : null}
      <p className={cn("text-sm font-semibold text-foreground", Icon ? "mt-4" : "")}>{title}</p>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
