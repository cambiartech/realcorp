"use client";

import { useState, useTransition } from "react";
import { useSnackbar } from "@/components/snackbar";
import { recordShortletPayment } from "@/app/[tenantSlug]/shortlets/actions";

export type FolioLineRow = {
  id: string;
  department: string;
  description: string;
  quantity: number;
  amountLabel: string;
  postedAtLabel: string;
};

export type FolioPaymentRow = {
  id: string;
  amountLabel: string;
  paidAtLabel: string;
  method: string;
};

type Props = {
  tenantSlug: string;
  canManage: boolean;
  reservationId: string;
  guestName: string;
  unitName: string;
  totalAmountLabel: string;
  paidAmountLabel: string;
  balanceLabel: string;
  balanceDue: number;
  currency: string;
  folioLines: FolioLineRow[];
  payments: FolioPaymentRow[];
  onCheckout?: () => void;
  checkoutPending?: boolean;
};

export function ReservationFolioPanel({
  tenantSlug,
  canManage,
  reservationId,
  guestName,
  unitName,
  totalAmountLabel,
  paidAmountLabel,
  balanceLabel,
  balanceDue,
  currency,
  folioLines,
  payments,
  onCheckout,
  checkoutPending,
}: Props) {
  const { showSnackbar } = useSnackbar();
  const [isPending, startTransition] = useTransition();
  const [payOpen, setPayOpen] = useState(false);
  const [payForm, setPayForm] = useState({
    amount: balanceDue > 0 ? String(balanceDue) : "",
    paidAt: new Date().toISOString().slice(0, 10),
    method: "Transfer",
    reference: "",
  });

  function recordPayment(thenCheckout?: boolean) {
    startTransition(async () => {
      const res = await recordShortletPayment(tenantSlug, reservationId, {
        amount: Number(payForm.amount),
        paidAt: payForm.paidAt,
        method: payForm.method,
        reference: payForm.reference || undefined,
      });
      if (!res.ok) {
        showSnackbar(res.error || "Could not record payment.", "error");
        return;
      }
      showSnackbar("Payment recorded.", "success");
      setPayOpen(false);
      if (thenCheckout && onCheckout) onCheckout();
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">{guestName}</h3>
        <p className="text-sm text-muted">{unitName}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-md border border-foreground/10 p-3">
          <p className="text-xs text-muted">Total charges</p>
          <p className="font-semibold">{totalAmountLabel}</p>
        </div>
        <div className="rounded-md border border-foreground/10 p-3">
          <p className="text-xs text-muted">Paid</p>
          <p className="font-semibold">{paidAmountLabel}</p>
        </div>
        <div className="rounded-md border border-foreground/10 p-3">
          <p className="text-xs text-muted">Balance due</p>
          <p className={`font-semibold ${balanceDue > 0 ? "text-[var(--warn)] " : ""}`}>{balanceLabel}</p>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold">Folio charges</h4>
        {folioLines.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Room rate only — no extra charges posted yet.</p>
        ) : (
          <table className="mt-2 min-w-full text-sm">
            <thead className="text-left text-xs uppercase text-muted">
              <tr>
                <th className="py-1 pr-3">Dept</th>
                <th className="py-1 pr-3">Item</th>
                <th className="py-1 pr-3">Qty</th>
                <th className="py-1 pr-3">Amount</th>
                <th className="py-1">Posted</th>
              </tr>
            </thead>
            <tbody>
              {folioLines.map((line) => (
                <tr key={line.id} className="border-t border-foreground/10">
                  <td className="py-1.5 pr-3">{line.department}</td>
                  <td className="py-1.5 pr-3">{line.description}</td>
                  <td className="py-1.5 pr-3">{line.quantity}</td>
                  <td className="py-1.5 pr-3">{line.amountLabel}</td>
                  <td className="py-1.5">{line.postedAtLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {payments.length > 0 ? (
        <div>
          <h4 className="text-sm font-semibold">Payments received</h4>
          <ul className="mt-2 space-y-1 text-sm">
            {payments.map((p) => (
              <li key={p.id} className="flex justify-between border-t border-foreground/10 py-1.5">
                <span>
                  {p.paidAtLabel} · {p.method}
                </span>
                <span className="font-medium">{p.amountLabel}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {canManage ? (
        <div className="flex flex-wrap gap-2 border-t border-foreground/10 pt-4">
          {balanceDue > 0 ? (
            <>
              <button
                type="button"
                onClick={() => setPayOpen((v) => !v)}
                className="rounded-md border border-foreground/15 px-3 py-2 text-sm hover:bg-foreground/[0.06]"
              >
                Record payment
              </button>
              {onCheckout ? (
                <button
                  type="button"
                  disabled={checkoutPending || isPending}
                  onClick={() => {
                    if (balanceDue > 0) setPayOpen(true);
                    else onCheckout();
                  }}
                  className="rounded-md bg-foreground px-3 py-2 text-sm font-semibold text-background disabled:opacity-50"
                >
                  Check out guest
                </button>
              ) : null}
            </>
          ) : onCheckout ? (
            <button
              type="button"
              disabled={checkoutPending || isPending}
              onClick={onCheckout}
              className="rounded-md bg-foreground px-3 py-2 text-sm font-semibold text-background disabled:opacity-50"
            >
              Check out guest
            </button>
          ) : null}
        </div>
      ) : null}

      {payOpen && balanceDue > 0 ? (
        <div className="rounded-lg border border-foreground/15 bg-foreground/[0.02] p-4">
          <p className="text-sm font-medium">Record payment ({currency})</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <input
              type="number"
              className="rounded-md border px-3 py-2 text-sm"
              value={payForm.amount}
              onChange={(e) => setPayForm((f) => ({ ...f, amount: e.target.value }))}
            />
            <input
              type="date"
              className="rounded-md border px-3 py-2 text-sm"
              value={payForm.paidAt}
              onChange={(e) => setPayForm((f) => ({ ...f, paidAt: e.target.value }))}
            />
            <input
              className="rounded-md border px-3 py-2 text-sm"
              placeholder="Method"
              value={payForm.method}
              onChange={(e) => setPayForm((f) => ({ ...f, method: e.target.value }))}
            />
            <input
              className="rounded-md border px-3 py-2 text-sm"
              placeholder="Reference"
              value={payForm.reference}
              onChange={(e) => setPayForm((f) => ({ ...f, reference: e.target.value }))}
            />
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={() => recordPayment(false)}
              className="rounded-md border px-3 py-2 text-sm"
            >
              Save payment
            </button>
            {onCheckout ? (
              <button
                type="button"
                disabled={isPending}
                onClick={() => recordPayment(true)}
                className="rounded-md bg-foreground px-3 py-2 text-sm font-semibold text-background"
              >
                Pay & check out
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
