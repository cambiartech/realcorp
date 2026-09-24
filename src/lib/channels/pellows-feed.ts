import { createHmac, randomBytes } from "crypto";

export type PellowsEventName = "unit.upserted" | "unit.archived" | "block.changed";

export function parseUpdatedSince(value: string | null): Date | null | "invalid" {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "invalid";
  return date;
}

export function signPellowsBody(body: string, secret: string): string {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

export function newPellowsEventId(): string {
  return `evt_${randomBytes(12).toString("hex")}`;
}

export function pellowsWebhookUrl(): string {
  return process.env.PELLOWS_WEBHOOK_URL || "https://pellows.stay/api/webhooks/realcorp";
}
