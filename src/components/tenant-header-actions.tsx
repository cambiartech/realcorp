"use client";

import { signOut } from "next-auth/react";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

export function TenantHeaderActions({ tenantSlug, userLabel }: { tenantSlug: string; userLabel: string }) {
  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      <span className="hidden max-w-[160px] truncate text-xs text-muted lg:inline" title={userLabel}>
        {userLabel}
      </span>
      <Link href={`/${tenantSlug}/settings`} className="rc-btn rc-btn-ghost rc-btn-sm">
        Account
      </Link>
      <button
        type="button"
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="rc-btn rc-btn-secondary rc-btn-sm"
      >
        Sign out
      </button>
      {/* Lives in the header rather than floating over it. */}
      <ThemeToggle />
    </div>
  );
}
