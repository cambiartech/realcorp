import Link from "next/link";
import { auth } from "@/auth";
import { PlatformHeaderActions } from "@/components/platform-header-actions";
import { RealcorpLogoLink } from "@/components/realcorp-brand";

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const userLabel = session?.user?.name || session?.user?.email || "Platform admin";

  return (
    <div className="min-h-dvh flex-1 bg-background text-foreground">
      <header className="border-b border-foreground/10 bg-background">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <RealcorpLogoLink href="/platform" subtitle="Platform admin" showWordmark />
          <div className="flex items-center gap-4 sm:gap-6">
            <nav className="flex gap-4 text-sm">
              <Link href="/platform" className="text-muted hover:text-foreground">
                Home
              </Link>
              <Link
                href="/platform/onboarding"
                className="text-muted hover:text-foreground"
              >
                Onboard org
              </Link>
              <Link href="/platform/errors" className="text-muted hover:text-foreground">
                Error lookup
              </Link>
              <Link href="/" className="text-muted hover:text-foreground">
                Marketing site
              </Link>
            </nav>
            <PlatformHeaderActions userLabel={userLabel} />
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
