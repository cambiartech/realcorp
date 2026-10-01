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
): Promise<PaystackFetchResult<T>> {
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

  let body: { status?: boolean; message?: string; data?: T; meta?: { next?: string | null } } = {};
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

  return { ok: true, data: body.data as T, next: body.meta?.next ?? null };
}

type PaystackFetchResult<T> = PaystackResult<T> & { next?: string | null };

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
  let cursor: string | null = null;
  for (let page = 0; page < 20; page += 1) {
    const q = new URLSearchParams({
      country: "nigeria",
      perPage: "100",
      use_cursor: "true",
    });
    if (cursor) q.set("next", cursor);
    const listed = await paystackFetch<PaystackBank[]>(`/bank?${q.toString()}`);
    if (!listed.ok) {
      if (page === 0) return listed;
      break;
    }
    const batch = Array.isArray(listed.data) ? listed.data : [];
    for (const bank of batch) {
      if (!bank?.name || !bank.code) continue;
      banks.push({ name: bank.name, code: String(bank.code), slug: bank.slug });
    }
    if (!listed.next || listed.next === cursor) break;
    cursor = listed.next;
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

export type BulkTransferItem = {
  reference?: string;
  transfer_code?: string;
  status?: string;
  id?: number;
  reason?: string;
};

/** One Paystack request for a whole payroll. OTP must be off on the Paystack account. Max 100. */
export async function paystackInitiateBulkTransfer(input: {
  transfers: Array<{
    amountKobo: number;
    recipientCode: string;
    reference: string;
    reason: string;
  }>;
}): Promise<PaystackResult<BulkTransferItem[]>> {
  return paystackFetch<BulkTransferItem[]>("/transfer/bulk", {
    method: "POST",
    body: JSON.stringify({
      currency: "NGN",
      source: "balance",
      transfers: input.transfers.map((transfer) => ({
        amount: transfer.amountKobo,
        recipient: transfer.recipientCode,
        reference: transfer.reference,
        reason: transfer.reason.slice(0, 50),
      })),
    }),
  });
}

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

/** Complete a transfer Paystack held at status `otp`. Code goes to the Paystack business phone. */
export async function paystackFinalizeTransfer(
  transferCode: string,
  otp: string,
): Promise<PaystackResult<InitiatedTransfer>> {
  return paystackFetch<InitiatedTransfer>("/transfer/finalize_transfer", {
    method: "POST",
    body: JSON.stringify({ transfer_code: transferCode, otp }),
  });
}

export async function paystackResendTransferOtp(
  transferCode: string,
): Promise<PaystackResult<{ message?: string }>> {
  return paystackFetch<{ message?: string }>("/transfer/resend_otp", {
    method: "POST",
    body: JSON.stringify({ transfer_code: transferCode, reason: "transfer" }),
  });
}

export type PaystackBalanceRow = {
  currency: string;
  balance: number;
};

export async function paystackGetBalances(): Promise<PaystackResult<PaystackBalanceRow[]>> {
  return paystackFetch<PaystackBalanceRow[]>("/balance");
}

export async function paystackGetNgnBalanceKobo(): Promise<
  { ok: true; balanceKobo: number } | { ok: false; error: string }
> {
  const balances = await paystackGetBalances();
  if (!balances.ok) return balances;
  const ngn = (balances.data || []).find((row: PaystackBalanceRow) => row.currency === "NGN");
  return { ok: true, balanceKobo: Math.max(0, Math.trunc(ngn?.balance ?? 0)) };
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
