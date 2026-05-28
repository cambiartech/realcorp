"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  buildRecurrenceRangeInput,
  buildVendorBillTitle,
  describeRecurrenceRange,
  recurrenceFrequencyLabel,
  recurrencePeriodsInRange,
  recurrencePeriodUnitLabel,
  type RecurrenceRangeMode,
  type VendorBillRecurrenceFrequency,
} from "@/lib/vendor-bill-recurrence";
import { VendorNamePicker, type FinanceVendorOption } from "@/components/finance/vendor-name-picker";
import { UiSelect } from "@/components/ui-select";

export type TenantFiscalYear = {
  label: string;
  start: string;
  end: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSubmit: (formData: FormData) => void;
  actionPending: boolean;
  currencies: string[];
  departments: string[];
  defaultCurrency: string;
  fiscalYear: TenantFiscalYear | null;
  vendors: FinanceVendorOption[];
  onSaveVendor?: (name: string) => Promise<boolean>;
};

export function RecordVendorBillModal({
  open,
  onClose,
  onSubmit,
  actionPending,
  currencies,
  departments,
  defaultCurrency,
  fiscalYear,
  vendors,
  onSaveVendor,
}: Props) {
  const [vendorName, setVendorName] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [title, setTitle] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState<VendorBillRecurrenceFrequency>("MONTHLY");
  const [rangeMode, setRangeMode] = useState<RecurrenceRangeMode>(
    fiscalYear ? "FISCAL_YEAR_END" : "PERIOD_COUNT",
  );
  const [rangeEndDate, setRangeEndDate] = useState("");
  const [periodCount, setPeriodCount] = useState("6");
  const [useAutoTitle, setUseAutoTitle] = useState(true);
  const titleTouched = useRef(false);

  const autoTitle = useMemo(
    () => buildVendorBillTitle(vendorName, dueDate ? new Date(`${dueDate}T12:00:00`) : null, isRecurring ? frequency : null),
    [vendorName, dueDate, isRecurring, frequency],
  );

  const schedulePreview = useMemo(() => {
    if (!isRecurring || !dueDate) return { count: 0, description: "" };
    const anchor = new Date(`${dueDate}T12:00:00`);
    if (Number.isNaN(anchor.getTime())) return { count: 0, description: "" };

    const range = buildRecurrenceRangeInput(rangeMode, {
      fiscalYearEnd: fiscalYear ? new Date(`${fiscalYear.end}T12:00:00`) : null,
      endDate: rangeEndDate,
      periodCount: Number(periodCount) || 0,
    });
    if (!range) return { count: 0, description: "Complete the schedule range to preview bills." };

    const periods = recurrencePeriodsInRange(vendorName, anchor, frequency, range);
    return {
      count: periods.length,
      description: periods.length > 0 ? describeRecurrenceRange(range, frequency, periods.length) : "No bills in this range — adjust dates or count.",
    };
  }, [isRecurring, dueDate, rangeMode, rangeEndDate, periodCount, fiscalYear, vendorName, frequency]);

  useEffect(() => {
    if (!open) {
      setVendorName("");
      setDueDate("");
      setTitle("");
      setIsRecurring(false);
      setFrequency("MONTHLY");
      setRangeMode(fiscalYear ? "FISCAL_YEAR_END" : "PERIOD_COUNT");
      setRangeEndDate("");
      setPeriodCount("6");
      setUseAutoTitle(true);
      titleTouched.current = false;
    }
  }, [open, fiscalYear]);

  useEffect(() => {
    if (!open || titleTouched.current || !useAutoTitle) return;
    setTitle(autoTitle);
  }, [open, autoTitle, useAutoTitle]);

  if (!open) return null;

  const fiscalEndLabel = fiscalYear
    ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(`${fiscalYear.end}T12:00:00`))
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-foreground/10 bg-background p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Record vendor bill</h2>
            <p className="mt-0.5 text-xs text-muted">Recurring schedules are calculated from your date range — nothing is fixed.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-foreground/15 text-muted hover:bg-foreground/[0.06] hover:text-foreground"
            aria-label="Close modal"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <form
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            if (useAutoTitle) fd.set("title", autoTitle);
            fd.set("useAutoTitle", useAutoTitle ? "on" : "");
            if (isRecurring) {
              fd.set("isRecurring", "on");
              fd.set("recurrenceRangeMode", rangeMode);
              if (rangeMode === "END_DATE") fd.set("recurrenceEndDate", rangeEndDate);
              if (rangeMode === "PERIOD_COUNT") fd.set("recurrencePeriodCount", periodCount);
            }
            onSubmit(fd);
          }}
        >
          <VendorNamePicker
            vendors={vendors}
            value={vendorName}
            onChange={setVendorName}
            required
            onAddVendor={onSaveVendor}
          />

          <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-foreground/10 bg-foreground/[0.02] p-3">
            <input
              type="checkbox"
              checked={isRecurring}
              onChange={(e) => {
                setIsRecurring(e.target.checked);
                if (e.target.checked) setUseAutoTitle(true);
              }}
              className="mt-0.5"
            />
            <span>
              <span className="block text-sm font-medium text-foreground">Recurring bill</span>
              <span className="text-xs text-muted">Daily, weekly, or monthly — for as long as you define below.</span>
            </span>
          </label>

          {isRecurring ? (
            <div className="space-y-3 rounded-lg border border-foreground/10 bg-foreground/[0.02] p-3">
              <div>
                <label className="mb-1 block text-sm text-muted">Repeats</label>
                <UiSelect
                  name="recurrenceFrequency"
                  value={frequency}
                  onChange={(e) => setFrequency((e.target.value as VendorBillRecurrenceFrequency) || "MONTHLY")}
                >
                  <option value="DAILY">Daily</option>
                  <option value="WEEKLY">Weekly</option>
                  <option value="MONTHLY">Monthly</option>
                </UiSelect>
              </div>

              <div>
                <label className="mb-1 block text-sm text-muted">Schedule for</label>
                <UiSelect
                  value={rangeMode}
                  onChange={(e) => setRangeMode((e.target.value as RecurrenceRangeMode) || "PERIOD_COUNT")}
                >
                  <option value="FISCAL_YEAR_END" disabled={!fiscalYear}>
                    Rest of fiscal year{fiscalEndLabel ? ` (through ${fiscalEndLabel})` : " — set on dashboard"}
                  </option>
                  <option value="END_DATE">Until a specific date</option>
                  <option value="PERIOD_COUNT">Fixed number of bills</option>
                </UiSelect>
              </div>

              {rangeMode === "END_DATE" ? (
                <div>
                  <label className="mb-1 block text-sm text-muted">Schedule ends on</label>
                  <input
                    type="date"
                    required
                    value={rangeEndDate}
                    onChange={(e) => setRangeEndDate(e.target.value)}
                    className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground"
                  />
                </div>
              ) : null}

              {rangeMode === "PERIOD_COUNT" ? (
                <div>
                  <label className="mb-1 block text-sm text-muted">
                    How many {recurrencePeriodUnitLabel(frequency)}?
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={366}
                    required
                    value={periodCount}
                    onChange={(e) => setPeriodCount(e.target.value)}
                    className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground"
                  />
                  <p className="mt-1 text-xs text-muted">
                    Example: 6 with weekly = 6 weekly bills; 12 with monthly = one year of monthly bills.
                  </p>
                </div>
              ) : null}

              {rangeMode === "FISCAL_YEAR_END" && fiscalYear ? (
                <p className="text-xs text-muted">
                  Uses fiscal year{fiscalYear.label ? ` “${fiscalYear.label}”` : ""} ending {fiscalEndLabel}. Bills are
                  added on each {recurrenceFrequencyLabel(frequency).toLowerCase()} due date until that end date.
                </p>
              ) : null}

              <p className="text-xs font-medium text-foreground">
                {dueDate ? schedulePreview.description : "Set the first due date to preview how many bills will be created."}
              </p>
            </div>
          ) : null}

          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <label className="text-sm text-muted">Bill title</label>
              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted">
                <input
                  type="checkbox"
                  checked={useAutoTitle}
                  onChange={(e) => {
                    setUseAutoTitle(e.target.checked);
                    if (e.target.checked) titleTouched.current = false;
                  }}
                />
                Auto-generate
              </label>
            </div>
            <input
              name="title"
              required={!useAutoTitle}
              readOnly={useAutoTitle}
              value={useAutoTitle ? autoTitle : title}
              onChange={(e) => {
                titleTouched.current = true;
                setTitle(e.target.value);
              }}
              className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground read-only:opacity-80"
            />
            {useAutoTitle ? (
              <p className="mt-1 text-xs text-muted">Preview: {autoTitle || "Enter vendor and due date"}</p>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-muted">Amount</label>
              <input name="amount" inputMode="decimal" required className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground" />
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted">Currency</label>
              <UiSelect name="currency" defaultValue={currencies[0] || defaultCurrency}>
                {currencies.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </UiSelect>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-muted">
                First due date {isRecurring ? "" : "(optional)"}
              </label>
              <input
                name="dueDate"
                type="date"
                required={isRecurring}
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted">Department (optional)</label>
              <UiSelect name="department" defaultValue="">
                <option value="">Select department</option>
                {departments.map((department) => (
                  <option key={department} value={department}>
                    {department}
                  </option>
                ))}
              </UiSelect>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm text-muted">Note (optional)</label>
            <input name="note" className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground" />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-foreground/15 px-4 py-2 text-sm text-foreground hover:bg-foreground/[0.06]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={actionPending || (isRecurring && schedulePreview.count === 0)}
              className="rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-50"
            >
              {actionPending
                ? "Saving..."
                : isRecurring
                  ? schedulePreview.count > 0
                    ? `Save ${schedulePreview.count} bill${schedulePreview.count === 1 ? "" : "s"}`
                    : "Save bills"
                  : "Save bill"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
