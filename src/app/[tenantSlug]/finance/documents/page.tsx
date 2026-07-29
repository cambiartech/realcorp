import { auth } from "@/auth";
import { MembershipStatus } from "@/generated/prisma";
import { FinanceDocumentsWorkspace } from "@/components/finance/finance-documents-workspace";
import { assertTenantNavAccess } from "@/lib/guard-tenant-nav";
import prisma from "@/lib/db";
import { formatEnumLabel } from "@/lib/ui-format";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function FinanceDocumentsPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const session = await auth();
  if (!session?.user?.id) notFound();

  const tenant = await prisma.tenant.findUnique({
    where: { slug: tenantSlug },
    select: {
      id: true,
      settings: {
        select: {
          moduleSales: true,
          moduleFinance: true,
          moduleMarketing: true,
          moduleCommunity: true,
          roleModuleGrants: true,
        },
      },
    },
  });
  if (!tenant) notFound();

  const membership = await prisma.membership.findUnique({
    where: { tenantId_userId: { tenantId: tenant.id, userId: session.user.id } },
    select: { status: true, role: true },
  });
  assertTenantNavAccess(session, membership, tenant.settings, "finance");

  if (membership?.status !== MembershipStatus.ACTIVE && !session.user.isPlatformAdmin) notFound();

  const documents = await prisma.financeDocument.findMany({
    where: { tenantId: tenant.id },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      salesReceipt: { select: { receiptNumber: true } },
      invoice: { select: { invoiceNumber: true } },
    },
  });

  return (
    <div className="w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <FinanceDocumentsWorkspace
        tenantSlug={tenantSlug}
        documents={documents.map((doc) => ({
          id: doc.id,
          title: doc.title,
          category: formatEnumLabel(doc.category),
          fileUrl: doc.fileUrl,
          fileName: doc.fileName,
          createdAtLabel: new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(doc.createdAt),
          receiptNumber: doc.salesReceipt?.receiptNumber ?? null,
        }))}
      />
    </div>
  );
}
