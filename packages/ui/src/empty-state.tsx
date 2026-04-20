import type { ComponentType, ReactNode } from "react";

import { cn } from "./cn";

function EmptyStateGuideIllustration() {
  return (
    <svg
      aria-hidden="true"
      className="h-full w-full"
      fill="none"
      viewBox="0 0 184 132"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect fill="currentColor" fillOpacity="0.06" height="116" rx="16" width="168" x="8" y="8" />
      <rect height="115" rx="15.5" stroke="currentColor" strokeOpacity="0.14" width="167" x="8.5" y="8.5" />
      <rect fill="currentColor" fillOpacity="0.11" height="10" rx="5" width="56" x="28" y="28" />
      <rect fill="currentColor" fillOpacity="0.09" height="8" rx="4" width="96" x="28" y="48" />
      <rect fill="currentColor" fillOpacity="0.09" height="8" rx="4" width="78" x="28" y="62" />
      <rect fill="currentColor" fillOpacity="0.08" height="52" rx="12" width="54" x="28" y="82" />
      <rect fill="currentColor" fillOpacity="0.08" height="52" rx="12" width="74" x="88" y="82" />
      <path d="M128 37H156" opacity="0.35" stroke="currentColor" strokeLinecap="round" strokeWidth="8" />
      <path d="M142 23V51" opacity="0.35" stroke="currentColor" strokeLinecap="round" strokeWidth="8" />
      <circle cx="142" cy="37" fill="currentColor" fillOpacity="0.16" r="18" />
    </svg>
  );
}

export function EmptyState({
  action,
  className,
  description,
  icon: Icon,
  illustration,
  title
}: {
  action?: ReactNode;
  className?: string;
  description?: string;
  icon?: ComponentType<{ className?: string }>;
  illustration?: ReactNode | boolean;
  title: string;
}) {
  const guided = illustration !== undefined && illustration !== false;

  return (
    <div
      className={cn(
        guided
          ? "grid gap-5 rounded-xl border border-dashed border-border bg-muted/40 px-6 py-6 text-center sm:grid-cols-[168px_minmax(0,1fr)] sm:items-center sm:text-left"
          : "rounded-xl border border-dashed border-border bg-muted/40 px-5 py-6 text-center",
        className
      )}
    >
      {guided ? (
        <div className="mx-auto flex h-32 w-full max-w-[184px] items-center justify-center text-primary sm:mx-0">
          {typeof illustration === "boolean" ? <EmptyStateGuideIllustration /> : illustration ?? <EmptyStateGuideIllustration />}
        </div>
      ) : null}
      <div>
        {Icon ? (
          <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-background text-muted-foreground shadow-sm sm:mx-0">
            <Icon className="h-4 w-4" />
          </span>
        ) : null}
        <p className={cn("text-sm font-semibold text-foreground", Icon ? "mt-4" : "", guided ? "sm:text-base" : "")}>{title}</p>
        {description ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p> : null}
        {action ? (
          <div className={cn("mt-4", guided ? "flex flex-wrap justify-center gap-3 sm:justify-start" : "")}>{action}</div>
        ) : null}
      </div>
    </div>
  );
}
