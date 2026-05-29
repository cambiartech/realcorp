import Link from "next/link";
import { FormAlert } from "@/components/form-message";
import prisma from "@/lib/db";
import { classifyInvite } from "@/lib/invitation-utils";
import { JoinForm } from "./join-form";

export const metadata = {
  title: "Accept invite · Realcorp",
};

/** Never cache — token validity is per-request against the database. */
export const dynamic = "force-dynamic";

function inviteErrorMessage(
  invite: { acceptedAt: Date | null; expiresAt: Date; tenant: { name: string } } | null,
  status: ReturnType<typeof classifyInvite>,
) {
  if (!invite || status === "not_found") {
    return "This invite link is not recognized. Ask your organization admin or Realcorp support for a new invite.";
  }
  if (status === "accepted") {
    const when = invite.acceptedAt
      ? new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(invite.acceptedAt)
      : "already";
    return `This invite was already used (${when}). Sign in with your email and password.`;
  }
  if (status === "expired") {
    return `This invite for ${invite.tenant.name} expired on ${new Intl.DateTimeFormat("en-NG", {
      dateStyle: "medium",
    }).format(invite.expiresAt)}. Ask for a fresh invite link.`;
  }
  return "This invite link is invalid. Ask for a new invite.";
}

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const invite = token
    ? await prisma.invitation.findUnique({
        where: { token },
        include: { tenant: true },
      })
    : null;
  const status = classifyInvite(invite);
  const validInvite = status === "valid" && invite;

  return (
    <div className="flex min-h-dvh flex-1 flex-col items-center justify-center px-4 py-16">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-bold text-foreground">Join your organization</h1>
        <p className="mt-3 text-sm text-muted">
          Accept your invitation, set your password, and start managing your organization account.
        </p>

        {!token ? (
          <div className="mt-6 text-left">
            <FormAlert>Missing invite token. Use the invite link from your email.</FormAlert>
          </div>
        ) : !validInvite ? (
          <div className="mt-6 space-y-3 text-left">
            <FormAlert>{inviteErrorMessage(invite, status)}</FormAlert>
            {status === "accepted" ? (
              <Link
                href="/login"
                className="inline-block text-sm font-semibold text-foreground underline underline-offset-2"
              >
                Go to sign in →
              </Link>
            ) : null}
          </div>
        ) : (
          <JoinForm token={token} inviteEmail={invite.email} tenantName={invite.tenant.name} />
        )}

        <Link href="/" className="mt-8 inline-block text-sm text-muted hover:text-foreground">
          ← Home
        </Link>
      </div>
    </div>
  );
}
