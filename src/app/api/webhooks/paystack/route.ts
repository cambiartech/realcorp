import { NextResponse } from "next/server";
import {
  applyPaystackTransferWebhook,
  verifyPaystackWebhookSignature,
} from "@/lib/payroll/disbursement";
import { applyPaystackDedicatedAccountWebhook } from "@/lib/payroll/disbursement/dedicated-account-post";

export const dynamic = "force-dynamic";

/**
 * Paystack webhook.
 * Dashboard → Settings → API Keys & Webhooks → webhook URL:
 *   https://<host>/api/webhooks/paystack
 * transfer.* finalizes salary payouts.
 * charge.success on a dedicated NUBAN credits the org float when that account
 * is saved on the tenant in platform admin.
 */
export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-paystack-signature");

  if (!(process.env.PAYSTACK_SKIP_WEBHOOK_VERIFY === "1")) {
    if (!verifyPaystackWebhookSignature(rawBody, signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  let payload: { event?: string; data?: Record<string, unknown> };
  try {
    payload = JSON.parse(rawBody) as typeof payload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const event = payload.event || "";
  if (event === "charge.success") {
    const credited = await applyPaystackDedicatedAccountWebhook({
      event,
      data: payload.data,
    });
    if (!credited.ok) {
      return NextResponse.json({ error: credited.error }, { status: 500 });
    }
    return NextResponse.json({ ok: true, handled: credited.handled, ignored: !credited.handled });
  }

  if (!event.startsWith("transfer.")) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const result = await applyPaystackTransferWebhook({
    event,
    data: payload.data as {
      reference?: string;
      transfer_code?: string;
      status?: string;
      id?: number;
      reason?: string;
      complete_message?: string;
    },
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, handled: result.handled });
}
