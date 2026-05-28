import { auth } from "@/auth";
import { MembershipStatus } from "@/generated/prisma";
import prisma from "@/lib/db";
import Link from "next/link";
import { notFound } from "next/navigation";

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
    select: { id: true, name: true, slug: true },
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
          amount: true,
          balanceDue: true,
          currency: true,
        },
      },
    },
  });
  if (!payment) notFound();

  const isDirect = !payment.invoice;
  const sourceLabel = payment.invoice
    ? `${payment.invoice.invoiceNumber} - ${payment.invoice.title}`
    : payment.standaloneTitle || "Direct payment";

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:py-8">
      <div className="sticky top-0 z-20 -mx-4 mb-5 border-b border-foreground/10 bg-background/90 px-4 py-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:static sm:mb-6 sm:rounded-lg sm:border sm:px-4 sm:py-3 sm:shadow-none sm:backdrop-blur-0">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href={`/${tenantSlug}/finance/payments`}
            className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-foreground bg-foreground px-4 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90 sm:inline-flex sm:w-auto"
          >
            <span aria-hidden>←</span>
            Back to payments
          </Link>
          <p className="text-center text-[11px] text-muted sm:text-right">Or use your browser Back button.</p>
        </div>
      </div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">{isDirect ? "Direct Payment Receipt" : "Payment Receipt"}</h1>
      </div>
      <div className="rounded-lg border border-foreground/10 bg-background p-5">
        <p className="text-sm text-muted">{tenant.name}</p>
        <p className="mt-4 text-sm text-muted">Receipt ID</p>
        <p className="font-medium text-foreground">{payment.id}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted">{isDirect ? "Payment" : "Invoice"}</p>
            <p className="text-sm font-medium text-foreground">{sourceLabel}</p>
            {isDirect && payment.payerName ? (
              <p className="mt-0.5 text-xs text-muted">Payer: {payment.payerName}</p>
            ) : null}
          </div>
          <div>
            <p className="text-xs text-muted">Paid On</p>
            <p className="text-sm font-medium text-foreground">
              {new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(payment.paidAt)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted">Amount Received</p>
            <p className="text-sm font-medium text-foreground">
              {payment.currency} {Number(payment.amount).toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted">Recorded By</p>
            <p className="text-sm font-medium text-foreground">{payment.recordedByLabel || "Unknown"}</p>
          </div>
          <div>
            <p className="text-xs text-muted">Method</p>
            <p className="text-sm font-medium text-foreground">{payment.method || "Not specified"}</p>
          </div>
          <div>
            <p className="text-xs text-muted">Reference</p>
            <p className="text-sm font-medium text-foreground">{payment.reference || "Not specified"}</p>
          </div>
        </div>
        <div className="mt-4">
          <p className="text-xs text-muted">Attachment</p>
          {payment.attachmentUrl ? (
            <a
              href={payment.attachmentUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium text-foreground underline decoration-foreground/30 underline-offset-2"
            >
              {payment.attachmentName || "Open receipt attachment"}
            </a>
          ) : (
            <p className="text-sm font-medium text-foreground">No attachment</p>
          )}
        </div>
        {payment.invoice ? (
          <div className="mt-5 border-t border-foreground/10 pt-4">
            <p className="text-xs text-muted">Invoice Remaining Balance</p>
            <p className="text-base font-semibold text-foreground">
              {payment.invoice.currency} {Number(payment.invoice.balanceDue).toLocaleString()}
            </p>
          </div>
        ) : null}
      </div>
      <p className="mt-3 text-xs text-muted">Use browser print to save this receipt as PDF.</p>
    </div>
  );
}
