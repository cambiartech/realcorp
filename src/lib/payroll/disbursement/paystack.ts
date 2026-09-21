/**
 * Paystack Transfers client — resolve NUBAN, create recipient, initiate transfer.
 * Server-only. Never import from client components.
 */

export type PaystackResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number };

function secretKey(): string | null {
  const key = process.env.PAYSTACK_SECRET_KEY?.trim();
  return key || null;
}

export function isPaystackConfigured(): boolean {
  return Boolean(secretKey());
}

async function paystackFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<PaystackResult<T>> {
  const key = secretKey();
  if (!key) {
    return { ok: false, error: "PAYSTACK_SECRET_KEY is not set." };
  }

  const res = await fetch(`https://api.paystack.co${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  let body: { status?: boolean; message?: string; data?: T } = {};
  try {
    body = (await res.json()) as typeof body;
  } catch {
    return { ok: false, error: `Paystack returned non-JSON (${res.status}).`, status: res.status };
  }

  if (!res.ok || body.status === false) {
    return {
      ok: false,
      error: body.message || `Paystack error (${res.status}).`,
      status: res.status,
    };
  }

  return { ok: true, data: body.data as T };
}

export type ResolvedAccount = {
  account_number: string;
  account_name: string;
  bank_id?: number;
};

export async function paystackResolveAccount(
  accountNumber: string,
  bankCode: string,
): Promise<PaystackResult<ResolvedAccount>> {
  const q = new URLSearchParams({
    account_number: accountNumber,
    bank_code: bankCode,
  });
  return paystackFetch<ResolvedAccount>(`/bank/resolve?${q.toString()}`);
}

export type TransferRecipient = {
  recipient_code: string;
  details?: { account_number?: string; account_name?: string; bank_code?: string };
};

export async function paystackCreateRecipient(input: {
  name: string;
  accountNumber: string;
  bankCode: string;
}): Promise<PaystackResult<TransferRecipient>> {
  return paystackFetch<TransferRecipient>("/transferrecipient", {
    method: "POST",
    body: JSON.stringify({
      type: "nuban",
      name: input.name,
      account_number: input.accountNumber,
      bank_code: input.bankCode,
      currency: "NGN",
    }),
  });
}

export type InitiatedTransfer = {
  transfer_code?: string;
  status?: string;
  reference?: string;
  amount?: number;
  id?: number;
};

export async function paystackInitiateTransfer(input: {
  amountKobo: number;
  recipientCode: string;
  reference: string;
  reason: string;
}): Promise<PaystackResult<InitiatedTransfer>> {
  return paystackFetch<InitiatedTransfer>("/transfer", {
    method: "POST",
    body: JSON.stringify({
      source: "balance",
      amount: input.amountKobo,
      recipient: input.recipientCode,
      reference: input.reference,
      reason: input.reason.slice(0, 50),
    }),
  });
}

export type PaystackBalanceRow = {
  currency: string;
  balance: number;
};

export async function paystackGetBalances(): Promise<PaystackResult<PaystackBalanceRow[]>> {
  return paystackFetch<PaystackBalanceRow[]>("/balance");
}

/** Verify Paystack webhook signature (HMAC SHA512 of raw body). */
export function verifyPaystackWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
): boolean {
  const secret = secretKey();
  if (!secret || !signatureHeader) return false;
  // Use Web Crypto when available; Node crypto for server.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const crypto = require("crypto") as typeof import("crypto");
  const hash = crypto.createHmac("sha512", secret).update(rawBody).digest("hex");
  return hash === signatureHeader;
}
