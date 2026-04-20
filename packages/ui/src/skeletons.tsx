import { cn } from "./cn";

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-xl border border-border bg-muted/40 p-5", className)}>
      <div className="h-4 w-24 animate-pulse rounded-md bg-muted" />
      <div className="mt-4 h-4 w-full animate-pulse rounded-md bg-muted" />
      <div className="mt-2 h-4 w-4/5 animate-pulse rounded-md bg-muted" />
    </div>
  );
}

export function StatSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-xl border bg-card p-5 text-card-foreground shadow-sm", className)}>
      <div className="h-3 w-16 animate-pulse rounded-md bg-muted" />
      <div className="mt-4 h-8 w-24 animate-pulse rounded-md bg-primary/10" />
      <div className="mt-3 h-4 w-32 animate-pulse rounded-md bg-muted" />
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
      <div className="h-4 w-40 animate-pulse rounded-md bg-muted" />
      <div className="mt-5 space-y-3">
        {Array.from({ length: rows }).map((_, index) => (
          <div className="h-12 animate-pulse rounded-lg bg-muted/70" key={index} />
        ))}
      </div>
    </div>
  );
}

export function FormSkeleton({ className, rows = 4 }: { className?: string; rows?: number }) {
  return (
    <div className={cn("rounded-xl border border-border bg-card p-5", className)}>
      <div className="h-4 w-28 animate-pulse rounded-md bg-muted" />
      <div className="mt-5 space-y-4">
        {Array.from({ length: rows }).map((_, index) => (
          <div className="space-y-2" key={index}>
            <div className="h-3 w-20 animate-pulse rounded-md bg-muted" />
            <div className="h-10 w-full animate-pulse rounded-lg bg-muted/70" />
          </div>
        ))}
      </div>
    </div>
  );
}
