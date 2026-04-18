import type { ReactNode } from "react";

import { cn } from "./cn";
import { usePageHeaderContext } from "./page-header-context";

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
  title?: ReactNode;
}) {
  const context = usePageHeaderContext();
  const resolvedTitle = title ?? context.title;
  const resolvedDescription = description ?? context.description;

  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between", className)}>
      <div>
        {eyebrow ? <p className="text-xs font-semibold uppercase tracking-wider text-primary">{eyebrow}</p> : null}
        {resolvedTitle ? (
          <h1 className={cn("text-2xl font-semibold tracking-tight text-foreground", eyebrow ? "mt-2" : "")}>
            {resolvedTitle}
          </h1>
        ) : null}
        {resolvedDescription ? (
          <div className="mt-3 text-sm leading-6 text-muted-foreground">{resolvedDescription}</div>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-3">{actions}</div> : null}
    </div>
  );
}
