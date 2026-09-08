import type { TenantBranding } from "@/lib/tenant-branding";
import { brandingCssVars, formatOrgAddress } from "@/lib/tenant-branding";

export function BrandedDocumentShell({
  brand,
  title,
  subtitle,
  children,
  footerNote,
  variant = "brand",
}: {
  brand: TenantBranding;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footerNote?: string;
  variant?: "brand" | "formal" | "letterhead";
}) {
  const address = formatOrgAddress(brand);
  const style = brandingCssVars(brand);
  const letterhead = variant === "letterhead";

  return (
    <div
      data-pdf-document="true"
      className={[
        "relative mx-auto max-w-3xl overflow-hidden text-slate-900 shadow-sm print:max-w-none print:rounded-none print:border-0 print:shadow-none",
        letterhead
          ? "rounded-none border border-slate-200 bg-[#ececec] print:bg-[#ececec]"
          : "rounded-xl border border-slate-200 bg-white",
      ].join(" ")}
      style={style}
    >
      {letterhead && brand.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={brand.logoUrl}
          alt=""
          className="pointer-events-none absolute left-1/2 top-1/2 h-[55%] w-auto max-w-[70%] -translate-x-1/2 -translate-y-1/2 object-contain opacity-[0.06]"
        />
      ) : null}
      <header
        className={[
          "relative rounded-t-xl px-6 py-5 print:rounded-none",
          letterhead
            ? "bg-transparent text-slate-900"
            : variant === "formal"
              ? "border-b border-t-4 border-slate-200 bg-white text-slate-900"
              : "text-white",
        ].join(" ")}
        style={
          letterhead
            ? undefined
            : variant === "formal"
              ? { borderTopColor: "var(--hr-brand-primary)" }
              : { backgroundColor: "var(--hr-brand-primary)" }
        }
      >
        <div className={letterhead ? "flex items-start gap-4" : "flex flex-wrap items-start justify-between gap-4"}>
          <div className="flex items-start gap-4">
            {brand.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={brand.logoUrl}
                alt=""
                className={[
                  "h-14 w-auto max-w-[140px] rounded object-contain p-1",
                  letterhead || variant === "formal" ? "border border-slate-200 bg-white" : "bg-white/95",
                ].join(" ")}
              />
            ) : (
              <div
                className={[
                  "flex h-14 w-14 items-center justify-center rounded-lg text-lg font-bold",
                  letterhead || variant === "formal" ? "text-white" : "bg-white/15",
                ].join(" ")}
                style={
                  letterhead || variant === "formal" ? { backgroundColor: "var(--hr-brand-primary)" } : undefined
                }
              >
                {brand.companyName.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <p className={letterhead ? "text-lg font-bold uppercase tracking-wide" : "text-lg font-bold tracking-tight"}>
                {brand.companyName}
              </p>
              {address ? (
                <p
                  className={
                    letterhead
                      ? "mt-1 text-sm text-slate-700"
                      : variant === "formal"
                        ? "mt-1 text-xs text-slate-500"
                        : "mt-1 text-xs text-white/85"
                  }
                >
                  {address}
                </p>
              ) : null}
              {letterhead ? null : (
                <div
                  className={
                    variant === "formal"
                      ? "mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500"
                      : "mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/90"
                  }
                >
                  {brand.orgPhone ? <span>Phone: {brand.orgPhone}</span> : null}
                  {brand.orgEmail ? <span>Email: {brand.orgEmail}</span> : null}
                </div>
              )}
            </div>
          </div>
          {letterhead ? null : (
            <div className="text-right">
              <h1 className="text-base font-bold uppercase tracking-wide">{title}</h1>
              {subtitle ? (
                <p className={variant === "formal" ? "mt-1 text-xs text-slate-500" : "mt-1 text-xs text-white/85"}>
                  {subtitle}
                </p>
              ) : null}
            </div>
          )}
        </div>
        {letterhead && title ? (
          <h1 className="mt-6 text-center text-[15px] font-bold uppercase tracking-wide text-slate-900 underline decoration-slate-800 decoration-1 underline-offset-[6px]">
            {title}
          </h1>
        ) : null}
      </header>

      <div className={letterhead ? "relative px-8 pb-8 pt-4" : "px-6 py-6"}>{children}</div>

      {footerNote ? (
        <footer className="relative border-t border-slate-200/80 px-6 py-4 text-center text-[11px] text-slate-500">
          {footerNote}
        </footer>
      ) : null}
    </div>
  );
}

export function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2
        className="mb-3 border-b-2 pb-1 text-sm font-bold uppercase tracking-wide"
        style={{ borderColor: "var(--hr-brand-accent)", color: "var(--hr-brand-primary)" }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

export function PrintFieldRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="mb-3 border-b border-dashed border-slate-200 pb-2 text-sm">
      <span className="font-medium text-slate-600">{label}</span>
      <p className="mt-1 min-h-[1.25rem] text-slate-900">{value?.trim() ? value : " "}</p>
    </div>
  );
}
