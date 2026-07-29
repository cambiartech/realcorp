import { OfferLetterSignClient } from "@/components/hr/offer-letter-sign-client";
import { HrOfferLetterStatus } from "@/generated/prisma";
import prisma from "@/lib/db";
import { brandingFromSettings } from "@/lib/tenant-branding";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function HrOfferSignPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const offer = await prisma.hrOfferLetter.findUnique({
    where: { token },
    include: {
      profile: { select: { fullName: true } },
      tenant: {
        select: {
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
      },
    },
  });
  if (!offer) notFound();
  if (
    offer.tokenExpiresAt &&
    offer.tokenExpiresAt < new Date() &&
    offer.status !== HrOfferLetterStatus.SIGNED
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-center text-sm text-slate-600">
        This offer link has expired. Contact HR for a new link.
      </div>
    );
  }

  const brand = brandingFromSettings(offer.tenant.name, offer.tenant.settings);
  const signedAtLabel = offer.candidateSignedAt
    ? new Intl.DateTimeFormat("en-NG", { dateStyle: "long", timeStyle: "short" }).format(
        offer.candidateSignedAt,
      )
    : undefined;

  return (
    <OfferLetterSignClient
      brand={brand}
      bodyHtml={offer.bodyHtml}
      token={token}
      employeeName={offer.profile.fullName || "there"}
      alreadySigned={offer.status === HrOfferLetterStatus.SIGNED}
      signedAtLabel={signedAtLabel}
      signaturePreview={offer.candidateSignature}
    />
  );
}
