"use client";

import { SessionProvider } from "next-auth/react";
import { usePathname } from "next/navigation";
import { ThemeProvider } from "next-themes";
import { ThemeToggle } from "@/components/theme-toggle";
import { SnackbarProvider } from "@/components/snackbar";

/** Surfaces that render their own chrome — no app shell, no floating toggle. */
const SELF_CHROMED = ["/", "/preview/landing"];

/**
 * Surfaces that have their own header bar and therefore place the theme
 * toggle inline. Floating it here would sit it on top of their controls —
 * which is exactly what was clipping "Sign out".
 */
const HAS_OWN_HEADER = ["/platform"];

function hasOwnHeader(pathname: string) {
  if (HAS_OWN_HEADER.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return true;
  // Tenant workspaces (/[tenantSlug]/…) all render TenantLayout's header.
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return false;
  const reserved = [
    "login",
    "join",
    "explore",
    "f",
    "investor",
    "realtor",
    "hr-form",
    "hr-offer",
    "hr-onboarding",
    "api",
    "preview",
  ];
  return !reserved.includes(segments[0]);
}

export function Providers({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const selfChromed = SELF_CHROMED.includes(pathname);
  const inlineToggle = hasOwnHeader(pathname);

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
      <SessionProvider>
        <SnackbarProvider>
          {selfChromed ? (
            children
          ) : (
            <div className="relative flex min-h-dvh w-full flex-col bg-background text-foreground">
              {/* Only float the toggle on pages with no header of their own. */}
              {!inlineToggle ? (
                <div className="pointer-events-none fixed right-3 top-3 z-50 flex justify-end sm:right-4 sm:top-4">
                  <div className="pointer-events-auto">
                    <ThemeToggle />
                  </div>
                </div>
              ) : null}
              <div className="flex min-h-dvh flex-1 flex-col">{children}</div>
            </div>
          )}
        </SnackbarProvider>
      </SessionProvider>
    </ThemeProvider>
  );
}
