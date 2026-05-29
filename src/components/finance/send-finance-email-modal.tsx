"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ModalOverlay } from "@/components/modal-overlay";
import { ButtonSpinner } from "@/components/button-spinner";
import { MODAL_PANEL_SM } from "@/lib/modal-panel";
import { FINANCE_SETTINGS_BANKS_HINT } from "@/lib/finance-bank-accounts";

export type FinanceEmailModalMode = "send" | "remind" | "resend";

export function SendFinanceEmailModal({
  open,
  onClose,
  mode,
  documentLabel,
  documentNumber,
  customerName,
  defaultEmail,
  tenantSlug,
  hasBankAccounts,
  pending,
  onSend,
}: {
  open: boolean;
  onClose: () => void;
  mode: FinanceEmailModalMode;
  documentLabel: string;
  documentNumber: string;
  customerName: string;
  defaultEmail: string;
  tenantSlug: string;
  hasBankAccounts: boolean;
  pending: boolean;
  onSend: (input: { email: string; customPaymentInstructions: string }) => void;
}) {
  const [email, setEmail] = useState(defaultEmail);
  const [customPaymentInstructions, setCustomPaymentInstructions] = useState("");

  useEffect(() => {
    if (!open) return;
    setEmail(defaultEmail);
    setCustomPaymentInstructions("");
  }, [open, defaultEmail]);

  const title =
    mode === "remind" ? "Send payment reminder" : mode === "resend" ? `Resend ${documentLabel}` : `Send ${documentLabel}`;

  const submitLabel =
    mode === "remind" ? "Send reminder" : mode === "resend" ? "Resend PDF" : `Send ${documentLabel}`;

  return (
    <ModalOverlay open={open} onClose={onClose} panelClassName={MODAL_PANEL_SM}>
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <p className="mt-1 text-sm text-muted">
        Email <strong>{documentNumber}</strong>
        {customerName ? (
          <>
            {" "}
            to <strong>{customerName}</strong>
          </>
        ) : null}
        . A PDF copy is filed in Finance documents
        {customerName ? " and the client folder when linked." : "."}
      </p>

      {!hasBankAccounts ? (
        <div className="mt-3 rounded-md border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs text-foreground">
          {FINANCE_SETTINGS_BANKS_HINT}{" "}
          <Link
            href={`/${tenantSlug}/finance/settings`}
            className="font-semibold underline decoration-foreground/30 underline-offset-2"
          >
            Finance settings
          </Link>
          , or add custom payment instructions below for this send.
        </div>
      ) : null}

      <form
        className="mt-4 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSend({ email: email.trim(), customPaymentInstructions: customPaymentInstructions.trim() });
        }}
      >
        <div>
          <label className="mb-1 block text-sm text-muted">Recipient email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="client@example.com"
            className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground"
          />
        </div>
        {!hasBankAccounts ? (
          <div>
            <label className="mb-1 block text-sm text-muted">Custom payment instructions (optional)</label>
            <textarea
              value={customPaymentInstructions}
              onChange={(e) => setCustomPaymentInstructions(e.target.value)}
              rows={3}
              placeholder="e.g. Pay to GTBank 0123456789 — Afropolitan Ltd. Use invoice number as reference."
              className="w-full border border-foreground/15 bg-field px-3 py-2 text-sm text-foreground"
            />
          </div>
        ) : null}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border px-4 py-2 text-sm">
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending || !email.trim()}
            className="inline-flex items-center gap-2 rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-50"
          >
            {pending ? <ButtonSpinner /> : null}
            {pending ? "Sending…" : submitLabel}
          </button>
        </div>
      </form>
    </ModalOverlay>
  );
}
