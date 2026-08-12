"use client";

import { Download, LoaderCircle } from "lucide-react";
import { useState, type CSSProperties, type ReactNode } from "react";
import { downloadElementAsPdf } from "@/lib/download-element-pdf";

export function PdfDownloadButton({
  targetSelector = "[data-pdf-document='true']",
  filename,
  children = "Download PDF",
  className,
  style,
}: {
  targetSelector?: string;
  filename: string;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  async function download() {
    const target = document.querySelector<HTMLElement>(targetSelector);
    if (!target) {
      setState("error");
      window.setTimeout(() => setState("idle"), 2500);
      return;
    }
    setState("loading");
    try {
      await downloadElementAsPdf(target, filename);
      setState("idle");
    } catch (error) {
      console.error("Direct PDF download failed.", error);
      setState("error");
      window.setTimeout(() => setState("idle"), 2500);
    }
  }

  return (
    <button
      type="button"
      disabled={state === "loading"}
      aria-busy={state === "loading"}
      onClick={() => void download()}
      style={style}
      className={
        className ??
        "inline-flex items-center gap-1.5 rounded-md border border-foreground bg-foreground px-3 py-1.5 text-xs font-semibold text-background hover:opacity-90 disabled:opacity-60"
      }
    >
      {state === "loading" ? (
        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Download className="h-3.5 w-3.5" />
      )}
      {state === "loading" ? "Preparing PDF…" : state === "error" ? "Could not download" : children}
    </button>
  );
}
