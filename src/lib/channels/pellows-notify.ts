import { ChannelProvider } from "@/generated/prisma";
import prisma from "@/lib/db";
import { loadChannelUnits } from "@/lib/channels/load-units";
import {
  newPellowsEventId,
  pellowsWebhookUrl,
  signPellowsBody,
  type PellowsEventName,
} from "@/lib/channels/pellows-feed";

const ATTEMPTS = 2;

export async function notifyPellowsUnit(input: {
  tenantId: string;
  unitId: string;
  event: PellowsEventName;
}): Promise<void> {
  const secret = process.env.PELLOWS_WEBHOOK_SECRET;
  if (!secret) return;

  try {
    const connection = await prisma.channelConnection.findUnique({
      where: { tenantId_provider: { tenantId: input.tenantId, provider: ChannelProvider.PELLOWS } },
      select: { status: true, tenant: { select: { defaultTimezone: true } } },
    });
    if (connection?.status !== "ACTIVE") return;

    const units = await loadChannelUnits(input.tenantId, connection.tenant.defaultTimezone || "Africa/Lagos", {
      unitId: input.unitId,
    });
    const unit = units[0];
    if (!unit) return;

    const event = unit.archived ? "unit.archived" : input.event;
    const body = JSON.stringify({
      eventId: newPellowsEventId(),
      tenantId: input.tenantId,
      event,
      unit,
    });
    await postSigned(body, secret);
  } catch (error) {
    console.error("[pellows] notify failed", error);
  }
}

async function postSigned(body: string, secret: string): Promise<void> {
  const url = pellowsWebhookUrl();
  const signature = signPellowsBody(body, secret);
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Realcorp-Signature": signature,
        },
        body,
        signal: AbortSignal.timeout(3000),
      });
      if (response.ok) return;
      console.error("[pellows] webhook", response.status);
    } catch (error) {
      console.error("[pellows] webhook attempt", attempt, error);
    }
  }
}
