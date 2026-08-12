"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, Sparkles } from "lucide-react";
import { BrandedDocumentShell } from "@/components/hr/branded-document-shell";
import { formatOfferDate, type OfferLetterFields } from "@/lib/offer-letter";
import { defaultOfferLetterHtml, sanitizeOfferLetterHtml } from "@/lib/offer-letter-html";
import type { TenantBranding } from "@/lib/tenant-branding";
import { saveOfferLetterDraft, sendOfferLetterForSignature } from "@/app/[tenantSlug]/hr/actions";
import { useSnackbar } from "@/components/snackbar";

const AI_REWRITE_ACTIONS = [
  { label: "Warmer", instruction: "Make the tone warmer while preserving every fact and salary figure." },
  { label: "More concise", instruction: "Make the letter more concise without removing important terms." },
  { label: "More formal", instruction: "Rewrite the letter in a more formal and professional tone." },
  { label: "Fix grammar", instruction: "Correct grammar and improve clarity without changing meaning." },
];

export function OfferLetterEditor({
  tenantSlug,
  aiEnabled,
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
  aiEnabled: boolean;
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
  const [aiInstruction, setAiInstruction] = useState(
    "Make tone warmer and keep all salary figures unchanged.",
  );

  useEffect(() => {
    if (seeded.current || !editorRef.current) return;
    editorRef.current.innerHTML = initialHtml || defaultOfferLetterHtml(fields, brand.companyName);
    seeded.current = true;
  }, [initialHtml, fields, brand.companyName]);

  const readHtml = useCallback(
    () =>
      sanitizeOfferLetterHtml(
        editorRef.current?.innerHTML || defaultOfferLetterHtml(fields, brand.companyName),
      ),
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
        body: JSON.stringify({ tenantSlug, html: readHtml(), instruction: aiInstruction }),
      });
      const data = (await res.json()) as { html?: string; error?: string };
      if (!res.ok || !data.html) {
        showSnackbar(data.error || "AI editing is currently unavailable.", "error");
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
            className="rounded-md border border-[var(--success-line)] bg-[var(--success-wash)] px-3 py-1.5 text-xs font-semibold text-[var(--success)]"
          >
            Copy sign link
          </button>
        ) : null}
      </div>

      {editable && aiEnabled ? (
        <div className="rounded-xl border border-foreground/10 bg-background p-3 shadow-sm print:hidden">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-foreground text-background">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <div>
              <p className="text-xs font-semibold text-foreground">Rewrite with AI</p>
              <p className="text-[10px] text-muted">Review the result before saving or sending.</p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {AI_REWRITE_ACTIONS.map((action) => (
              <button
                key={action.label}
                type="button"
                disabled={aiPending || pending}
                onClick={() => setAiInstruction(action.instruction)}
                className="rounded-full border border-foreground/10 bg-foreground/[0.025] px-2.5 py-1 text-[11px] font-medium text-foreground transition hover:border-foreground/25 hover:bg-foreground/[0.05] disabled:opacity-50"
              >
                {action.label}
              </button>
            ))}
          </div>

          <div className="relative mt-2 rounded-lg border border-foreground/15 bg-field focus-within:ring-2 focus-within:ring-foreground/10">
            <textarea
              value={aiInstruction}
              onChange={(e) => setAiInstruction(e.target.value)}
              rows={2}
              placeholder="Ask AI to rewrite this letter…"
              className="w-full resize-none bg-transparent px-3 py-2.5 pr-12 text-xs text-foreground outline-none"
            />
            <button
              type="button"
              disabled={aiPending || pending || !aiInstruction.trim()}
              onClick={() => void handleAiEdit()}
              aria-label="Apply AI rewrite"
              className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-foreground text-background transition hover:opacity-90 disabled:opacity-40"
            >
              {aiPending ? (
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-background/40 border-t-background" />
              ) : (
                <ArrowUp className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>
      ) : null}

      <BrandedDocumentShell
        brand={brand}
        title="Offer of employment"
        subtitle={`Issued ${issueDate ?? formatOfferDate()}${status === "SIGNED" ? " · Signed" : status === "AWAITING_SIGNATURE" ? " · Awaiting signature" : ""}`}
        footerNote="Confidential — for the candidate named above"
        variant="formal"
      >
        <div
          ref={editorRef}
          contentEditable={editable}
          suppressContentEditableWarning
          className={[
            "min-h-[12rem] space-y-3 text-sm leading-relaxed text-slate-800 outline-none",
            editable
              ? "rounded-md ring-1 ring-transparent focus:ring-[var(--hr-brand-accent)]/40 print:ring-0"
              : "",
          ].join(" ")}
        />

        {status === "SIGNED" ? (
          <p className="mt-6 text-xs font-semibold text-[var(--success)]">
            This offer has been signed online.
          </p>
        ) : (
          <div className="mt-10 grid gap-8 border-t border-slate-200 pt-6 sm:grid-cols-2 print:mt-16">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Candidate acceptance
              </p>
              <div className="mt-4 min-h-[4rem] rounded border border-dashed border-slate-300 bg-slate-50/50" />
              <p className="mt-2 text-xs text-slate-600">Candidate signs via the link you send</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                For {brand.companyName}
              </p>
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
