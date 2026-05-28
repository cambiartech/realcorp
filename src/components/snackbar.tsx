"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

type SnackbarTone = "success" | "error" | "info";

type SnackbarItem = {
  id: number;
  message: string;
  tone: SnackbarTone;
  exiting?: boolean;
};

type SnackbarContextValue = {
  showSnackbar: (message: string, tone?: SnackbarTone) => void;
};

const SnackbarContext = createContext<SnackbarContextValue | null>(null);

const TONE_STYLES: Record<
  SnackbarTone,
  { border: string; iconBg: string; icon: string; label: string }
> = {
  success: {
    border: "border-emerald-500/35",
    iconBg: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
    icon: "✓",
    label: "Success",
  },
  error: {
    border: "border-red-500/40",
    iconBg: "bg-red-500/12 text-red-700 dark:text-red-300",
    icon: "!",
    label: "Error",
  },
  info: {
    border: "border-foreground/20",
    iconBg: "bg-foreground/[0.06] text-foreground",
    icon: "i",
    label: "Notice",
  },
};

export function SnackbarProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<SnackbarItem[]>([]);

  const showSnackbar = useCallback((message: string, tone: SnackbarTone = "info") => {
    const id = Date.now() + Math.floor(Math.random() * 10000);
    const visibleMs = tone === "error" ? 7000 : tone === "success" ? 3200 : 4000;
    const exitMs = 240;

    setItems((prev) => [...prev, { id, message, tone }]);
    window.setTimeout(() => {
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, exiting: true } : item)));
    }, visibleMs);
    window.setTimeout(() => {
      setItems((prev) => prev.filter((item) => item.id !== id));
    }, visibleMs + exitMs);
  }, []);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, exiting: true } : item)));
    window.setTimeout(() => {
      setItems((prev) => prev.filter((item) => item.id !== id));
    }, 220);
  }, []);

  const value = useMemo(() => ({ showSnackbar }), [showSnackbar]);

  return (
    <SnackbarContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-[70] flex w-[min(92vw,24rem)] flex-col gap-2.5 sm:bottom-6 sm:right-6"
        aria-live="polite"
        aria-relevant="additions"
      >
        {items.map((item) => {
          const tone = TONE_STYLES[item.tone];
          return (
            <div
              key={item.id}
              className={[
                "pointer-events-auto overflow-hidden rounded-xl border bg-background/95 text-foreground shadow-lg backdrop-blur-md",
                tone.border,
                item.exiting
                  ? "[animation:rc-toast-out_220ms_ease-in_forwards]"
                  : "[animation:rc-toast-in_180ms_ease-out_forwards]",
              ].join(" ")}
              role="status"
            >
              <div className="flex items-start gap-3 px-4 py-3.5">
                <span
                  className={[
                    "mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                    tone.iconBg,
                  ].join(" ")}
                  aria-hidden
                >
                  {tone.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{tone.label}</p>
                  <p className="mt-0.5 text-sm leading-snug text-foreground">{item.message}</p>
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(item.id)}
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
                  aria-label="Dismiss notification"
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 6l12 12M18 6 6 18" />
                  </svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </SnackbarContext.Provider>
  );
}

export function useSnackbar() {
  const ctx = useContext(SnackbarContext);
  if (!ctx) {
    throw new Error("useSnackbar must be used inside SnackbarProvider");
  }
  return ctx;
}
