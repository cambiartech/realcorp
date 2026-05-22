"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BrandedDocumentShell } from "@/components/hr/branded-document-shell";
import { formatOfferDate, type OfferLetterFields } from "@/lib/offer-letter";
import { defaultOfferLetterHtml, sanitizeOfferLetterHtml } from "@/lib/offer-letter-html";
import type { TenantBranding } from "@/lib/tenant-branding";
import { saveOfferLetterDraft, sendOfferLetterForSignature } from "@/app/[tenantSlug]/hr/actions";
import { useSnackbar } from "@/components/snackbar";

export function OfferLetterEditor({
  tenantSlug,
  brand,
  fields,
  employeeProfileId: initialProfileId,
  userId,
  initialHtml,
  initialStatus,
  initialSignUrl,
  issueDate,
}: {
  tenantSlug: string;
  brand: TenantBranding;
  fields: OfferLetterFields;
  employeeProfileId?: string;
  userId: string;
  initialHtml?: string | null;
  initialStatus?: "DRAFT" | "AWAITING_SIGNATURE" | "SIGNED";
  initialSignUrl?: string | null;
  issueDate?: string;
}) {
  const { showSnackbar } = useSnackbar();
  const editorRef = useRef<HTMLDivElement>(null);
  const seeded = useRef(false);
  const [profileId, setProfileId] = useState(initialProfileId || "");
  const [status, setStatus] = useState(initialStatus ?? "DRAFT");
  const [signUrl, setSignUrl] = useState(initialSignUrl ?? "");
  const [pending, setPending] = useState(false);
  const [aiPending, setAiPending] = useState(false);
  const [aiInstruction, setAiInstruction] = useState("Make tone warmer and keep all salary figures unchanged.");

  useEffect(() => {
    if (seeded.current || !editorRef.current) return;
    editorRef.current.innerHTML = initialHtml || defaultOfferLetterHtml(fields, brand.companyName);
    seeded.current = true;
  }, [initialHtml, fields, brand.companyName]);

  const readHtml = useCallback(
    () => sanitizeOfferLetterHtml(editorRef.current?.innerHTML || defaultOfferLetterHtml(fields, brand.companyName)),
    [fields, brand.companyName],
  );

  async function handleSave() {
    setPending(true);
    const result = await saveOfferLetterDraft(tenantSlug, {
      employeeProfileId: profileId || undefined,
      userId,
      bodyHtml: readHtml(),
    });
    setPending(false);
    if (!result.ok) {
      showSnackbar(result.error || "Could not save.", "error");
      return;
    }
    if (result.profileId) setProfileId(result.profileId);
    showSnackbar("Offer letter saved for this employee.", "success");
  }

  async function handleSend() {
    setPending(true);
    const saved = await saveOfferLetterDraft(tenantSlug, {
      employeeProfileId: profileId || undefined,
      userId,
      bodyHtml: readHtml(),
    });
    const pid = saved.ok && saved.profileId ? saved.profileId : profileId;
    if (!pid) {
      setPending(false);
      showSnackbar("Save the draft first.", "error");
      return;
    }
    setProfileId(pid);
    const result = await sendOfferLetterForSignature(tenantSlug, pid);
    setPending(false);
    if (!result.ok) {
      showSnackbar(result.error || "Could not send.", "error");
      return;
    }
    if (result.signUrl) {
      setSignUrl(result.signUrl);
      setStatus("AWAITING_SIGNATURE");
      showSnackbar("Sign link ready — copy and send to the candidate.", "success");
    }
  }

  async function handleAiEdit() {
    setAiPending(true);
    try {
      const res = await fetch("/api/hr/ai/offer-letter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html: readHtml(), instruction: aiInstruction }),
      });
      const data = (await res.json()) as { html?: string; error?: string };
      if (!res.ok || !data.html) {
        showSnackbar(data.error || "AI edit unavailable. Add GEMINI_API_KEY or GROQ_API_KEY to .env.local.", "error");
        return;
      }
      const cleaned = sanitizeOfferLetterHtml(data.html);
      if (editorRef.current) editorRef.current.innerHTML = cleaned;
      showSnackbar("AI suggestion applied — review before sending.", "success");
    } catch {
      showSnackbar("AI request failed.", "error");
    } finally {
      setAiPending(false);
    }
  }

  function resetTemplate() {
    const fresh = defaultOfferLetterHtml(fields, brand.companyName);
    if (editorRef.current) editorRef.current.innerHTML = fresh;
  }

  const editable = status !== "SIGNED";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 print:hidden">
        <button
          type="button"
          disabled={pending || !editable}
          onClick={() => void handleSave()}
          className="rounded-md border border-foreground/15 px-3 py-1.5 text-xs font-semibold hover:bg-foreground/[0.04] disabled:opacity-50"
        >
          Save draft
        </button>
        <button
          type="button"
          disabled={pending || !editable}
          onClick={resetTemplate}
          className="rounded-md border border-foreground/15 px-3 py-1.5 text-xs font-semibold hover:bg-foreground/[0.04] disabled:opacity-50"
        >
          Reset template
        </button>
        <button
          type="button"
          disabled={pending || !editable}
          onClick={() => void handleSend()}
          className="rounded-md border border-foreground bg-foreground px-3 py-1.5 text-xs font-semibold text-background disabled:opacity-50"
        >
          Send for online signature
        </button>
        {signUrl ? (
          <button
            type="button"
            onClick={() => void navigator.clipboard.writeText(signUrl)}
            className="rounded-md border border-emerald-600/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-900"
          >
            Copy sign link
          </button>
        ) : null}
      </div>

      {editable ? (
        <div className="rounded-lg border border-foreground/10 bg-foreground/[0.02] p-3 print:hidden">
          <p className="text-xs font-semibold text-foreground">Edit letter · AI assist (optional)</p>
          <p className="mt-1 text-[11px] text-muted">
            Click the letter body to edit text for this employee only. AI uses Gemini or Groq free tier when{" "}
            <code className="text-xs">GEMINI_API_KEY</code> or <code className="text-xs">GROQ_API_KEY</code> is set.
          </p>
          <textarea
            value={aiInstruction}
            onChange={(e) => setAiInstruction(e.target.value)}
            rows={2}
            className="mt-2 w-full rounded-md border border-foreground/15 bg-field px-2 py-1.5 text-xs"
          />
          <button
            type="button"
            disabled={aiPending || pending}
            onClick={() => void handleAiEdit()}
            className="mt-2 rounded-md border border-foreground/15 px-3 py-1.5 text-xs font-semibold hover:bg-foreground/[0.04] disabled:opacity-50"
          >
            {aiPending ? "Thinking…" : "Apply AI edit"}
          </button>
        </div>
      ) : null}

      <BrandedDocumentShell
        brand={brand}
        title="Offer of employment"
        subtitle={`Issued ${issueDate ?? formatOfferDate()}${status === "SIGNED" ? " · Signed" : status === "AWAITING_SIGNATURE" ? " · Awaiting signature" : ""}`}
        footerNote="Confidential — for the candidate named above"
      >
        <div
          ref={editorRef}
          contentEditable={editable}
          suppressContentEditableWarning
          className={[
            "min-h-[12rem] space-y-3 text-sm leading-relaxed text-slate-800 outline-none",
            editable ? "rounded-md ring-1 ring-transparent focus:ring-[var(--hr-brand-accent)]/40 print:ring-0" : "",
          ].join(" ")}
        />

        {status === "SIGNED" ? (
          <p className="mt-6 text-xs font-semibold text-emerald-700">This offer has been signed online.</p>
        ) : (
          <div className="mt-10 grid gap-8 border-t border-slate-200 pt-6 sm:grid-cols-2 print:mt-16">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Candidate acceptance</p>
              <div className="mt-4 min-h-[4rem] rounded border border-dashed border-slate-300 bg-slate-50/50" />
              <p className="mt-2 text-xs text-slate-600">Candidate signs via the link you send</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">For {brand.companyName}</p>
              <div className="mt-8 border-b border-slate-400" />
              <p className="mt-2 text-xs text-slate-600">Authorized signatory</p>
            </div>
          </div>
        )}
      </BrandedDocumentShell>

      {signUrl && status === "AWAITING_SIGNATURE" ? (
        <p className="text-center text-xs text-muted print:hidden">
          Candidate link:{" "}
          <a href={signUrl} className="font-semibold underline break-all">
            {signUrl}
          </a>
        </p>
      ) : null}
    </div>
  );
}
