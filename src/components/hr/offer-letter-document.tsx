"use client";

import { BrandedDocumentShell } from "@/components/hr/branded-document-shell";
import { formatOfferDate, offerLetterBody, type OfferLetterFields } from "@/lib/offer-letter";
import type { TenantBranding } from "@/lib/tenant-branding";

export function OfferLetterDocument({
  brand,
  fields,
  issueDate,
}: {
  brand: TenantBranding;
  fields: OfferLetterFields;
  issueDate?: string;
}) {
  const body = offerLetterBody(fields, brand.companyName);
  const paragraphs = body.split("\n\n");

  return (
    <BrandedDocumentShell
      brand={brand}
      title="Offer of employment"
      subtitle={`Issued ${issueDate ?? formatOfferDate()}`}
      footerNote="Confidential — for the candidate named above"
    >
      <div className="space-y-4 text-sm leading-relaxed text-slate-800">
        {paragraphs.map((block, i) => {
          if (block.startsWith("•")) {
            return (
              <ul key={i} className="list-disc space-y-1 pl-5">
                {block.split("\n").map((line) => (
                  <li key={line}>{line.replace(/^•\s*/, "")}</li>
                ))}
              </ul>
            );
          }
          return (
            <p key={i} className="whitespace-pre-wrap">
              {block}
            </p>
          );
        })}
      </div>
      <div className="mt-10 grid gap-8 border-t border-slate-200 pt-6 sm:grid-cols-2 print:mt-16">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Candidate acceptance</p>
          <div className="mt-8 border-b border-slate-400" />
          <p className="mt-2 text-xs text-slate-600">Signature & date</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            For {brand.companyName}
          </p>
          <div className="mt-8 border-b border-slate-400" />
          <p className="mt-2 text-xs text-slate-600">Authorized signatory</p>
        </div>
      </div>
    </BrandedDocumentShell>
  );
}
