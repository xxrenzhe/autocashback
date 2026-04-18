import type { ReactNode } from "react";

import { cn } from "./cn";

export function PageHeader({
  actions,
  className,
  description,
  eyebrow,
  title
}: {
  actions?: ReactNode;
  className?: string;
  description?: ReactNode;
  eyebrow?: ReactNode;
  title: ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between", className)}>
      <div>
        {eyebrow ? <p className="text-xs font-semibold uppercase tracking-wider text-primary">{eyebrow}</p> : null}
        <h2 className={cn("text-xl font-semibold tracking-tight text-foreground", eyebrow ? "mt-2" : "")}>
          {title}
        </h2>
        {description ? <div className="mt-3 text-sm leading-6 text-muted-foreground">{description}</div> : null}
      </div>
      {actions ? <div className="flex items-center gap-3">{actions}</div> : null}
    </div>
  );
}
