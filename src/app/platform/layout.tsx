import { auth } from "@/auth";
import { PlatformShell } from "@/components/platform-shell";

export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const userLabel = session?.user?.name || session?.user?.email || "Platform admin";

  return <PlatformShell userLabel={userLabel}>{children}</PlatformShell>;
}
