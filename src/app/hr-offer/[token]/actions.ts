"use server";

import { HrDocumentCategory, HrOfferLetterStatus } from "@/generated/prisma";
import prisma from "@/lib/db";
import { sanitizeOfferLetterHtml } from "@/lib/offer-letter-html";
import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";

type ActionResult = { ok: true } | { ok: false; error: string };

export async function signOfferLetterOnline(token: string, signatureDataUrl: string): Promise<ActionResult> {
  const sig = signatureDataUrl?.trim();
  if (!token?.trim()) return { ok: false, error: "Invalid link." };
  if (!sig?.startsWith("data:image/")) return { ok: false, error: "Draw your signature first." };

  const offer = await prisma.hrOfferLetter.findUnique({
    where: { token: token.trim() },
    include: { profile: { select: { fullName: true } }, tenant: { select: { slug: true } } },
  });
  if (!offer) return { ok: false, error: "This offer link is not valid." };
  if (offer.status === HrOfferLetterStatus.SIGNED) return { ok: true };
  if (offer.tokenExpiresAt && offer.tokenExpiresAt < new Date()) {
    return { ok: false, error: "This offer link has expired. Ask HR for a new one." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.hrOfferLetter.update({
      where: { id: offer.id },
      data: {
        status: HrOfferLetterStatus.SIGNED,
        candidateSignature: sig,
        candidateSignedAt: new Date(),
        signedSnapshotUrl: sig,
      },
    });
    await tx.hrDocument.create({
      data: {
        tenantId: offer.tenantId,
        employeeProfileId: offer.employeeProfileId,
        category: HrDocumentCategory.OFFER_LETTER,
        title: `Signed offer — ${offer.profile.fullName || "Employee"}`,
        fileUrl: sig,
        fileName: "offer-signature.png",
        uploadedByLabel: offer.profile.fullName || "Candidate",
      },
    });
  });

  revalidatePath(`/${offer.tenant.slug}/hr/people`);
  revalidatePath(`/${offer.tenant.slug}/hr/dashboard`);
  return { ok: true };
}
