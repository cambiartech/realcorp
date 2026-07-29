"use client";

import { useState } from "react";
import { BrandedDocumentShell } from "@/components/hr/branded-document-shell";
import { SignaturePad } from "@/components/hr/signature-pad";
import type { TenantBranding } from "@/lib/tenant-branding";
import { brandingCssVars } from "@/lib/tenant-branding";

export function OfferLetterSignClient({
  brand,
  bodyHtml,
  token,
  employeeName,
  alreadySigned,
  signedAtLabel,
  signaturePreview,
}: {
  brand: TenantBranding;
  bodyHtml: string;
  token: string;
  employeeName: string;
  alreadySigned: boolean;
  signedAtLabel?: string;
  signaturePreview?: string | null;
}) {
  const [signature, setSignature] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(alreadySigned);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!signature) {
      setError("Draw your signature above.");
      return;
    }
    setPending(true);
    setError(null);
    const { signOfferLetterOnline } = await import("@/app/hr-offer/[token]/actions");
    const result = await signOfferLetterOnline(token, signature);
    setPending(false);
    if (!result.ok) {
      setError(result.error || "Could not submit.");
      return;
    }
    setDone(true);
  }

  return (
    <div className="min-h-screen bg-slate-50 py-6 px-4" style={brandingCssVars(brand)}>
      <div className="mx-auto max-w-3xl">
        <BrandedDocumentShell brand={brand} title="Offer of employment" subtitle={`Hello, ${employeeName}`}>
          <div
            className="space-y-3 text-sm leading-relaxed text-slate-800"
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
          />

          {done ? (
            <div className="mt-8 rounded-lg border border-[var(--success-line)] bg-[var(--success-wash)] p-4 text-sm text-[var(--success)]">
              <p className="font-semibold">Thank you — your signed offer was received.</p>
              {signedAtLabel ? <p className="mt-1 text-xs">Signed {signedAtLabel}</p> : null}
              {signaturePreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={signaturePreview} alt="Your signature" className="mt-3 h-16 object-contain" />
              ) : null}
            </div>
          ) : (
            <div className="mt-8 border-t border-slate-200 pt-6">
              <p className="text-sm font-semibold text-slate-800">Sign to accept this offer</p>
              <p className="mt-1 text-xs text-slate-600">Use your finger or mouse in the box below.</p>
              <div className="mt-3">
                <SignaturePad onChange={setSignature} />
              </div>
              {error ? <p className="mt-2 text-xs text-[var(--danger)]">{error}</p> : null}
              <button
                type="button"
                disabled={pending}
                onClick={() => void submit()}
                className="mt-4 w-full rounded-lg py-3 text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: "var(--hr-brand-primary)" }}
              >
                {pending ? "Submitting…" : "Submit signed offer"}
              </button>
            </div>
          )}
        </BrandedDocumentShell>
      </div>
    </div>
  );
}
