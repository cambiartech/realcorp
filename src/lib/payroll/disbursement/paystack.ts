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

export type PaystackBank = {
  name: string;
  code: string;
  slug?: string;
};

export async function paystackListBanks(): Promise<PaystackResult<PaystackBank[]>> {
  const banks: PaystackBank[] = [];
  for (let page = 1; page <= 8; page += 1) {
    const listed = await paystackFetch<PaystackBank[]>(
      `/bank?country=nigeria&perPage=100&page=${page}`,
    );
    if (!listed.ok) {
      if (page === 1) return listed;
      break;
    }
    const batch = Array.isArray(listed.data) ? listed.data : [];
    for (const bank of batch) {
      if (!bank?.name || !bank.code) continue;
      banks.push({ name: bank.name, code: String(bank.code), slug: bank.slug });
    }
    if (batch.length < 100) break;
  }
  return { ok: true, data: banks };
}

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

export async function paystackListSuccessfulTransactions(input?: {
  page?: number;
  perPage?: number;
  customerId?: number;
}): Promise<PaystackResult<Record<string, unknown>[]>> {
  const q = new URLSearchParams({
    status: "success",
    perPage: String(input?.perPage ?? 50),
    page: String(input?.page ?? 1),
  });
  if (input?.customerId) q.set("customer", String(input.customerId));
  return paystackFetch<Record<string, unknown>[]>(`/transaction?${q.toString()}`);
}

export async function paystackCustomerId(customerCode: string): Promise<PaystackResult<{ id: number }>> {
  return paystackFetch<{ id: number }>(`/customer/${encodeURIComponent(customerCode)}`);
}

export async function paystackListDedicatedAccounts(
  page = 1,
): Promise<PaystackResult<Record<string, unknown>[]>> {
  const q = new URLSearchParams({ perPage: "50", page: String(page) });
  return paystackFetch<Record<string, unknown>[]>(`/dedicated_account?${q.toString()}`);
}

export async function paystackFetchTransaction(
  id: number,
): Promise<PaystackResult<Record<string, unknown>>> {
  return paystackFetch<Record<string, unknown>>(`/transaction/${id}`);
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
