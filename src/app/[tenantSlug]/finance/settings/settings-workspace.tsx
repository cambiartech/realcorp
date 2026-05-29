"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { FormAlert } from "@/components/form-message";
import { useSnackbar } from "@/components/snackbar";
import type { FinanceControls } from "@/lib/finance-controls";
import { ButtonSpinner } from "@/components/button-spinner";
import { saveFinanceSettings } from "../actions";

export function FinanceSettingsWorkspace({
  tenantSlug,
  defaults,
}: {
  tenantSlug: string;
  defaults: {
    financeBankAccounts: string[];
    financePaymentModes: string[];
    financeCurrencies: string[];
    financeControls: FinanceControls;
  };
}) {
  const [bankAccounts, setBankAccounts] = useState(defaults.financeBankAccounts || []);
  const [paymentModes, setPaymentModes] = useState(defaults.financePaymentModes || []);
  const [currencies, setCurrencies] = useState(defaults.financeCurrencies || []);
  const [accountBankName, setAccountBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [modeInput, setModeInput] = useState("");
  const [currencyInput, setCurrencyInput] = useState("");
  const router = useRouter();
  const { showSnackbar } = useSnackbar();

  const [state, action, pending] = useActionState(
    saveFinanceSettings.bind(null, tenantSlug),
    null as { ok: true } | { ok: false; error: string } | null,
  );

  const [savedBaseline, setSavedBaseline] = useState(() =>
    JSON.stringify({
      b: defaults.financeBankAccounts || [],
      p: defaults.financePaymentModes || [],
      c: defaults.financeCurrencies || [],
    }),
  );

  const draftFingerprint = JSON.stringify({
    b: bankAccounts,
    p: paymentModes,
    c: currencies,
  });
  const isDraft = draftFingerprint !== savedBaseline;

  useEffect(() => {
    if (!state?.ok) return;
    setSavedBaseline(
      JSON.stringify({
        b: bankAccounts,
        p: paymentModes,
        c: currencies,
      }),
    );
    showSnackbar("Finance settings saved. Setup coach will show your next step.", "success");
    router.refresh();
    // Only when `state` updates (e.g. after Save) — not when lists change while showing a prior success message
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  useEffect(() => {
    if (!isDraft) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDraft]);

  function addItem(
    value: string,
    setValue: (v: string) => void,
    list: string[],
    setList: (next: string[]) => void,
    upper = false,
  ) {
    const item = (upper ? value.toUpperCase() : value).trim();
    if (!item) return;
    if (list.includes(item)) {
      setValue("");
      return;
    }
    setList([...list, item]);
    setValue("");
  }

  function removeItem(item: string, list: string[], setList: (next: string[]) => void) {
    setList(list.filter((x) => x !== item));
  }

  function buildBankAccountLabel(bankName: string, number: string, holder: string) {
    const b = bankName.trim();
    const n = number.trim();
    const h = holder.trim();
    if (!b || !n || !h) return null;
    return `${b} | ${n} | ${h}`;
  }

  function addBankAccount() {
    const label = buildBankAccountLabel(accountBankName, accountNumber, accountName);
    if (!label) return;
    if (!bankAccounts.includes(label)) setBankAccounts([...bankAccounts, label]);
    setAccountBankName("");
    setAccountNumber("");
    setAccountName("");
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-4 sm:py-5">
      <div className="border-b border-foreground/10 pb-4">
        <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">Finance Settings</h1>
        <p className="mt-0.5 text-sm text-muted">Dropdown catalogs for expenses, receipts, payments, and invoices.</p>
      </div>

      <div className="mt-4 rounded-xl border border-foreground/10 bg-foreground/[0.02] p-4 sm:p-5">
        <form action={action} className="space-y-4">
          {isDraft ? (
            <div
              role="status"
              className="rounded-lg border border-amber-500/45 bg-amber-500/[0.12] px-3 py-2.5 text-sm text-foreground shadow-sm"
            >
              <span className="font-semibold">Draft</span>
              {" — "}
              These catalogs are not saved yet. Click <span className="font-semibold">Save finance settings</span>{" "}
              or your changes will be lost if you leave or refresh the page.
            </div>
          ) : null}
          {/* Single JSON fields avoid FormData quirks with repeated name="...[]" fields in Server Actions */}
          <input type="hidden" name="financeBankAccountsJson" value={JSON.stringify(bankAccounts)} />
          <input type="hidden" name="financePaymentModesJson" value={JSON.stringify(paymentModes)} />
          <input type="hidden" name="financeCurrenciesJson" value={JSON.stringify(currencies)} />
          <div className="grid gap-5 lg:grid-cols-3 lg:gap-6">
            <div className="min-w-0 lg:col-span-1">
              <label className="mb-1 block text-xs font-medium text-foreground">Bank / cash accounts</label>
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  value={accountBankName}
                  onChange={(e) => setAccountBankName(e.target.value)}
                  placeholder="Bank name (e.g. Sterling Bank)"
                  className="w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm text-foreground"
                />
                <input
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="Account number"
                  className="w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm text-foreground"
                />
                <div className="flex gap-2 sm:col-span-2">
                  <input
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder="Account name"
                    className="min-w-0 flex-1 rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm text-foreground"
                  />
                  <button
                    type="button"
                    onClick={addBankAccount}
                    className="shrink-0 rounded-md border border-foreground/20 px-3 py-2 text-xs font-semibold text-foreground hover:bg-foreground/[0.06]"
                  >
                    + Add
                  </button>
                </div>
              </div>
              <div className="mt-2 max-h-48 overflow-auto rounded-md border border-foreground/10 bg-background p-2">
                {bankAccounts.length === 0 ? <p className="text-xs text-muted">No accounts yet.</p> : null}
                {bankAccounts.map((item) => (
                  <div key={item} className="mb-1 flex items-center justify-between gap-2 rounded border border-foreground/10 px-2 py-1 text-xs">
                    <span>{item}</span>
                    <button type="button" onClick={() => removeItem(item, bankAccounts, setBankAccounts)} className="text-muted hover:text-error">
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">Payment modes</label>
              <div className="flex gap-2">
                <input
                  value={modeInput}
                  onChange={(e) => setModeInput(e.target.value)}
                  placeholder="Add payment mode"
                  className="w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm text-foreground"
                />
                <button
                  type="button"
                  onClick={() => addItem(modeInput, setModeInput, paymentModes, setPaymentModes)}
                  className="rounded-md border border-foreground/20 px-3 py-2 text-xs font-semibold text-foreground hover:bg-foreground/[0.06]"
                >
                  Add
                </button>
              </div>
              <div className="mt-2 max-h-48 overflow-auto rounded-md border border-foreground/10 bg-background p-2">
                {paymentModes.length === 0 ? <p className="text-xs text-muted">No modes yet.</p> : null}
                {paymentModes.map((item) => (
                  <div key={item} className="mb-1 flex items-center justify-between gap-2 rounded border border-foreground/10 px-2 py-1 text-xs">
                    <span>{item}</span>
                    <button type="button" onClick={() => removeItem(item, paymentModes, setPaymentModes)} className="text-muted hover:text-error">
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-foreground">Currencies</label>
              <div className="flex gap-2">
                <input
                  value={currencyInput}
                  onChange={(e) => setCurrencyInput(e.target.value.toUpperCase())}
                  placeholder="Add currency (e.g. NGN)"
                  className="w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm uppercase text-foreground"
                />
                <button
                  type="button"
                  onClick={() => addItem(currencyInput, setCurrencyInput, currencies, setCurrencies, true)}
                  className="rounded-md border border-foreground/20 px-3 py-2 text-xs font-semibold text-foreground hover:bg-foreground/[0.06]"
                >
                  Add
                </button>
              </div>
              <div className="mt-2 max-h-48 overflow-auto rounded-md border border-foreground/10 bg-background p-2">
                {currencies.length === 0 ? <p className="text-xs text-muted">No currencies yet.</p> : null}
                {currencies.map((item) => (
                  <div key={item} className="mb-1 flex items-center justify-between gap-2 rounded border border-foreground/10 px-2 py-1 text-xs">
                    <span>{item}</span>
                    <button type="button" onClick={() => removeItem(item, currencies, setCurrencies)} className="text-muted hover:text-error">
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-foreground/10 bg-background p-4">
            <p className="text-sm font-semibold text-foreground">Rules & approvals</p>
            <p className="mt-1 text-xs text-muted">
              Plain limits for your team. Large expenses are blocked until a manager handles them outside the app or you raise the limit.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">Expense needs approval above</label>
                <input
                  name="expenseApprovalThreshold"
                  type="number"
                  min={0}
                  step={1}
                  defaultValue={defaults.financeControls.expenseApprovalThreshold ?? ""}
                  placeholder="Leave empty for no limit"
                  className="w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm text-foreground"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">First payment reminder (days overdue)</label>
                <input
                  name="firstReminderAfterDays"
                  type="number"
                  min={1}
                  max={90}
                  defaultValue={defaults.financeControls.firstReminderAfterDays}
                  className="w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm text-foreground"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">Second reminder wave (days overdue)</label>
                <input
                  name="secondReminderAfterDays"
                  type="number"
                  min={1}
                  max={180}
                  defaultValue={defaults.financeControls.secondReminderAfterDays}
                  className="w-full rounded-md border border-foreground/15 bg-background px-3 py-2 text-sm text-foreground"
                />
              </div>
            </div>
          </div>

          {state && !state.ok ? <FormAlert>{state.error}</FormAlert> : null}
          {state?.ok ? <p className="text-xs font-medium text-emerald-600">Finance settings saved.</p> : null}

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted">Add or remove items, then click Save — drafts are not persisted until you save.</p>
            <button
              type="submit"
              disabled={pending}
              aria-busy={pending}
              className={
                isDraft
                  ? "inline-flex items-center gap-2 rounded-md border-2 border-amber-600/80 bg-foreground px-4 py-2 text-sm font-semibold text-background shadow-md ring-2 ring-amber-500/40 transition-opacity hover:opacity-90 disabled:opacity-60"
                  : "inline-flex items-center gap-2 rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-60"
              }
            >
              {pending ? <ButtonSpinner /> : null}
              {pending ? "Saving..." : "Save finance settings"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
