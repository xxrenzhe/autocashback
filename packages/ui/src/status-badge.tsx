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
  active: { label: "启用中", className: "bg-primary/10 text-primary" },
  disabled: { label: "已停用", className: "bg-slate-100 text-foreground" },
  error: { label: "异常", className: "bg-destructive/10 text-destructive" },
  idle: { label: "空闲", className: "bg-slate-100 text-foreground" },
  info: { label: "信息", className: "bg-slate-100 text-foreground" },
  paused: { label: "已暂停", className: "bg-slate-100 text-foreground" },
  pending: { label: "待执行", className: "bg-amber-500/10 text-amber-600" },
  running: { label: "运行中", className: "bg-primary/10 text-primary" },
  success: { label: "正常", className: "bg-primary/10 text-primary" },
  warning: { label: "预警", className: "bg-amber-500/10 text-amber-600" }
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
      className={cn("inline-flex rounded-full px-3 py-1 text-xs font-semibold", meta.className, className)}
    >
      {label ?? meta.label}
    </span>
  );
}
