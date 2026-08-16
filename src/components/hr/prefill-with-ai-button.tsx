"use client";

import { WandSparkles } from "lucide-react";

export function PrefillWithAiButton({
  pending,
  onClick,
  className = "",
  pendingLabel = "Reading uploaded documents…",
  label = "Prefill with AI",
}: {
  pending?: boolean;
  onClick: () => void;
  className?: string;
  pendingLabel?: string;
  label?: string;
}) {
  return (
    <button
      type="button"
      disabled={pending}
      onClick={onClick}
      className={[
        "inline-flex w-full items-center justify-center gap-2 rounded-md border border-violet-500/40 bg-gradient-to-r from-violet-600 to-indigo-600 px-3 py-2 text-xs font-semibold text-white shadow-sm",
        "hover:from-violet-500 hover:to-indigo-500 disabled:cursor-not-allowed disabled:opacity-60",
        className,
      ].join(" ")}
    >
      <WandSparkles className={`h-3.5 w-3.5 shrink-0 ${pending ? "animate-pulse" : ""}`} />
      {pending ? pendingLabel : label}
    </button>
  );
}
