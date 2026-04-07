"use client";

import { signOut } from "next-auth/react";
import Link from "next/link";

export function TenantHeaderActions({
  tenantSlug,
  userLabel,
}: {
  tenantSlug: string;
  userLabel: string;
}) {
  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <span className="hidden max-w-[160px] truncate text-xs text-muted sm:inline" title={userLabel}>
        {userLabel}
      </span>
      <Link
        href={`/${tenantSlug}/settings`}
        className="text-xs font-medium text-muted underline decoration-foreground/20 underline-offset-2 hover:text-foreground"
      >
        Account
      </Link>
      <button
        type="button"
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="rounded-md border border-foreground/15 px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-foreground/[0.06]"
      >
        Sign out
      </button>
    </div>
  );
}
