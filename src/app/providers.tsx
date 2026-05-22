"use client";

import { SessionProvider } from "next-auth/react";
import { usePathname } from "next/navigation";
import { ThemeProvider } from "next-themes";
import { ThemeToggle } from "@/components/theme-toggle";
import { SnackbarProvider } from "@/components/snackbar";

export function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLanding = pathname === "/";

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      <SessionProvider>
        <SnackbarProvider>
          {isLanding ? (
            children
          ) : (
            <div className="relative flex min-h-dvh w-full flex-col bg-background text-foreground">
              <div className="pointer-events-none fixed right-3 top-3 z-50 flex justify-end sm:right-4 sm:top-4">
                <div className="pointer-events-auto">
                  <ThemeToggle />
                </div>
              </div>
              <div className="flex min-h-dvh flex-1 flex-col">{children}</div>
            </div>
          )}
        </SnackbarProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}
