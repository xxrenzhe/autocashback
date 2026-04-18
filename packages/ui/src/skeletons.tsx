import { cn } from "./cn";

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-xl border border-border bg-muted/40 p-5", className)}>
      <div className="h-5 w-24 animate-pulse rounded-full bg-muted" />
      <div className="mt-4 h-4 w-full animate-pulse rounded-full bg-muted" />
      <div className="mt-2 h-4 w-4/5 animate-pulse rounded-full bg-muted" />
    </div>
  );
}

export function StatSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("bg-card text-card-foreground rounded-xl border shadow-sm p-5", className)}>
      <div className="h-6 w-20 animate-pulse rounded-full bg-muted" />
      <div className="mt-5 h-10 w-24 animate-pulse rounded-full bg-muted" />
      <div className="mt-3 h-4 w-full animate-pulse rounded-full bg-muted" />
    </div>
  );
}

export function TableSkeleton({
  className,
  rows = 5
}: {
  className?: string;
  rows?: number;
}) {
  return (
    <div className={cn("rounded-xl border border-border bg-card p-5", className)}>
      <div className="h-6 w-40 animate-pulse rounded-full bg-muted" />
      <div className="mt-5 space-y-3">
        {Array.from({ length: rows }).map((_, index) => (
          <div className="h-12 animate-pulse rounded-lg bg-muted/70" key={index} />
        ))}
      </div>
    </div>
  );
}
