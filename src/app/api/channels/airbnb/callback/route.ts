import { NextResponse } from "next/server";
import { exchangeAirbnbCode } from "@/lib/channels/airbnb/client";
import { readAirbnbState } from "@/lib/channels/airbnb/state";
import { sealToken } from "@/lib/channels/airbnb/crypto";
import { syncAirbnbTenant } from "@/lib/channels/airbnb/sync";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code")?.trim() || "";
  const state = readAirbnbState(url.searchParams.get("state") || "");
  const denied = url.searchParams.get("error");
  if (!state) {
    return NextResponse.redirect(new URL("/?airbnb=state", request.url));
  }
  const tenant = await prisma.tenant.findUnique({
    where: { id: state.tenantId },
    select: { slug: true },
  });
  const back = tenant ? `/${tenant.slug}/shortlets/channels` : "/";
  if (denied || !code) {
    return NextResponse.redirect(new URL(`${back}?airbnb=denied`, request.url));
  }
  try {
    const tokens = await exchangeAirbnbCode(code);
    await prisma.airbnbHostLink.upsert({
      where: { tenantId: state.tenantId },
      create: {
        tenantId: state.tenantId,
        airbnbUserId: tokens.userId,
        accessTokenCipher: sealToken(tokens.accessToken || ""),
        refreshTokenCipher: tokens.refreshToken ? sealToken(tokens.refreshToken) : null,
        expiresAt: tokens.expiresAt,
        status: "ACTIVE",
        createdByUserId: state.userId,
        lastError: null,
      },
      update: {
        airbnbUserId: tokens.userId,
        accessTokenCipher: sealToken(tokens.accessToken || ""),
        refreshTokenCipher: tokens.refreshToken ? sealToken(tokens.refreshToken) : null,
        expiresAt: tokens.expiresAt,
        status: "ACTIVE",
        createdByUserId: state.userId,
        lastError: null,
      },
    });
    const synced = await syncAirbnbTenant(state.tenantId);
    const flag = synced.ok ? "connected" : "sync";
    return NextResponse.redirect(new URL(`${back}?airbnb=${flag}`, request.url));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Airbnb did not connect.";
    if (tenant) {
      await prisma.airbnbHostLink.updateMany({
        where: { tenantId: state.tenantId },
        data: { lastError: message.slice(0, 300) },
      });
    }
    return NextResponse.redirect(new URL(`${back}?airbnb=failed`, request.url));
  }
}
