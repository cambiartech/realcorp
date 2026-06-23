import { auth } from "@/auth";
import { MembershipStatus } from "@/generated/prisma";
import prisma from "@/lib/db";
import { parseBankAccounts } from "@/lib/finance-bank-accounts";
import { normalizeFinanceOptionList } from "@/lib/finance-catalog";
import { brandingFromSettings } from "@/lib/tenant-branding";
import Link from "next/link";
import { notFound } from "next/navigation";
import { InvoicePrintClient } from "./invoice-print-client";

export const dynamic = "force-dynamic";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; invoiceId: string }>;
}) {
  const { tenantSlug, invoiceId } = await params;
  const session = await auth();
  if (!session?.user?.id) notFound();

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: {
      id: true,
      name: true,
      settings: {
        select: {
          logoUrl: true,
          primaryColor: true,
          accentColor: true,
          orgEmail: true,
          orgPhone: true,
          orgAddressLine: true,
          orgCity: true,
          orgState: true,
          orgCountry: true,
          financeBankAccounts: true,
        },
      },
    },
  });
  if (!tenant) notFound();

  const membership = await prisma.membership.findUnique({
    where: { tenantId_userId: { tenantId: tenant.id, userId: session.user.id } },
    select: { status: true },
  });
  const canView = Boolean(session.user.isPlatformAdmin) || membership?.status === MembershipStatus.ACTIVE;
  if (!canView) notFound();

  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, tenantId: tenant.id },
    include: {
      deal: {
        select: {
          lead: { select: { name: true } },
          propertyClient: { select: { fullName: true } },
        },
      },
    },
  });
  if (!invoice) notFound();

  const brand = brandingFromSettings(tenant.name, tenant.settings);
  const customerName =
    invoice.deal?.propertyClient?.fullName || invoice.deal?.lead?.name || "—";

  const bankLines = normalizeFinanceOptionList(tenant.settings?.financeBankAccounts);
  const bankAccounts = parseBankAccounts(bankLines);
  const paymentInstructions =
    bankAccounts.length > 0
      ? bankAccounts.map((a) => `${a.bankName} · ${a.accountName} · ${a.accountNumber}`)
      : [];

  const fmtMoney = (n: number) =>
    `${invoice.currency} ${n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link
          href={`/${tenantSlug}/finance/invoices`}
          className="text-sm text-muted underline decoration-foreground/30 hover:text-foreground"
        >
          ← Back to invoices
        </Link>
        {invoice.pdfUrl ? (
          <a href={invoice.pdfUrl} target="_blank" rel="noreferrer" className="text-sm font-semibold text-foreground underline">
            Download PDF
          </a>
        ) : null}
      </div>

      <InvoicePrintClient
        brand={brand}
        invoiceNumber={invoice.invoiceNumber}
        title={invoice.title}
        customerName={customerName}
        amountLabel={fmtMoney(Number(invoice.amount))}
        balanceLabel={fmtMoney(Number(invoice.balanceDue))}
        issuedAtLabel={new Intl.DateTimeFormat("en-NG", { dateStyle: "long" }).format(invoice.issuedAt)}
        dueDateLabel={
          invoice.dueDate
            ? new Intl.DateTimeFormat("en-NG", { dateStyle: "long" }).format(invoice.dueDate)
            : "On receipt"
        }
        department={invoice.department}
        paymentInstructions={paymentInstructions}
        sentToEmail={invoice.sentToEmail}
        sentAtLabel={
          invoice.sentAt
            ? new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(invoice.sentAt)
            : null
        }
      />
    </div>
  );
}
