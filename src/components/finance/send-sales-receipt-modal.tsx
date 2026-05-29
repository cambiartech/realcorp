"use client";

import { useEffect, useState } from "react";
import { ModalOverlay } from "@/components/modal-overlay";
import { ButtonSpinner } from "@/components/button-spinner";
import { MODAL_PANEL_SM } from "@/lib/modal-panel";

export function SendSalesReceiptModal({
  open,
  onClose,
  receiptNumber,
  customerName,
  defaultEmail,
  pending,
  onSend,
}: {
  open: boolean;
  onClose: () => void;
  receiptNumber: string;
  customerName: string;
  defaultEmail: string;
  pending: boolean;
  onSend: (email: string) => void;
}) {
  const [email, setEmail] = useState(defaultEmail);

  useEffect(() => {
    if (open) setEmail(defaultEmail);
  }, [open, defaultEmail]);

  return (
    <ModalOverlay open={open} onClose={onClose} panelClassName={MODAL_PANEL_SM}>
      <h2 className="text-lg font-semibold text-foreground">Send receipt</h2>
      <p className="mt-1 text-sm text-muted">
        Email <strong>{receiptNumber}</strong>
        {customerName ? (
          <>
            {" "}
            to <strong>{customerName}</strong>
          </>
        ) : null}
        . A PDF copy is filed in Finance documents
        {customerName ? " and the client folder when linked." : "."}
      </p>
      <form
        className="mt-4 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSend(email.trim());
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
            {pending ? "Sending…" : "Send PDF receipt"}
          </button>
        </div>
      </form>
    </ModalOverlay>
  );
}
