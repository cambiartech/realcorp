/**
 * Form validation & error alerts — always use these (never ad-hoc grey error text).
 * Tokens: globals.css :root / .dark → --error, --error-bg, --error-border
 */

export function FormFieldError({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <p id={id} role="alert" className="mt-1.5 text-sm font-medium text-error">
      {children}
    </p>
  );
}

export function FormAlert({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="alert"
      className="border px-3 py-2 text-sm font-medium text-error bg-[var(--error-bg)] [border-color:var(--error-border)]"
    >
      {children}
    </div>
  );
}
