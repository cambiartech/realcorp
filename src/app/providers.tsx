"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";

const AuthenticatedProviders = dynamic(() =>
  import("./authenticated-providers").then(
    (module) => module.AuthenticatedProviders,
  ),
);

/** Surfaces that render their own chrome — no app shell, no floating toggle. */
const SELF_CHROMED = ["/", "/preview/landing"];

/**
 * Surfaces that have their own header bar and therefore place the theme
 * toggle inline. Floating it here would sit it on top of their controls —
 * which is exactly what was clipping "Sign out".
 */
const HAS_OWN_HEADER = ["/platform"];

function hasOwnHeader(pathname: string) {
  if (
    HAS_OWN_HEADER.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  )
    return true;
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

  // The public landing page has no authenticated behavior. Keeping the session
  // provider out of this branch avoids two needless /api/auth/session requests
  // and keeps the authenticated application bundle off the marketing route.
  if (selfChromed) return children;

  return (
    <AuthenticatedProviders inlineToggle={inlineToggle}>
      {children}
    </AuthenticatedProviders>
  );
}
