"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@autocashback/ui";

export function SheetFrame(props: {
  open: boolean;
  title: string;
  description?: string;
  eyebrow?: string;
  className?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const { children, description, eyebrow, onClose, open, title, className } = props;
  const [mounted, setMounted] = useState(false);

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
    } else {
      // Delay unmounting for animation
      const timer = setTimeout(() => setMounted(false), 300);
      return () => clearTimeout(timer);
    }
  }, [onClose, open]);

  if (!mounted && !open) {
    return null;
  }

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-[60] flex justify-end"
      role="dialog"
    >
      <div 
        className={cn("absolute inset-0 bg-background/80 backdrop-blur-sm transition-opacity duration-300", open ? "opacity-100" : "opacity-0")}
        onClick={onClose}
      />
      
      <div
        className={cn(
          "relative flex h-full w-full max-w-md flex-col overflow-hidden border-l bg-card text-card-foreground shadow-2xl overscroll-contain transition-transform duration-300 ease-in-out",
          open ? "translate-x-0" : "translate-x-full",
          className
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          aria-label="关闭侧边栏"
          className="absolute right-4 top-4 rounded-md bg-transparent p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={onClose}
          type="button"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex-shrink-0 border-b px-6 py-5">
          {eyebrow && <p className="text-xs font-semibold uppercase tracking-wider text-primary">{eyebrow}</p>}
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
