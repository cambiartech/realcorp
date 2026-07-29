import type { ReactNode } from "react";

export const HR_FIELD_CLASS =
  "w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-3 pr-9 text-base text-slate-900 shadow-sm focus:border-[var(--hr-brand-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--hr-brand-accent)]/30 disabled:cursor-not-allowed disabled:bg-slate-100";

export function HrFieldChevron() {
  return (
    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-slate-500">
      <svg
        viewBox="0 0 20 20"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden
      >
        <path d="M5 7.5l5 5 5-5" />
      </svg>
    </span>
  );
}

export function HrFieldShell({ children }: { children: ReactNode }) {
  return <div className="relative">{children}</div>;
}

export const HR_LOCKED_FIELD_CLASS =
  "w-full rounded-lg border border-slate-200 bg-slate-100 px-3 py-2.5 text-base text-slate-700 cursor-not-allowed";

/** HR-provided value — visible but not editable by the candidate. */
export function HrFormLockedField({
  label,
  name,
  value,
  hint = "Provided by HR — contact them if this is wrong.",
}: {
  label: string;
  name: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="block text-sm">
      <span className="mb-1 block font-medium text-slate-700">{label}</span>
      <div className={HR_LOCKED_FIELD_CLASS}>{value || "—"}</div>
      <input type="hidden" name={name} value={value} />
      {hint ? <p className="mt-1 text-[11px] text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function HrFormField({
  label,
  name,
  type = "text",
  required,
  defaultValue,
  placeholder,
  className,
  children,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
  placeholder?: string;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <label className={`block text-sm ${className ?? ""}`}>
      <span className="mb-1 block font-medium text-slate-700">
        {label}
        {required ? <span className="text-[var(--danger)]"> *</span> : null}
      </span>
      {children ?? (
        <input
          name={name}
          type={type}
          required={required}
          defaultValue={defaultValue}
          placeholder={placeholder}
          className={HR_FIELD_CLASS.replace(" pr-9", " px-3")}
        />
      )}
    </label>
  );
}

export function HrFormSelect({
  label,
  name,
  required,
  defaultValue,
  options,
  onChange,
}: {
  label: string;
  name: string;
  required?: boolean;
  defaultValue?: string;
  options: { value: string; label: string }[];
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}) {
  return (
    <HrFormField label={label} name={name} required={required}>
      <HrFieldShell>
        <select
          name={name}
          required={required}
          defaultValue={defaultValue ?? ""}
          onChange={onChange}
          className={`${HR_FIELD_CLASS} appearance-none`}
        >
          {!options.some((o) => o.value === "") ? <option value="">Select…</option> : null}
          {options.map((o) => (
            <option key={o.value || "__empty"} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <HrFieldChevron />
      </HrFieldShell>
    </HrFormField>
  );
}

/** Searchable text field with datalist — matches HrFormSelect styling. */
export function HrFormCombobox({
  label,
  name,
  required,
  defaultValue,
  placeholder,
  disabled,
  options,
  hint,
}: {
  label: string;
  name: string;
  required?: boolean;
  defaultValue?: string;
  placeholder?: string;
  disabled?: boolean;
  options: string[];
  hint?: string;
}) {
  const listId = `${name}-datalist`;
  return (
    <div>
      <HrFormField label={label} name={name} required={required}>
        <HrFieldShell>
          <input
            name={name}
            list={options.length > 0 ? listId : undefined}
            defaultValue={defaultValue}
            placeholder={placeholder}
            disabled={disabled}
            required={required}
            autoComplete="address-level2"
            className={HR_FIELD_CLASS}
          />
          <HrFieldChevron />
        </HrFieldShell>
      </HrFormField>
      {options.length > 0 ? (
        <datalist id={listId}>
          {options.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      ) : null}
      {hint ? <p className="mt-1 text-[11px] text-slate-500">{hint}</p> : null}
    </div>
  );
}
