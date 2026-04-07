import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata = {
  title: "Sign in · Realcorp",
};

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh flex-1 flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.35em] text-muted">Realcorp</p>
        <h1 className="mt-2 text-center text-xl font-bold text-foreground">Sign in</h1>
        <p className="mt-1 text-center text-sm text-muted">Use your work email and password to continue.</p>

        <LoginForm />

        <Link href="/" className="mt-6 block text-center text-sm text-muted hover:text-foreground">
          ← Home
        </Link>
      </div>
    </div>
  );
}
