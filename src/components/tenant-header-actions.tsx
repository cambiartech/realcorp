"use client";

import { signOut } from "next-auth/react";
import Link from "next/link";
import { EmployeePassportPhotoUpload } from "@/components/hr/employee-passport-photo-upload";
import { ThemeToggle } from "@/components/theme-toggle";

function loginCallbackUrl() {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/login`;
  }
  return "/login";
}

export function TenantHeaderActions({
  tenantSlug,
  userLabel,
  userId = null,
  userPhotoUrl = null,
}: {
  tenantSlug: string;
  userLabel: string;
  userId?: string | null;
  userPhotoUrl?: string | null;
}) {
  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      {userId ? (
        <EmployeePassportPhotoUpload
          variant="avatar"
          size="sm"
          tenantSlug={tenantSlug}
          userId={userId}
          fullName={userLabel}
          photoUrl={userPhotoUrl}
        />
      ) : null}
      <span className="hidden max-w-[160px] truncate text-xs text-muted lg:inline" title={userLabel}>
        {userLabel}
      </span>
      <Link href={`/${tenantSlug}/settings`} className="rc-btn rc-btn-ghost rc-btn-sm">
        Account
      </Link>
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
