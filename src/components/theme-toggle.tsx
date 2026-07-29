"use client";

import { useTheme } from "next-themes";

/**
 * No mounted-state effect and no hydration guard: the markup is identical on
 * server and client, and CSS picks which icon shows based on the `dark` class
 * next-themes puts on <html>. That kills a hydration mismatch and a
 * cascading-render lint error in one go.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-background text-muted transition-colors hover:bg-field hover:text-foreground"
      title="Toggle light and dark mode"
      aria-label="Toggle light and dark mode"
    >
      <SunIcon />
      <MoonIcon />
    </button>
  );
}

function SunIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="hidden h-4 w-4 dark:block"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.5v2.2M12 19.3v2.2M4.7 4.7l1.6 1.6M17.7 17.7l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.7 19.3l1.6-1.6M17.7 6.3l1.6-1.6" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 dark:hidden"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <path d="M20.2 14.1a8.5 8.5 0 1 1-10.3-10 7 7 0 1 0 10.3 10Z" />
    </svg>
  );
}
