import Link from "next/link";
import { RealcorpHeroLogo } from "@/components/realcorp-brand";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata = {
  title: "Forgot password · Realcorp",
};

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-dvh flex-1 flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <RealcorpHeroLogo className="mb-6" />
        <h1 className="text-center text-xl font-bold text-foreground">Forgot password</h1>
        <p className="mt-1 text-center text-sm text-muted">
          Enter the work email you sign in with. We’ll send a link to set a new password.
        </p>

        <ForgotPasswordForm />

        <Link href="/login" className="mt-6 block text-center text-sm text-muted hover:text-foreground">
          ← Back to sign in
        </Link>
      </div>
    </div>
  );
}
