import { auth } from "@/auth";
import { MembershipStatus } from "@/generated/prisma";
import prisma from "@/lib/db";
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

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">Payment Receipt</h1>
      </div>
      <div className="rounded-lg border border-foreground/10 bg-background p-5">
        <p className="text-sm text-muted">{tenant.name}</p>
        <p className="mt-4 text-sm text-muted">Receipt ID</p>
        <p className="font-medium text-foreground">{payment.id}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted">Invoice</p>
            <p className="text-sm font-medium text-foreground">
              {payment.invoice.invoiceNumber} - {payment.invoice.title}
            </p>
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
        <div className="mt-5 border-t border-foreground/10 pt-4">
          <p className="text-xs text-muted">Invoice Remaining Balance</p>
          <p className="text-base font-semibold text-foreground">
            {payment.invoice.currency} {Number(payment.invoice.balanceDue).toLocaleString()}
          </p>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted">Use browser print to save this receipt as PDF.</p>
    </div>
  );
}
