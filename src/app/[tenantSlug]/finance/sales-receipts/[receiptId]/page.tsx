import { auth } from "@/auth";
import { MembershipStatus } from "@/generated/prisma";
import prisma from "@/lib/db";
import { brandingFromSettings } from "@/lib/tenant-branding";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SalesReceiptPrintClient } from "./sales-receipt-print-client";

export const dynamic = "force-dynamic";

export default async function SalesReceiptDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; receiptId: string }>;
}) {
  const { tenantSlug, receiptId } = await params;
  const session = await auth();
  if (!session?.user?.id) notFound();

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: {
      id: true,
      name: true,
      slug: true,
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

  const receipt = await prisma.salesReceipt.findFirst({
    where: { id: receiptId, tenantId: tenant.id },
    include: {
      deal: {
        select: {
          lead: { select: { name: true, email: true } },
          propertyClient: { select: { fullName: true, email: true } },
        },
      },
    },
  });
  if (!receipt) notFound();

  const brand = brandingFromSettings(tenant.name, tenant.settings);
  const customerName =
    receipt.customerName ||
    receipt.deal?.propertyClient?.fullName ||
    receipt.deal?.lead?.name ||
    "—";

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link
          href={`/${tenantSlug}/finance/sales-receipts`}
          className="text-sm text-muted underline decoration-foreground/30 hover:text-foreground"
        >
          ← Back to sales receipts
        </Link>
        {receipt.pdfUrl ? (
          <a
            href={receipt.pdfUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-semibold text-foreground underline"
          >
            Download PDF
          </a>
        ) : null}
      </div>

      <SalesReceiptPrintClient
        brand={brand}
        receiptNumber={receipt.receiptNumber}
        title={receipt.title}
        customerName={customerName}
        amountLabel={`${receipt.currency} ${Number(receipt.amount).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        paymentMode={receipt.paymentMode || "—"}
        depositAccount={receipt.depositAccount || "—"}
        reference={receipt.reference || "—"}
        note={receipt.note}
        issuedAtLabel={new Intl.DateTimeFormat("en-NG", { dateStyle: "long" }).format(receipt.issuedAt)}
        recordedBy={receipt.createdByLabel || "—"}
        sentToEmail={receipt.sentToEmail}
        sentAtLabel={
          receipt.sentAt
            ? new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(receipt.sentAt)
            : null
        }
      />
    </div>
  );
}
