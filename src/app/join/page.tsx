import Link from "next/link";
import { FormAlert } from "@/components/form-message";
import prisma from "@/lib/db";
import { JoinForm } from "./join-form";

export const metadata = {
  title: "Accept invite · Realcorp",
};

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
  const validInvite = Boolean(invite && !invite.acceptedAt && invite.expiresAt > new Date());

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
        ) : !validInvite || !invite ? (
          <div className="mt-6 text-left">
            <FormAlert>This invite link is invalid, expired, or already used. Ask for a new invite.</FormAlert>
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
