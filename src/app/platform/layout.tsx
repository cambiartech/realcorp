import Link from "next/link";

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh flex-1 bg-background text-foreground">
      <header className="border-b border-foreground/10 bg-background pr-28">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/platform" className="text-sm font-bold tracking-tight text-foreground">
            Realcorp <span className="font-normal text-muted">Platform</span>
          </Link>
          <nav className="flex gap-4 text-sm">
            <Link href="/platform" className="text-muted hover:text-foreground">
              Home
            </Link>
            <Link
              href="/platform/onboarding"
              className="text-foreground underline decoration-foreground/25 underline-offset-4 hover:decoration-foreground/60"
            >
              Onboard org
            </Link>
            <Link href="/" className="text-muted hover:text-foreground">
              Marketing site
            </Link>
          </nav>
        </div>
      </header>
      {children}
    </div>
  );
}
