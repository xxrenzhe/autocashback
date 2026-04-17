"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@autocashback/ui";

export function ModalFrame(props: {
  open: boolean;
  title: string;
  description?: string;
  eyebrow?: string;
  className?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const { children, description, eyebrow = "任务配置", onClose, open, title, className } = props;

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 px-4 py-8 backdrop-blur-sm"
      role="dialog"
      onClick={onClose}
    >
      <div
        className={cn(
          "relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-lg overscroll-contain",
          className
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          aria-label="关闭弹窗"
          className="absolute right-4 top-4 rounded-md bg-transparent p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={onClose}
          type="button"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex-shrink-0 border-b px-6 py-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">{eyebrow}</p>
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-foreground">{title}</h2>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {children}
        </div>
      </div>
    </div>
  );
}
