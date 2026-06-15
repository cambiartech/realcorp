import { redirect } from "next/navigation";
import { auth } from "@/auth";
import prisma from "@/lib/db";
import { isPortalOnlyMembership } from "@/lib/portal";

export const dynamic = "force-dynamic";

export default async function AuthLandingPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  if (session.user.isPlatformAdmin) {
    redirect("/platform");
  }

  const memberships = await prisma.membership.findMany({
    where: {
      userId: session.user.id,
      status: "ACTIVE",
    },
    orderBy: { createdAt: "asc" },
    select: {
      role: true,
      tenant: { select: { slug: true } },
    },
  });

  if (memberships.length === 0) {
    redirect("/");
  }

  const portalMemberships = memberships.filter((m) => isPortalOnlyMembership(m.role));
  const staffMemberships = memberships.filter((m) => !isPortalOnlyMembership(m.role));

  // Investor-only users: one org → portal; multiple orgs → global hub
  if (staffMemberships.length === 0 && portalMemberships.length > 0) {
    if (portalMemberships.length === 1) {
      redirect(`/${portalMemberships[0].tenant.slug}/portal`);
    }
    redirect("/investor");
  }

  // Mixed roles or staff: default to first staff org (existing behaviour)
  const first = staffMemberships[0] ?? memberships[0];
  if (first?.tenant.slug) {
    redirect(`/${first.tenant.slug}`);
  }

  redirect("/");
}
