import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { airbnbAppConfigured, airbnbAuthorizeUrl } from "@/lib/channels/airbnb/client";
import { signAirbnbState } from "@/lib/channels/airbnb/state";
import prisma from "@/lib/db";
import { canManageShortLets } from "@/lib/shortlets-access";
import { MembershipRole, MembershipStatus } from "@/generated/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("tenantSlug")?.trim() || "";
  const back = slug ? `/${slug}/shortlets/channels` : "/";
  const session = await auth();
  if (!session?.user?.id || !slug) {
    return NextResponse.redirect(new URL(`${back}?airbnb=signin`, request.url));
  }
  if (!airbnbAppConfigured()) {
    return NextResponse.redirect(new URL(`${back}?airbnb=unconfigured`, request.url));
  }
  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (!tenant) return NextResponse.redirect(new URL(`${back}?airbnb=missing`, request.url));
  const membership = await prisma.membership.findUnique({
    where: { tenantId_userId: { tenantId: tenant.id, userId: session.user.id } },
    select: { status: true, role: true, modulePermissions: true },
  });
  const allowed = canManageShortLets({
    isPlatformAdmin: Boolean(session.user.isPlatformAdmin),
    membership: membership as {
      status: MembershipStatus;
      role: MembershipRole;
      modulePermissions?: unknown;
    } | null,
  });
  if (!allowed) return NextResponse.redirect(new URL(`${back}?airbnb=forbidden`, request.url));
  const state = signAirbnbState({
    tenantId: tenant.id,
    userId: session.user.id,
    exp: Date.now() + 15 * 60 * 1000,
  });
  return NextResponse.redirect(airbnbAuthorizeUrl(state));
}
