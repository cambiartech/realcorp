"use client";

import { SnackbarProvider } from "@/components/snackbar";
import { ThemeToggle } from "@/components/theme-toggle";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";

export function AuthenticatedProviders({
  children,
  inlineToggle,
}: {
  children: React.ReactNode;
  inlineToggle: boolean;
}) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
    >
      <SessionProvider>
        <SnackbarProvider>
          <div className="relative flex min-h-dvh w-full flex-col bg-background text-foreground">
            {!inlineToggle ? (
              <div className="pointer-events-none fixed right-3 top-3 z-50 flex justify-end sm:right-4 sm:top-4">
                <div className="pointer-events-auto">
                  <ThemeToggle />
                </div>
              </div>
            ) : null}
            <div className="flex min-h-dvh flex-1 flex-col">{children}</div>
          </div>
        </SnackbarProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}
