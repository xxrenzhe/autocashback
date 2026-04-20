"use client";

import { ModalShell } from "@autocashback/ui";

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

  return (
    <ModalShell className={className} description={description} eyebrow={eyebrow} onClose={onClose} open={open} title={title}>
      {children}
    </ModalShell>
  );
}
