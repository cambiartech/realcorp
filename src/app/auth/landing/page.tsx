import { redirect } from "next/navigation";
import { auth } from "@/auth";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AuthLandingPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  if (session.user.isPlatformAdmin) {
    redirect("/platform");
  }

  const membership = await prisma.membership.findFirst({
    where: {
      userId: session.user.id,
      status: "ACTIVE",
    },
    orderBy: { createdAt: "asc" },
    select: {
      tenant: {
        select: { slug: true },
      },
    },
  });

  if (membership?.tenant.slug) {
    redirect(`/${membership.tenant.slug}`);
  }

  redirect("/");
}
