import Link from "next/link";
import { FormAlert } from "@/components/form-message";
import { RealcorpHeroLogo } from "@/components/realcorp-brand";
import { readPasswordResetEmail } from "@/lib/password-reset";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata = {
  title: "Set a new password · Realcorp",
};

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const email = token ? await readPasswordResetEmail(token) : null;

  return (
    <div className="flex min-h-dvh flex-1 flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <RealcorpHeroLogo className="mb-6" />
        <h1 className="text-center text-xl font-bold text-foreground">Set a new password</h1>
        <p className="mt-1 text-center text-sm text-muted">
          Choose a password you will use with your work email on Realcorp.
        </p>

        {!token || !email ? (
          <div className="mt-8 space-y-3">
            <FormAlert>
              This reset link is invalid or has expired. Request a new one from the sign-in page.
            </FormAlert>
            <Link
              href="/forgot-password"
              className="block text-center text-sm font-semibold text-foreground underline underline-offset-2"
            >
              Send a new reset link
            </Link>
          </div>
        ) : (
          <ResetPasswordForm token={token} />
        )}

        <Link href="/login" className="mt-6 block text-center text-sm text-muted hover:text-foreground">
          ← Back to sign in
        </Link>
      </div>
    </div>
  );
}
