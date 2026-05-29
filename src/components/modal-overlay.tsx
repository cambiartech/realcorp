"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { MODAL_PANEL_MD } from "@/lib/modal-panel";

type ModalOverlayProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Centered dialog vs right-hand drawer */
  variant?: "center" | "drawer";
  zClassName?: string;
  panelClassName?: string;
  "aria-labelledby"?: string;
};

/**
 * Modal shell: portaled to document.body, click dimmed backdrop or press Escape to close.
 */
export function ModalOverlay({
  open,
  onClose,
  children,
  variant = "center",
  zClassName = "z-50",
  panelClassName,
  "aria-labelledby": ariaLabelledby,
}: ModalOverlayProps) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const backdropClass =
    variant === "drawer"
      ? `fixed inset-0 flex justify-end bg-black/30 backdrop-blur-[1px] ${zClassName}`
      : `fixed inset-0 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm ${zClassName}`;

  const panelClass =
    variant === "drawer"
      ? (panelClassName ??
        "relative flex h-full w-full max-w-5xl shrink-0 flex-col overflow-hidden border-l border-foreground/10 bg-background shadow-2xl")
      : (panelClassName ?? MODAL_PANEL_MD);

  const dialog = (
    <div
      className={backdropClass}
      role="dialog"
      aria-modal="true"
      aria-labelledby={ariaLabelledby}
      onClick={onClose}
    >
      <div
        className={panelClass}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(dialog, document.body);
}
