"use client";

import Link from "next/link";
import { LeadCaptureFormStatus } from "@/generated/prisma";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { CaptureFormBuilder } from "@/components/capture-forms/capture-form-builder";
import { ButtonSpinner } from "@/components/button-spinner";
import { FormAlert } from "@/components/form-message";
import { RichTextField } from "@/components/rich-text-field";
import { useSnackbar } from "@/components/snackbar";
import { UiSelect } from "@/components/ui-select";
import { createLeadCaptureForm } from "@/app/[tenantSlug]/marketing/capture-form-actions";
import {
  CAPTURE_FORM_TEMPLATES,
  resolveCaptureFormTemplate,
  type CaptureFormTemplateId,
} from "@/lib/capture-form-templates";
import type { CaptureFormField } from "@/lib/capture-form-types";
import { slugifyCaptureFormName } from "@/lib/capture-form-types";

export function CaptureFormNewWorkspace({
  tenantSlug,
  campaigns,
  partners,
}: {
  tenantSlug: string;
  campaigns: Array<{ id: string; name: string; code: string }>;
  partners: Array<{ id: string; displayName: string }>;
}) {
  const router = useRouter();
  const { showSnackbar } = useSnackbar();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState<CaptureFormTemplateId>("lead_magnet");
  const [fields, setFields] = useState<CaptureFormField[]>(() => resolveCaptureFormTemplate("lead_magnet"));
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");

  const slugPreview = slug.trim() || (name ? slugifyCaptureFormName(name) : "your-slug");

  function applyTemplate(id: CaptureFormTemplateId) {
    setTemplateId(id);
    setFields(resolveCaptureFormTemplate(id));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!fields.length) {
      setError("Add at least one field to your form.");
      return;
    }
    setPending(true);
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set("fieldsTemplate", templateId);
    fd.set("fields", JSON.stringify(fields));

    const result = await createLeadCaptureForm(tenantSlug, null, fd);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      showSnackbar(result.error, "error");
      return;
    }
    showSnackbar("Form created — finish editing or activate when ready.", "success");
    router.push(`/${tenantSlug}/marketing/forms/${result.id}?tab=builder`);
  }

  const templateMeta = useMemo(() => CAPTURE_FORM_TEMPLATES.find((t) => t.id === templateId), [templateId]);

  return (
    <div className="w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
      <Link href={`/${tenantSlug}/marketing`} className="text-xs text-muted hover:text-foreground">
        ← Marketing · Capture forms
      </Link>
      <h1 className="mt-2 text-2xl font-bold">Create capture form</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        Set up your lead magnet, build custom fields, then activate and share with UTM-tracked links.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-8">
        {error ? <FormAlert>{error}</FormAlert> : null}

        <section className="rounded-xl border border-foreground/10 p-5 sm:p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">1 · Form details</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-muted">Internal name</label>
              <input
                name="name"
                required
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!slug) setSlug(slugifyCaptureFormName(e.target.value));
                }}
                className="w-full border border-foreground/15 bg-field px-3 py-2"
                placeholder="Khalifa Heights launch"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted">URL slug</label>
              <input
                name="slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="w-full border border-foreground/15 bg-field px-3 py-2 font-mono text-sm"
                placeholder={slugPreview}
              />
              <p className="mt-1 text-xs text-muted">
                /f/{tenantSlug}/{slugPreview}
              </p>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm text-muted">Public headline</label>
              <input
                name="title"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full border border-foreground/15 bg-field px-3 py-2"
                placeholder="Get our free investment guide"
              />
            </div>
            <div className="sm:col-span-2">
              <RichTextField
                name="description"
                label="Description"
                placeholder="Tell prospects what they'll receive."
                minHeight="5.5rem"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted">Campaign</label>
              <UiSelect name="campaignId" defaultValue="">
                <option value="">None</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </UiSelect>
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted">Community partner</label>
              <UiSelect name="realtorPartnerId" defaultValue="">
                <option value="">None</option>
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.displayName}
                  </option>
                ))}
              </UiSelect>
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted">Lead source label</label>
              <input
                name="defaultSource"
                defaultValue="Lead Form"
                className="w-full border border-foreground/15 bg-field px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted">Status</label>
              <UiSelect name="status" defaultValue={LeadCaptureFormStatus.DRAFT}>
                <option value={LeadCaptureFormStatus.DRAFT}>Draft</option>
                <option value={LeadCaptureFormStatus.ACTIVE}>Active</option>
              </UiSelect>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-foreground/10 p-5 sm:p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            2 · Start from a template
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {CAPTURE_FORM_TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => applyTemplate(t.id)}
                className={`rounded-lg border p-4 text-left transition-colors ${
                  templateId === t.id
                    ? "border-foreground bg-foreground/[0.04]"
                    : "border-foreground/10 hover:border-foreground/25"
                }`}
              >
                <p className="font-semibold text-foreground">{t.name}</p>
                <p className="mt-1 text-xs text-muted">{t.description}</p>
              </button>
            ))}
          </div>
          {templateMeta ? (
            <p className="mt-3 text-xs text-muted">
              Selected: <strong>{templateMeta.name}</strong> — customize fields below.
            </p>
          ) : null}
        </section>

        <section className="rounded-xl border border-foreground/10 p-5 sm:p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">3 · Build your form</h2>
          <div className="mt-4">
            <CaptureFormBuilder fields={fields} onChange={setFields} title={title || "Form headline"} />
          </div>
        </section>

        <div className="flex flex-wrap justify-end gap-3 border-t border-foreground/10 pt-6">
          <Link href={`/${tenantSlug}/marketing`} className="rounded-md border px-4 py-2 text-sm">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-md border border-foreground bg-foreground px-5 py-2 text-sm font-semibold text-background"
          >
            {pending ? <ButtonSpinner /> : null}
            {pending ? "Creating…" : "Create form"}
          </button>
        </div>
      </form>
    </div>
  );
}
