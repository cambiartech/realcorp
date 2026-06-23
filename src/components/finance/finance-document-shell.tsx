import type { TenantBranding } from "@/lib/tenant-branding";
import { formatOrgAddress } from "@/lib/tenant-branding";

export function FinanceDocumentShell({
  brand,
  documentLabel,
  documentNumber,
  footerNote,
  children,
}: {
  brand: TenantBranding;
  documentLabel: string;
  documentNumber: string;
  footerNote?: string;
  children: React.ReactNode;
}) {
  const address = formatOrgAddress(brand);

  return (
    <article className="mx-auto max-w-[720px] rounded-lg border border-neutral-200 bg-white text-neutral-900 shadow-sm print:max-w-none print:rounded-none print:border-0 print:shadow-none">
      <header className="border-b border-neutral-200 px-8 pb-6 pt-8 print:px-6">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            {brand.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={brand.logoUrl}
                alt={brand.companyName}
                className="h-14 w-auto max-w-[180px] object-contain object-left"
              />
            ) : (
              <div
                className="flex h-14 w-14 items-center justify-center rounded-md text-lg font-bold text-white"
                style={{ backgroundColor: brand.primaryColor }}
              >
                {brand.companyName.slice(0, 2).toUpperCase()}
              </div>
            )}
            <p className="mt-3 text-sm font-semibold text-neutral-900">{brand.companyName}</p>
            {address ? <p className="mt-0.5 text-xs text-neutral-500">{address}</p> : null}
            {brand.orgEmail || brand.orgPhone ? (
              <p className="mt-1 text-xs text-neutral-500">
                {[brand.orgPhone, brand.orgEmail].filter(Boolean).join(" · ")}
              </p>
            ) : null}
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">{documentLabel}</p>
            <p className="mt-1 text-2xl font-bold tracking-tight text-neutral-900">{documentNumber}</p>
          </div>
        </div>
      </header>

      <div className="px-8 py-6 print:px-6">{children}</div>

      {footerNote ? (
        <footer className="border-t border-neutral-200 px-8 py-4 text-center text-xs text-neutral-500 print:px-6">
          {footerNote}
        </footer>
      ) : null}
    </article>
  );
}

export function FinanceMetaGrid({
  rows,
}: {
  rows: Array<{ label: string; value: string; wide?: boolean }>;
}) {
  return (
    <dl className="mb-6 grid gap-4 border-b border-neutral-200 pb-6 sm:grid-cols-2">
      {rows.map((row) => (
        <div key={row.label} className={row.wide ? "sm:col-span-2" : undefined}>
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">{row.label}</dt>
          <dd className="mt-1 whitespace-pre-line text-sm text-neutral-900">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function FinanceLineTable({
  columns,
  rows,
  totals,
}: {
  columns: Array<{ key: string; label: string; align?: "left" | "right" }>;
  rows: Array<Record<string, string>>;
  totals?: Array<{ label: string; value: string; emphasis?: boolean }>;
}) {
  return (
    <div className="mb-6">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-300">
            {columns.map((col) => (
              <th
                key={col.key}
                className={[
                  "pb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-neutral-500",
                  col.align === "right" ? "text-right" : "text-left",
                ].join(" ")}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-neutral-100">
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={[
                    "py-3 text-neutral-900",
                    col.align === "right" ? "text-right tabular-nums" : "text-left",
                  ].join(" ")}
                >
                  {row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {totals?.length ? (
        <div className="mt-4 flex flex-col items-end gap-1.5">
          {totals.map((t) => (
            <div key={t.label} className="flex min-w-[220px] justify-between gap-8 text-sm">
              <span className={t.emphasis ? "font-semibold text-neutral-900" : "text-neutral-500"}>{t.label}</span>
              <span className={t.emphasis ? "text-base font-bold tabular-nums text-neutral-900" : "tabular-nums text-neutral-900"}>
                {t.value}
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function FinanceAmountHero({ label, amount }: { label: string; amount: string }) {
  return (
    <div className="mb-6 rounded-lg border border-neutral-200 bg-neutral-50 px-5 py-4 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight text-neutral-900">{amount}</p>
    </div>
  );
}

export function FinanceDetailGrid({ items }: { items: Array<{ label: string; value: string }> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className="rounded-md border border-neutral-200 bg-neutral-50/70 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">{item.label}</p>
          <p className="mt-1 text-sm font-medium text-neutral-900">{item.value}</p>
        </div>
      ))}
    </div>
  );
}

export function FinanceNotesBlock({ title = "Notes", children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 border-t border-neutral-200 pt-5">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">{title}</h3>
      <div className="mt-2 text-sm leading-relaxed text-neutral-700">{children}</div>
    </section>
  );
}
