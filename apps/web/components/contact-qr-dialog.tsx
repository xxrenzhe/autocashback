"use client";

import Image from "next/image";
import { useEffect } from "react";
import { X } from "lucide-react";

export function ContactQrDialog(props: {
  open: boolean;
  onClose: () => void;
}) {
  const { onClose, open } = props;

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
        className="relative w-full max-w-md overflow-hidden rounded-[32px] border border-white/80 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-7 shadow-[0_30px_80px_rgba(15,23,42,0.18)]"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          aria-label="关闭弹窗"
          className="absolute right-4 top-4 rounded-full border border-border bg-background p-2 text-muted-foreground transition hover:text-foreground"
          onClick={onClose}
          type="button"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="pr-10">
          <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold tracking-[0.12em] text-primary">
            咨询入口
          </span>
          <h2 className="mt-4 text-xl font-semibold tracking-tight text-foreground">咨询客服</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            扫码添加客服微信，获取试用和开通咨询。备注 <span className="font-semibold text-foreground">“autocashback”</span> 更快处理。
          </p>
        </div>

        <div className="mt-6 rounded-xl border border-border bg-background/90 p-5">
          <div className="rounded-xl bg-[radial-gradient(circle_at_top,rgba(209,250,229,0.55),transparent_56%),linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-4">
            <Image
              alt="AutoCashBack 联系二维码"
              className="mx-auto h-64 w-64 rounded-lg border border-border bg-background object-contain p-3"
              height={320}
              priority
              sizes="256px"
              src="/contact-qr.svg"
              width={320}
            />
          </div>
          <div className="mt-4 flex items-center justify-center">
            <span className="rounded-full bg-primary/10 px-4 py-1 text-sm font-semibold text-primary">
              备注 “autocashback”
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
