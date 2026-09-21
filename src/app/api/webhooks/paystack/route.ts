import { NextResponse } from "next/server";
import {
  applyPaystackTransferWebhook,
  verifyPaystackWebhookSignature,
} from "@/lib/payroll/disbursement";

export const dynamic = "force-dynamic";

/**
 * Paystack Transfers webhook.
 * Dashboard → Settings → API Keys & Webhooks → webhook URL:
 *   https://<host>/api/webhooks/paystack
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
