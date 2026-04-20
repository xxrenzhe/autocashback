import { cn } from "./cn";

export type StatusBadgeVariant =
  | "active"
  | "disabled"
  | "error"
  | "idle"
  | "info"
  | "paused"
  | "pending"
  | "running"
  | "success"
  | "warning";

const statusBadgeMeta: Record<StatusBadgeVariant, { className: string; label: string }> = {
  active: { label: "启用中", className: "border-primary/15 bg-primary/10 text-primary" },
  disabled: { label: "已停用", className: "border-border bg-muted/70 text-foreground" },
  error: { label: "异常", className: "border-destructive/20 bg-destructive/10 text-destructive" },
  idle: { label: "空闲", className: "border-border bg-muted/70 text-foreground" },
  info: { label: "信息", className: "border-border bg-muted/70 text-foreground" },
  paused: { label: "已暂停", className: "border-border bg-muted/70 text-foreground" },
  pending: { label: "待执行", className: "border-amber-200 bg-amber-500/10 text-amber-700" },
  running: { label: "运行中", className: "border-primary/15 bg-primary/10 text-primary" },
  success: { label: "正常", className: "border-primary/15 bg-primary/10 text-primary" },
  warning: { label: "预警", className: "border-amber-200 bg-amber-500/10 text-amber-700" }
};

export function getStatusBadgeMeta(variant: StatusBadgeVariant) {
  return statusBadgeMeta[variant];
}

export function StatusBadge({
  className,
  label,
  variant
}: {
  className?: string;
  label?: string;
  variant: StatusBadgeVariant;
}) {
  const meta = getStatusBadgeMeta(variant);

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-semibold tracking-[0.02em]",
        meta.className,
        className
      )}
    >
      {label ?? meta.label}
    </span>
  );
}
