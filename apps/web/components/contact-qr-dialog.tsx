"use client";

import Image from "next/image";
import { useEffect } from "react";
import { X } from "lucide-react";

const contactSteps = [
  "扫码添加客服微信。",
  "备注“autocashback”，方便快速识别来源。",
  "说明你需要试用、开通或后台演示。"
];

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
      className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/40 px-4 py-8 backdrop-blur-sm"
      role="dialog"
      onClick={onClose}
    >
      <div
        className="surface-panel relative w-full max-w-3xl overflow-hidden"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          aria-label="关闭弹窗"
          className="absolute right-4 top-4 rounded-md border border-border bg-card p-2 text-muted-foreground transition hover:bg-secondary/40 hover:text-foreground"
          onClick={onClose}
          type="button"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="border-b border-border/80 px-6 py-5">
          <p className="label-kicker">咨询入口</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-foreground">申请试用 / 联系开通</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            如果你还没有账号，直接通过客服微信联系开通。备注
            <span className="px-1 font-semibold text-foreground">autocashback</span>
            即可更快说明需求。
          </p>
        </div>

        <div className="grid gap-6 px-6 py-6 md:grid-cols-[18rem,1fr]">
          <div className="rounded-2xl border border-border bg-secondary/40 p-4">
            <Image
              alt="AutoCashBack 联系二维码"
              className="mx-auto h-64 w-64 rounded-xl border border-border bg-white object-contain p-3"
              height={320}
              priority
              sizes="256px"
              src="/contact-qr.svg"
              width={320}
            />
            <p className="mt-4 text-center text-sm font-medium text-foreground">扫码后备注 “autocashback”</p>
          </div>

          <div className="flex flex-col gap-4">
            <div className="rounded-2xl border border-border bg-card px-5 py-4">
              <p className="text-sm font-semibold text-foreground">建议说明</p>
              <div className="mt-3 space-y-3">
                {contactSteps.map((step, index) => (
                  <p className="flex items-start gap-3 text-sm leading-6 text-muted-foreground" key={step}>
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-secondary text-xs font-semibold text-foreground">
                      {index + 1}
                    </span>
                    <span>{step}</span>
                  </p>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-secondary/40 px-5 py-4">
              <p className="text-sm font-semibold text-foreground">适合的沟通内容</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                试用申请、账号开通、后台功能说明、团队使用场景、换链和 Offer 管理方式。
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
