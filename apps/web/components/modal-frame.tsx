"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

export function ModalFrame(props: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const { children, description, onClose, open, title } = props;

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
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/45 px-4 py-8 backdrop-blur-sm"
      role="dialog"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[32px] border border-white/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-7 shadow-[0_30px_80px_rgba(15,23,42,0.18)]"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          aria-label="关闭弹窗"
          className="absolute right-4 top-4 rounded-full border border-brand-line bg-white p-2 text-slate-500 transition hover:text-slate-900"
          onClick={onClose}
          type="button"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="pr-10">
          <p className="eyebrow">任务配置</p>
          <h2 className="mt-3 text-2xl font-semibold text-slate-900">{title}</h2>
          {description ? <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p> : null}
        </div>

        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
