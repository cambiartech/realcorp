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

export function SnackbarProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<SnackbarItem[]>([]);

  const showSnackbar = useCallback((message: string, tone: SnackbarTone = "info") => {
    const id = Date.now() + Math.floor(Math.random() * 10000);
    setItems((prev) => [...prev, { id, message, tone }]);
    window.setTimeout(() => {
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, exiting: true } : item)));
    }, 2600);
    window.setTimeout(() => {
      setItems((prev) => prev.filter((item) => item.id !== id));
    }, 3000);
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
      <div className="pointer-events-none fixed bottom-4 right-4 z-[70] flex w-[min(92vw,28rem)] flex-col gap-2">
        {items.map((item) => (
          <div
            key={item.id}
            className={[
              "pointer-events-auto flex items-center gap-2 rounded-lg border px-3 py-2 text-sm shadow-xl",
              "bg-foreground text-background border-transparent",
              item.tone === "success"
                ? "shadow-emerald-500/15"
                : item.tone === "error"
                  ? "shadow-red-500/15"
                  : "",
              item.exiting
                ? "[animation:rc-toast-out_220ms_ease-in_forwards]"
                : "[animation:rc-toast-in_180ms_ease-out_forwards]",
            ].join(" ")}
            role="status"
          >
            <span
              className={[
                "inline-flex h-5 w-5 items-center justify-center rounded-full border border-current/40 text-[11px] font-bold",
                item.tone === "success"
                  ? "text-emerald-300"
                  : item.tone === "error"
                    ? "text-red-300"
                    : "text-blue-200",
              ].join(" ")}
              aria-hidden
            >
              {item.tone === "success" ? "✓" : item.tone === "error" ? "!" : "i"}
            </span>
            <p className="min-w-0 flex-1 truncate font-medium">{item.message}</p>
            <button
              type="button"
              onClick={() => dismiss(item.id)}
              className="inline-flex h-6 w-6 items-center justify-center rounded-md text-background/80 transition-colors hover:bg-white/10 hover:text-background"
              aria-label="Dismiss notification"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        ))}
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
