import { MembershipRole, PayrollFundingStatus } from "@/generated/prisma";
import { absoluteAppUrl } from "@/lib/app-url";
import prisma from "@/lib/db";
import { sendFundingReceivedEmail } from "@/lib/email";
import { isFinanceAlertRecipient } from "@/lib/membership-departments";
import { normalizeNuban } from "./bank-account";
import {
  paystackCustomerId,
  paystackFetchTransaction,
  paystackListDedicatedAccounts,
  paystackListSuccessfulTransactions,
} from "./paystack";
import {
  matchDedicatedAccountTenant,
  parseDedicatedAccountCredit,
  type DedicatedAccountCredit,
} from "./dedicated-account-credit";
import { submitFundingReceipt, verifyFundingReceipt } from "./funding";
import { getAvailableBalanceNaira, PayrollLedgerError, type LedgerTx } from "./ledger";
import { koboToNairaString } from "./money";
import { parsePayrollDisbursementSettings } from "./settings";

const PAYSTACK_ACTOR = { userId: "paystack", label: "Paystack" };

async function creditTenantFloat(tx: LedgerTx, tenantId: string, credit: DedicatedAccountCredit) {
  const paymentReference = credit.reference.replace(/\s+/g, " ").toUpperCase();
  let receipt = await tx.payrollFundingReceipt.findFirst({
    where: { tenantId, paymentReference },
  });

  if (!receipt) {
    try {
      receipt = await submitFundingReceipt(tx, {
        tenantId,
        amountNaira: koboToNairaString(credit.amountKobo),
        paymentReference,
        currency: credit.currency || "NGN",
        senderName: credit.senderName || undefined,
        senderBank: credit.senderBank || undefined,
        bankReceivedAt: credit.paidAt,
        notes: credit.accountNumber
          ? `Paystack dedicated account ${credit.accountNumber}`
          : "Paystack dedicated account",
        actor: PAYSTACK_ACTOR,
      });
    } catch (err) {
      if (!(err instanceof PayrollLedgerError) || !/already exists/i.test(err.message)) throw err;
      receipt = await tx.payrollFundingReceipt.findFirst({
        where: { tenantId, paymentReference },
      });
    }
  }

  if (!receipt) throw new PayrollLedgerError("Funding receipt was not created.");
  if (receipt.status === PayrollFundingStatus.VERIFIED) return { created: false as const };

  await verifyFundingReceipt(tx, {
    tenantId,
    receiptId: receipt.id,
    actor: PAYSTACK_ACTOR,
  });
  return { created: true as const };
}

function moneyLabel(currency: string, naira: string) {
  const [whole, frac = "00"] = naira.split(".");
  const grouped = Number(whole).toLocaleString("en-NG");
  return currency === "NGN" ? `₦${grouped}.${frac}` : `${currency} ${grouped}.${frac}`;
}

async function alertFinanceTeam(tenantId: string, credit: DedicatedAccountCredit) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true, slug: true },
  });
  if (!tenant) return;

  const memberships = await prisma.membership.findMany({
    where: { tenantId, status: "ACTIVE" },
    select: {
      role: true,
      department: true,
      user: { select: { email: true } },
    },
  });
  const emailsFor = (pick: (member: (typeof memberships)[number]) => boolean) => [
    ...new Set(
      memberships
        .filter(pick)
        .map((member) => member.user.email?.trim().toLowerCase())
        .filter((email): email is string => Boolean(email)),
    ),
  ];
  const financeRecipients = emailsFor((member) => isFinanceAlertRecipient(member));
  const recipients =
    financeRecipients.length > 0
      ? financeRecipients
      : emailsFor((member) => member.role === MembershipRole.ORG_ADMIN);
  if (recipients.length === 0) return;

  const balance = await getAvailableBalanceNaira(prisma, tenantId);
  const currency = credit.currency || "NGN";
  const payload = {
    tenantName: tenant.name,
    amountLabel: moneyLabel(currency, koboToNairaString(credit.amountKobo)),
    balanceLabel: moneyLabel(currency, balance),
    senderName: credit.senderName,
    senderBank: credit.senderBank,
    accountNumber: credit.accountNumber,
    reference: credit.reference,
    floatUrl: absoluteAppUrl(`/${tenant.slug}/hr/payslips`),
  };

  await Promise.all(
    recipients.map(async (to) => {
      const sent = await sendFundingReceivedEmail({ to, ...payload });
      if (!sent.ok) console.error("[paystack-funding-mail]", to, sent.error);
    }),
  );
}

async function postDedicatedCredit(tenantId: string, credit: DedicatedAccountCredit) {
  const posted = await prisma.$transaction((tx) => creditTenantFloat(tx, tenantId, credit));
  if (posted.created) {
    try {
      await alertFinanceTeam(tenantId, credit);
    } catch (err) {
      console.error("[paystack-funding-mail]", err);
    }
  }
  return posted;
}

function accountDigits(raw: string) {
  const parsed = normalizeNuban(raw);
  return parsed.ok ? parsed.accountNumber : "";
}

/** Paystack's payment list often omits the receiving account. The saved NUBAN is enough to find it. */
async function findCustomerForDedicatedAccount(accountNumber: string) {
  const target = accountDigits(accountNumber);
  if (!target) return null;
  for (let page = 1; page <= 5; page += 1) {
    const listed = await paystackListDedicatedAccounts(page);
    if (!listed.ok) return null;
    const batch = Array.isArray(listed.data) ? listed.data : [];
    for (const row of batch) {
      if (accountDigits(String(row.account_number || "")) !== target) continue;
      const customer =
        row.customer && typeof row.customer === "object"
          ? (row.customer as Record<string, unknown>)
          : null;
      const id = typeof customer?.id === "number" ? customer.id : Number(customer?.id);
      const customerCode = typeof customer?.customer_code === "string" ? customer.customer_code.trim() : "";
      if (!Number.isFinite(id)) continue;
      return { id, customerCode };
    }
    if (batch.length < 50) break;
  }
  return null;
}

async function readDedicatedCredit(item: Record<string, unknown>) {
  const parsed = parseDedicatedAccountCredit("charge.success", item);
  if (parsed?.accountNumber) return parsed;
  const id = typeof item.id === "number" ? item.id : Number(item.id);
  if (!Number.isFinite(id)) return parsed;
  const channel = typeof item.channel === "string" ? item.channel : "";
  if (parsed || channel === "dedicated_nuban") {
    const full = await paystackFetchTransaction(id);
    if (full.ok) return parseDedicatedAccountCredit("charge.success", full.data) || parsed;
  }
  return parsed;
}

/** Pull recent dedicated-account payments so money already in Paystack shows on the float. */
export async function syncTenantDedicatedAccountCredits(tenantId: string) {
  const row = await prisma.tenantSettings.findUnique({
    where: { tenantId },
    select: { payrollDisbursementSettings: true },
  });
  const settings = parsePayrollDisbursementSettings(row?.payrollDisbursementSettings);
  if (!settings.dvaAccountNumber && !settings.dvaCustomerCode) {
    return { ok: true as const, credited: 0 };
  }

  let customerId: number | undefined;
  let resolvedCustomerCode = settings.dvaCustomerCode || "";
  if (settings.dvaCustomerCode) {
    const customer = await paystackCustomerId(settings.dvaCustomerCode);
    if (customer.ok) customerId = customer.data.id;
  }
  if (!customerId && settings.dvaAccountNumber) {
    const found = await findCustomerForDedicatedAccount(settings.dvaAccountNumber);
    if (found) {
      customerId = found.id;
      resolvedCustomerCode = found.customerCode || resolvedCustomerCode;
    }
  }

  const matchSettings = resolvedCustomerCode
    ? { ...settings, dvaCustomerCode: resolvedCustomerCode }
    : settings;
  const savedAccount = accountDigits(settings.dvaAccountNumber || "");

  const collected: Record<string, unknown>[] = [];
  for (let page = 1; page <= 3; page += 1) {
    const listed = await paystackListSuccessfulTransactions({ page, perPage: 50, customerId });
    if (!listed.ok) {
      console.error("[paystack-dva-sync]", listed.error);
      return { ok: false as const, error: listed.error, credited: 0 };
    }
    const batch = Array.isArray(listed.data) ? listed.data : [];
    collected.push(...batch);
    if (customerId || batch.length < 50) break;
  }

  let credited = 0;
  for (const item of collected) {
    const parsed = await readDedicatedCredit(item);
    if (!parsed) continue;
    const credit = {
      ...parsed,
      customerCode: parsed.customerCode || resolvedCustomerCode,
      accountNumber: parsed.accountNumber || (customerId ? savedAccount : ""),
    };
    const match = matchDedicatedAccountTenant(credit, [{ tenantId, settings: matchSettings }]);
    if (!match.ok) continue;
    const posted = await postDedicatedCredit(tenantId, credit);
    if (posted.created) credited += 1;
  }
  return { ok: true as const, credited };
}

export async function applyPaystackDedicatedAccountWebhook(input: {
  event: string;
  data?: Record<string, unknown>;
}): Promise<{ ok: true; handled: boolean } | { ok: false; error: string }> {
  const credit = parseDedicatedAccountCredit(input.event, input.data);
  if (!credit) return { ok: true, handled: false };

  const rows = await prisma.tenantSettings.findMany({
    select: { tenantId: true, payrollDisbursementSettings: true },
  });
  const match = matchDedicatedAccountTenant(
    credit,
    rows.map((row) => ({
      tenantId: row.tenantId,
      settings: parsePayrollDisbursementSettings(row.payrollDisbursementSettings),
    })),
  );
  if (!match.ok) return { ok: true, handled: false };

  try {
    await postDedicatedCredit(match.tenantId, credit);
    return { ok: true, handled: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not credit dedicated account payment.";
    return { ok: false, error: message };
  }
}
