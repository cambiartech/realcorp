"use client";

import { signOut } from "next-auth/react";

export function PlatformHeaderActions({ userLabel }: { userLabel: string }) {
  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <span className="hidden max-w-[160px] truncate text-xs text-muted sm:inline" title={userLabel}>
        {userLabel}
      </span>
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
