"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ButtonSpinner } from "@/components/button-spinner";
import { UiSelect } from "@/components/ui-select";
import { RichTextDisplay } from "@/components/rich-text-field";
import type { CaptureFormField } from "@/lib/capture-form-types";
import { submitCaptureForm, trackCaptureFormEvent } from "./actions";

function createSessionToken() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function readAttribution(search: URLSearchParams) {
  return {
    utmSource: search.get("utm_source") || undefined,
    utmMedium: search.get("utm_medium") || undefined,
    utmCampaign: search.get("utm_campaign") || undefined,
    utmContent: search.get("utm_content") || undefined,
    utmTerm: search.get("utm_term") || undefined,
    sharerUserId: search.get("ref") || undefined,
    realtorPartnerId: search.get("partner") || undefined,
    referrer: typeof document !== "undefined" ? document.referrer || undefined : undefined,
    landingUrl: typeof window !== "undefined" ? window.location.href : undefined,
  };
}

function clientContext() {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const localHour = new Date().getHours();
  return {
    timezone: tz,
    localHour,
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
  };
}

export function PublicCaptureFormClient({
  tenantSlug,
  formSlug,
  title,
  description,
  thankYouMessage,
  fields,
  projectOptions,
  brand,
  embed = false,
}: {
  tenantSlug: string;
  formSlug: string;
  title: string;
  description: string | null;
  thankYouMessage: string | null;
  fields: CaptureFormField[];
  projectOptions: string[];
  brand: { tenantName: string; logoUrl: string | null; accentColor: string | null };
  embed?: boolean;
}) {
  const sessionTokenRef = useRef<string>(createSessionToken());
  const startedRef = useRef(false);
  const submittedRef = useRef(false);
  const valuesRef = useRef<Record<string, string>>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const attribution = useMemo(() => {
    if (typeof window === "undefined") return {};
    return readAttribution(new URLSearchParams(window.location.search));
  }, []);

  const sendEvent = useCallback(
    async (
      type: "VIEW" | "START" | "FIELD_BLUR" | "PARTIAL_SAVE" | "SUBMIT" | "ABANDON",
      extra?: { fieldKey?: string; fieldValue?: string },
    ) => {
      await trackCaptureFormEvent(tenantSlug, formSlug, {
        sessionToken: sessionTokenRef.current,
        type,
        fieldKey: extra?.fieldKey,
        fieldValue: extra?.fieldValue,
        partialPayload: valuesRef.current,
        attribution,
        client: clientContext(),
      });
    },
    [attribution, formSlug, tenantSlug],
  );

  useEffect(() => {
    void sendEvent("VIEW");
  }, [sendEvent]);

  useEffect(() => {
    function onLeave() {
      if (submittedRef.current || !startedRef.current) return;
      const body = JSON.stringify({
        sessionToken: sessionTokenRef.current,
        type: "ABANDON",
        partialPayload: valuesRef.current,
        attribution,
        client: clientContext(),
      });
      navigator.sendBeacon?.(
        `/api/capture-forms/${tenantSlug}/${formSlug}/event`,
        new Blob([body], { type: "application/json" }),
      );
    }
    window.addEventListener("pagehide", onLeave);
    return () => window.removeEventListener("pagehide", onLeave);
  }, [attribution, formSlug, tenantSlug]);

  function updateValue(key: string, value: string) {
    valuesRef.current = { ...valuesRef.current, [key]: value };
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function onFieldFocus() {
    if (startedRef.current) return;
    startedRef.current = true;
    await sendEvent("START");
  }

  async function onFieldBlur(field: CaptureFormField) {
    const value = valuesRef.current[field.key] ?? "";
    await sendEvent("FIELD_BLUR", { fieldKey: field.key, fieldValue: value });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await submitCaptureForm(tenantSlug, formSlug, {
        sessionToken: sessionTokenRef.current,
        values: valuesRef.current,
        attribution,
        client: clientContext(),
      });
      if (!result?.ok) {
        setError(result?.error ?? "Could not submit form. Try again shortly.");
        requestAnimationFrame(() =>
          errorRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }),
        );
        return;
      }
      submittedRef.current = true;
      setDone(true);
      if (result.redirectUrl) {
        window.location.href = result.redirectUrl;
      }
    } catch {
      setError("Could not submit form. Try again shortly.");
      requestAnimationFrame(() => errorRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
    } finally {
      setLoading(false);
    }
  }

  const accent = brand.accentColor || "#1e3a5f";

  if (done) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-lg dark:border-stone-700 dark:bg-stone-950">
        <p className="text-lg font-semibold text-stone-900 dark:text-stone-100">You&apos;re all set</p>
        <p className="mt-2 text-sm text-stone-600 dark:text-stone-400">
          {thankYouMessage ?? "Thanks — we'll be in touch shortly."}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-lg rounded-2xl border border-stone-200 bg-white p-6 shadow-lg sm:p-8 dark:border-stone-700 dark:bg-stone-950">
      <div className="mb-6 flex items-center gap-3">
        {brand.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={brand.logoUrl} alt="" className="h-10 w-10 rounded-lg object-cover" />
        ) : (
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold text-white"
            style={{ backgroundColor: accent }}
          >
            {brand.tenantName.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div>
          <p className="text-xs uppercase tracking-wide text-stone-500">{brand.tenantName}</p>
          <h1 className="text-xl font-bold text-stone-900 dark:text-stone-100">{title}</h1>
        </div>
      </div>
      {description ? (
        <RichTextDisplay html={description} className="mb-5 text-stone-600 dark:text-stone-400" />
      ) : null}

      <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
        {error ? (
          <div
            ref={errorRef}
            role="alert"
            className="sm:col-span-2 rounded-lg border border-[var(--danger-line)] bg-[var(--danger-wash)] px-4 py-3 text-sm font-medium text-[var(--danger)]"
          >
            {error}
          </div>
        ) : null}
        {fields.map((field) => {
          const col = field.halfWidth ? "" : "sm:col-span-2";
          const common = {
            onFocus: onFieldFocus,
            onBlur: () => void onFieldBlur(field),
            value: values[field.key] ?? "",
            onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
              updateValue(field.key, e.target.value),
            className:
              "w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-400 dark:border-stone-600 dark:bg-stone-950 dark:text-stone-100",
          };

          if (field.type === "textarea") {
            return (
              <div key={field.key} className={col}>
                <label className="mb-1 block text-xs font-medium text-stone-600">
                  {field.label}
                  {field.required ? " *" : ""}
                </label>
                <textarea {...common} rows={3} placeholder={field.placeholder} required={field.required} />
              </div>
            );
          }

          if (field.type === "select") {
            return (
              <div key={field.key} className={col}>
                <label className="mb-1 block text-xs font-medium text-stone-600">
                  {field.label}
                  {field.required ? " *" : ""}
                </label>
                <UiSelect name={field.key} {...common} required={field.required}>
                  <option value="">Select…</option>
                  {(field.options ?? []).map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </UiSelect>
              </div>
            );
          }

          if (field.type === "project_interest") {
            return (
              <div key={field.key} className={col}>
                <label className="mb-1 block text-xs font-medium text-stone-600">{field.label}</label>
                <UiSelect name={field.key} {...common} required={field.required}>
                  <option value="">Select project</option>
                  {projectOptions.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </UiSelect>
              </div>
            );
          }

          const inputType =
            field.type === "email"
              ? "email"
              : field.type === "phone"
                ? "tel"
                : field.type === "number"
                  ? "number"
                  : "text";

          return (
            <div key={field.key} className={col}>
              <label className="mb-1 block text-xs font-medium text-stone-600">
                {field.label}
                {field.required ? " *" : ""}
              </label>
              <input
                type={inputType}
                name={field.key}
                placeholder={field.placeholder}
                required={field.required}
                {...common}
              />
            </div>
          );
        })}
        <div className="sm:col-span-2 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: accent }}
          >
            {loading ? <ButtonSpinner /> : null}
            {loading ? "Submitting…" : "Get access"}
          </button>
          {!embed ? <p className="mt-3 text-center text-[11px] text-stone-500">Powered by Realcorp</p> : null}
        </div>
      </form>
    </div>
  );
}
