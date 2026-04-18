import type { ReactNode } from "react";

import { cn } from "./cn";

export function MetricGroup({
  children,
  className,
  description,
  title
}: {
  children: ReactNode;
  className?: string;
  description?: ReactNode;
  title: ReactNode;
}) {
  return (
    <section className={cn("rounded-xl border border-border bg-card p-5 shadow-sm", className)}>
      <h3 className="text-lg font-semibold tracking-tight text-foreground">{title}</h3>
      {description ? <div className="mt-2 text-sm leading-6 text-muted-foreground">{description}</div> : null}
      <div className="mt-5">{children}</div>
    </section>
  );
}
