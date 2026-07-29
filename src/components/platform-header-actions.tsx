"use client";

import { signOut } from "next-auth/react";
import { ThemeToggle } from "@/components/theme-toggle";

function loginCallbackUrl() {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/login`;
  }
  return "/login";
}

export function PlatformHeaderActions({ userLabel }: { userLabel: string }) {
  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      <span className="hidden max-w-[160px] truncate text-xs text-muted lg:inline" title={userLabel}>
        {userLabel}
      </span>
      <button
        type="button"
        onClick={() => signOut({ callbackUrl: loginCallbackUrl() })}
        className="rc-btn rc-btn-secondary rc-btn-sm"
      >
        Sign out
      </button>
      {/* Lives in the header rather than floating over it. */}
      <ThemeToggle />
    </div>
  );
}
