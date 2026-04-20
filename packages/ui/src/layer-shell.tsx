"use client";

import { useEffect, useState, type ReactNode } from "react";

import { cn } from "./cn";

type LayerShellProps = {
  open: boolean;
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  className?: string;
  titleClassName?: string;
  headerClassName?: string;
  bodyClassName?: string;
  footerClassName?: string;
  overlayClassName?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  closeLabel?: string;
};

function CloseIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 4L12 12" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
      <path d="M12 4L4 12" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
    </svg>
  );
}

function useLayerPresence(open: boolean, onClose: () => void, exitDuration = 0) {
  const [mounted, setMounted] = useState(open);

  useEffect(() => {
    if (open) {
      setMounted(true);
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
    }

    if (!exitDuration) {
      setMounted(false);
      return;
    }

    const timer = window.setTimeout(() => setMounted(false), exitDuration);
    return () => window.clearTimeout(timer);
  }, [exitDuration, onClose, open]);

  return mounted;
}

function LayerHeader({
  description,
  eyebrow,
  onClose,
  title,
  titleClassName,
  closeLabel,
  className
}: {
  description?: ReactNode;
  eyebrow?: ReactNode;
  onClose: () => void;
  title: ReactNode;
  titleClassName?: string;
  closeLabel: string;
  className?: string;
}) {
  return (
    <div className={cn("relative flex-shrink-0 border-b border-border/80 px-6 py-5", className)}>
      <button
        aria-label={closeLabel}
        className="absolute right-4 top-4 rounded-md bg-transparent p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={onClose}
        type="button"
      >
        <CloseIcon />
      </button>
      {eyebrow ? <p className="pr-10 text-xs font-semibold uppercase tracking-wider text-primary">{eyebrow}</p> : null}
      <h2 className={cn("mt-1 pr-10 text-lg font-semibold tracking-tight text-foreground", titleClassName)}>{title}</h2>
      {description ? <p className="mt-1 pr-10 text-sm text-muted-foreground">{description}</p> : null}
    </div>
  );
}

export function ModalShell({
  bodyClassName,
  children,
  className,
  closeLabel = "关闭弹窗",
  description,
  eyebrow,
  footer,
  footerClassName,
  headerClassName,
  onClose,
  open,
  overlayClassName,
  title,
  titleClassName
}: LayerShellProps) {
  const mounted = useLayerPresence(open, onClose);

  if (!mounted) {
    return null;
  }

  return (
    <div
      aria-modal="true"
      className={cn("fixed inset-0 z-[60] flex items-center justify-center bg-background/80 px-4 py-8 backdrop-blur-sm", overlayClassName)}
      role="dialog"
      onClick={onClose}
    >
      <div
        className={cn(
          "relative flex max-h-[min(90vh,calc(100dvh-2rem))] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border/90 bg-card text-card-foreground shadow-[0_24px_64px_rgba(53,48,39,0.14)] overscroll-contain",
          className
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <LayerHeader
          className={headerClassName}
          closeLabel={closeLabel}
          description={description}
          eyebrow={eyebrow}
          onClose={onClose}
          title={title}
          titleClassName={titleClassName}
        />
        <div className={cn("flex-1 overflow-y-auto px-6 py-6", bodyClassName)}>{children}</div>
        {footer ? <div className={cn("border-t border-border/80 px-6 py-4", footerClassName)}>{footer}</div> : null}
      </div>
    </div>
  );
}

export function SheetShell({
  bodyClassName,
  children,
  className,
  closeLabel = "关闭侧边栏",
  description,
  eyebrow,
  footer,
  footerClassName,
  headerClassName,
  onClose,
  open,
  overlayClassName,
  title,
  titleClassName
}: LayerShellProps) {
  const mounted = useLayerPresence(open, onClose, 200);

  if (!mounted && !open) {
    return null;
  }

  return (
    <div aria-modal="true" className="fixed inset-0 z-[60] flex justify-end" role="dialog">
      <div
        className={cn(
          "absolute inset-0 bg-background/65 backdrop-blur-sm transition-opacity duration-200",
          open ? "opacity-100" : "opacity-0",
          overlayClassName
        )}
        onClick={onClose}
      />

      <div
        className={cn(
          "relative flex h-full w-full flex-col overflow-hidden border-l border-border/80 bg-card text-card-foreground shadow-[0_18px_48px_rgba(53,48,39,0.14)] overscroll-contain transition-transform duration-200 ease-out sm:max-w-lg",
          open ? "translate-x-0" : "translate-x-full",
          className
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <LayerHeader
          className={headerClassName}
          closeLabel={closeLabel}
          description={description}
          eyebrow={eyebrow}
          onClose={onClose}
          title={title}
          titleClassName={titleClassName}
        />
        <div className={cn("flex-1 overflow-y-auto px-6 py-6", bodyClassName)}>{children}</div>
        {footer ? <div className={cn("border-t border-border/80 px-6 py-4", footerClassName)}>{footer}</div> : null}
      </div>
    </div>
  );
}
