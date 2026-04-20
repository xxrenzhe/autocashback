"use client";

import { SheetShell } from "@autocashback/ui";

export function SheetFrame(props: {
  open: boolean;
  title: string;
  description?: string;
  eyebrow?: string;
  className?: string;
  titleClassName?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const { children, description, eyebrow, onClose, open, title, className, titleClassName } = props;

  return (
    <SheetShell
      className={className}
      description={description}
      eyebrow={eyebrow}
      onClose={onClose}
      open={open}
      title={title}
      titleClassName={titleClassName}
    >
      {children}
    </SheetShell>
  );
}
