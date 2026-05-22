import Link from "next/link";
import { RealcorpHeroLogo } from "@/components/realcorp-brand";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 pb-24 pt-20">
      <RealcorpHeroLogo className="mb-2" />
      <h1 className="mt-4 max-w-xl text-center text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        PropTech CRM &amp; ERP for real estate developers
      </h1>
      <p className="mt-4 max-w-md text-center text-sm leading-relaxed text-muted">
        Multi-tenant platform: sales pipeline, inventory locking, milestone finance, and org onboarding.
      </p>
      <div className="mt-10 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/login"
          className="inline-flex items-center justify-center border border-foreground bg-foreground px-6 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-90"
        >
          Platform sign in
        </Link>
        <Link
          href="/platform"
          className="inline-flex items-center justify-center border border-foreground/20 bg-transparent px-6 py-3 text-sm font-medium text-foreground transition-colors hover:bg-foreground/[0.06]"
        >
          Platform console
        </Link>
      </div>
      <p className="mt-8 text-center text-xs text-muted">
        Docs in repo root: sprint-0.md · tech-stack.md · dashboard-spec-by-role.md
      </p>
    </div>
  );
}
