"use client";

export function HrPrintToolbar() {
  return (
    <div className="mb-6 flex justify-center print:hidden">
      <button
        type="button"
        onClick={() => window.print()}
        className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow-md"
        style={{ background: "var(--hr-brand-primary, #1e3a5f)" }}
      >
        Print or save as PDF
      </button>
    </div>
  );
}
