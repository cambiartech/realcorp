"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { normalizeFinanceVendorName, vendorNamesMatch } from "@/lib/finance-vendor";

export type FinanceVendorOption = {
  id: string;
  name: string;
};

type Props = {
  vendors: FinanceVendorOption[];
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  inputName?: string;
  onAddVendor?: (name: string) => Promise<boolean>;
  fieldLabel?: string;
  savedItemsLabel?: string;
  placeholder?: string;
  newItemNoun?: string;
  saveNowLabel?: string;
  normalizeName?: (raw: string) => string;
  namesMatch?: (a: string, b: string) => boolean;
};

export function VendorNamePicker({
  vendors,
  value,
  onChange,
  required,
  inputName = "vendorName",
  onAddVendor,
  fieldLabel = "Vendor",
  savedItemsLabel = "Saved vendors",
  placeholder,
  newItemNoun = "vendor",
  saveNowLabel = "Save vendor now",
  normalizeName = normalizeFinanceVendorName,
  namesMatch = vendorNamesMatch,
}: Props) {
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [adding, setAdding] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const normalizedQuery = normalizeName(value);
  const exactMatch = useMemo(
    () => vendors.find((v) => namesMatch(v.name, normalizedQuery)),
    [vendors, normalizedQuery, namesMatch],
  );

  const filtered = useMemo(() => {
    const q = normalizedQuery.toLowerCase();
    const list = q ? vendors.filter((v) => v.name.toLowerCase().includes(q)) : vendors;
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [vendors, normalizedQuery]);

  const isNewName = normalizedQuery.length >= 2 && !exactMatch;
  const resolvedPlaceholder =
    placeholder || (vendors.length > 0 ? `Search or type a new ${newItemNoun}` : `Type ${newItemNoun} name`);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setShowAll(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  async function handleExplicitAdd() {
    if (!isNewName || !onAddVendor || adding) return;
    setAdding(true);
    const ok = await onAddVendor(normalizedQuery);
    setAdding(false);
    if (ok) onChange(normalizedQuery);
  }

  return (
    <div ref={rootRef} className="relative">
      <div className="mb-1 flex items-center justify-between gap-2">
        <label className="text-sm text-muted">{fieldLabel}</label>
        <button
          type="button"
          onClick={() => {
            setShowAll((x) => !x);
            setOpen(true);
          }}
          className="text-xs text-foreground underline decoration-foreground/30 underline-offset-2"
        >
          {showAll ? "Hide list" : `${savedItemsLabel} (${vendors.length})`}
        </button>
      </div>

      <div className="relative">
        <input
          name={inputName}
          required={required}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={resolvedPlaceholder}
          autoComplete="off"
          className="w-full border border-foreground/15 bg-field px-3 py-2 pr-9 text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-foreground/20"
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted">
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M5 7.5l5 5 5-5" />
          </svg>
        </span>
      </div>

      {isNewName ? (
        <p className="mt-1 text-xs text-muted">
          <span className="font-medium text-foreground">{normalizedQuery}</span> is new — it will be saved when you record
          the {newItemNoun === "category" ? "expense" : "bill"}.
          {onAddVendor ? (
            <>
              {" "}
              <button
                type="button"
                disabled={adding}
                onClick={() => void handleExplicitAdd()}
                className="text-foreground underline decoration-foreground/30 underline-offset-2 disabled:opacity-50"
              >
                {adding ? "Saving…" : saveNowLabel}
              </button>
            </>
          ) : null}
        </p>
      ) : exactMatch ? (
        <p className="mt-1 text-xs text-muted">
          Using saved {newItemNoun}: {exactMatch.name}
        </p>
      ) : null}

      {open && (filtered.length > 0 || isNewName) ? (
        <ul
          className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-foreground/15 bg-background py-1 shadow-lg"
          role="listbox"
        >
          {filtered.slice(0, showAll ? 200 : 8).map((vendor) => (
            <li key={vendor.id}>
              <button
                type="button"
                role="option"
                className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-foreground/[0.06]"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(vendor.name);
                  setOpen(false);
                  setShowAll(false);
                }}
              >
                {vendor.name}
              </button>
            </li>
          ))}
          {!showAll && filtered.length > 8 ? (
            <li>
              <button
                type="button"
                className="w-full px-3 py-1.5 text-left text-xs text-muted hover:bg-foreground/[0.06]"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setShowAll(true)}
              >
                Show {filtered.length - 8} more…
              </button>
            </li>
          ) : null}
          {isNewName ? (
            <li className="border-t border-foreground/10">
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm font-medium text-foreground hover:bg-foreground/[0.06]"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(normalizedQuery);
                  setOpen(false);
                }}
              >
                Use “{normalizedQuery}”
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}

      {showAll && vendors.length > 0 ? (
        <div className="mt-2 rounded-lg border border-foreground/10 bg-foreground/[0.02] p-2">
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted">All saved {newItemNoun}s</p>
          <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
            {vendors.map((vendor) => (
              <button
                key={vendor.id}
                type="button"
                onClick={() => {
                  onChange(vendor.name);
                  setOpen(false);
                }}
                className={[
                  "rounded-md border px-2 py-1 text-xs transition-colors",
                  namesMatch(vendor.name, value)
                    ? "border-foreground bg-foreground text-background"
                    : "border-foreground/15 text-foreground hover:bg-foreground/[0.06]",
                ].join(" ")}
              >
                {vendor.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
