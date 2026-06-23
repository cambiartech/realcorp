import { auth } from "@/auth";
import { MembershipStatus } from "@/generated/prisma";
import prisma from "@/lib/db";
import { brandingFromSettings } from "@/lib/tenant-branding";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PaymentReceiptPrintClient } from "./payment-receipt-print-client";

export const dynamic = "force-dynamic";

export default async function PaymentReceiptPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; paymentId: string }>;
}) {
  const { tenantSlug, paymentId } = await params;
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

  const payment = await prisma.paymentRecord.findFirst({
    where: { id: paymentId, tenantId: tenant.id },
    include: {
      invoice: {
        select: {
          invoiceNumber: true,
          title: true,
          balanceDue: true,
          currency: true,
        },
      },
    },
  });
  if (!payment) notFound();

  const brand = brandingFromSettings(tenant.name, tenant.settings);
  const isDirect = !payment.invoice;
  const title = payment.invoice
    ? `${payment.invoice.invoiceNumber} — ${payment.invoice.title}`
    : payment.standaloneTitle || "Direct payment";
  const customerName = payment.payerName || "—";
  const amountLabel = `${payment.currency} ${Number(payment.amount).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link
          href={`/${tenantSlug}/finance/payments`}
          className="text-sm text-muted underline decoration-foreground/30 hover:text-foreground"
        >
          ← Back to payments
        </Link>
      </div>

      <PaymentReceiptPrintClient
        brand={brand}
        receiptNumber={`PAY-${payment.id.slice(-8).toUpperCase()}`}
        title={title}
        customerName={customerName}
        amountLabel={amountLabel}
        paidAtLabel={new Intl.DateTimeFormat("en-NG", { dateStyle: "long" }).format(payment.paidAt)}
        paymentMode={payment.method || "Not specified"}
        reference={payment.reference || "Not specified"}
        recordedBy={payment.recordedByLabel || "Unknown"}
        invoiceBalanceLabel={
          payment.invoice
            ? `${payment.invoice.currency} ${Number(payment.invoice.balanceDue).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            : null
        }
        attachmentName={payment.attachmentName}
        attachmentUrl={payment.attachmentUrl}
      />
    </div>
  );
}
