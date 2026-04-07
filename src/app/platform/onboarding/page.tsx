import Link from "next/link";
import { OnboardingForm } from "./onboarding-form";

export const metadata = {
  title: "Onboard organization · Realcorp",
};

export default function PlatformOnboardingPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <p className="text-xs font-semibold uppercase tracking-[0.35em] text-muted">Platform</p>
      <h1 className="mt-2 text-2xl font-bold text-foreground">Onboard a new organization</h1>
      <p className="mt-2 text-sm text-muted">
        Creates a tenant, default settings, and a 14-day invite for the first{" "}
        <strong className="text-foreground/90">Org Admin</strong>. They complete signup at{" "}
        <code className="border border-foreground/10 bg-field px-1.5 py-0.5 font-mono text-xs">
          /join
        </code>
        .
      </p>
      <div className="mt-8">
        <OnboardingForm />
      </div>
      <Link href="/platform" className="mt-8 inline-block text-sm text-muted hover:text-foreground">
        ← Platform home
      </Link>
    </div>
  );
}
