import type { TenantBranding } from "@/lib/tenant-branding";
import { brandingCssVars, formatOrgAddress } from "@/lib/tenant-branding";

export function BrandedDocumentShell({
  brand,
  title,
  subtitle,
  children,
  footerNote,
}: {
  brand: TenantBranding;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footerNote?: string;
}) {
  const address = formatOrgAddress(brand);
  const style = brandingCssVars(brand);

  return (
    <div
      className="mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white text-slate-900 shadow-sm print:max-w-none print:rounded-none print:border-0 print:shadow-none"
      style={style}
    >
      <header
        className="rounded-t-xl px-6 py-5 text-white print:rounded-none"
        style={{
          background: `linear-gradient(135deg, var(--hr-brand-primary) 0%, var(--hr-brand-accent) 100%)`,
        }}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            {brand.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={brand.logoUrl}
                alt=""
                className="h-14 w-auto max-w-[140px] rounded bg-white/95 object-contain p-1"
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-white/15 text-lg font-bold">
                {brand.companyName.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-lg font-bold tracking-tight">{brand.companyName}</p>
              {address ? <p className="mt-1 text-xs text-white/85">{address}</p> : null}
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/90">
                {brand.orgPhone ? <span>Phone: {brand.orgPhone}</span> : null}
                {brand.orgEmail ? <span>Email: {brand.orgEmail}</span> : null}
              </div>
            </div>
          </div>
          <div className="text-right">
            <h1 className="text-base font-bold uppercase tracking-wide">{title}</h1>
            {subtitle ? <p className="mt-1 text-xs text-white/85">{subtitle}</p> : null}
          </div>
        </div>
      </header>

      <div className="px-6 py-6">{children}</div>

      {footerNote ? (
        <footer className="border-t border-slate-200 px-6 py-4 text-center text-xs text-slate-500">
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
