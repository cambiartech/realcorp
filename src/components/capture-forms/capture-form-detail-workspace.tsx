"use client";

import Link from "next/link";
import { LeadCaptureFormStatus } from "@/generated/prisma";
import { useRouter, useSearchParams } from "next/navigation";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { CaptureFormBuilder } from "@/components/capture-forms/capture-form-builder";
import {
  updateLeadCaptureFormFields,
  updateLeadCaptureFormSettings,
  updateLeadCaptureFormStatus,
  type CaptureFormActionResult,
} from "@/app/[tenantSlug]/marketing/capture-form-actions";
import { ButtonSpinner } from "@/components/button-spinner";
import { FormAlert } from "@/components/form-message";
import { RichTextField } from "@/components/rich-text-field";
import { useSnackbar } from "@/components/snackbar";
import { UiSelect } from "@/components/ui-select";
import { UTM_PARAM_HELP } from "@/lib/capture-form-analytics";
import { buildEmbedSnippet, captureFormEmbedPath, qrCodeImageUrl } from "@/lib/capture-form-share";
import {
  buildCaptureFormShareUrl,
  captureFormPublicPath,
  type CaptureFormField,
} from "@/lib/capture-form-types";
import { formatEnumLabel } from "@/lib/ui-format";
import { ManualCaptureFormFill } from "@/components/capture-forms/manual-capture-form-fill";

type TabId = "builder" | "analytics" | "settings" | "links" | "share";

type UtmRow = { label: string; count: number };

const initial: CaptureFormActionResult | null = null;

function UtmBreakdownTable({ title, rows }: { title: string; rows: UtmRow[] }) {
  if (!rows.length) return null;
  const max = rows[0]?.count ?? 1;
  return (
    <div className="rounded-lg border border-foreground/10 p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">{title}</p>
      <ul className="space-y-2">
        {rows.slice(0, 8).map((row) => (
          <li key={row.label}>
            <div className="mb-1 flex justify-between text-sm">
              <span className="font-mono text-foreground">{row.label}</span>
              <span className="text-muted">{row.count}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-foreground/10">
              <div
                className="h-full bg-foreground/50"
                style={{ width: `${Math.round((row.count / max) * 100)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CaptureFormDetailWorkspace({
  tenantSlug,
  canEdit,
  currentUserId,
  siteOrigin,
  form,
  analytics,
  campaigns,
  partners,
  projectOptions,
}: {
  tenantSlug: string;
  canEdit: boolean;
  currentUserId: string;
  siteOrigin: string;
  form: {
    id: string;
    name: string;
    slug: string;
    title: string;
    description: string | null;
    status: LeadCaptureFormStatus;
    thankYouMessage: string | null;
    redirectUrl: string | null;
    defaultSource: string | null;
    campaignId: string | null;
    realtorPartnerId: string | null;
    autoWhatsAppEnabled: boolean;
    autoWhatsAppMessage: string | null;
    campaignLabel: string | null;
    partnerName: string | null;
    fields: CaptureFormField[];
  };
  analytics: {
    funnel: {
      views: number;
      starts: number;
      partials: number;
      submits: number;
      viewToStartPct: number;
      startToSubmitPct: number;
    };
    utm: {
      bySource: UtmRow[];
      byMedium: UtmRow[];
      byCampaign: UtmRow[];
      byContent: UtmRow[];
      byTerm: UtmRow[];
    };
    hourBuckets: Array<{ hour: number; count: number }>;
    peakHour: number | null;
    abandonByField: UtmRow[];
    deviceBreakdown: UtmRow[];
    countryBreakdown: UtmRow[];
  };
  campaigns: Array<{ id: string; name: string; code: string }>;
  partners: Array<{ id: string; displayName: string }>;
  projectOptions: string[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showSnackbar } = useSnackbar();
  const initialTab = (searchParams.get("tab") as TabId | null) ?? (canEdit ? "builder" : "analytics");
  const [tab, setTab] = useState<TabId>(
    ["builder", "analytics", "settings", "links", "share"].includes(initialTab) ? initialTab : "builder",
  );
  const [fields, setFields] = useState(form.fields);
  const [savingFields, setSavingFields] = useState(false);

  const [utmSource, setUtmSource] = useState("instagram");
  const [utmMedium, setUtmMedium] = useState("bio");
  const [utmCampaign, setUtmCampaign] = useState(form.slug);
  const [utmContent, setUtmContent] = useState("");
  const [utmTerm, setUtmTerm] = useState("");
  const [linkRef, setLinkRef] = useState(currentUserId);
  const [linkPartner, setLinkPartner] = useState(form.realtorPartnerId ?? "");

  const settingsAction = updateLeadCaptureFormSettings.bind(null, tenantSlug, form.id);
  const [settingsState, settingsFormAction, settingsPending] = useActionState(settingsAction, initial);
  const settingsRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    if (!settingsState) return;
    if (settingsState.ok) {
      showSnackbar("Form settings saved.", "success");
      router.refresh();
    } else showSnackbar(settingsState.error, "error");
  }, [router, settingsState, showSnackbar]);

  const previewUrl = useMemo(
    () =>
      buildCaptureFormShareUrl(siteOrigin, tenantSlug, form.slug, {
        utmSource,
        utmMedium,
        utmCampaign: utmCampaign || form.slug,
        utmContent: utmContent || undefined,
        utmTerm: utmTerm || undefined,
        ref: linkRef || undefined,
        partner: linkPartner || undefined,
      }),
    [
      siteOrigin,
      tenantSlug,
      form.slug,
      utmSource,
      utmMedium,
      utmCampaign,
      utmContent,
      utmTerm,
      linkRef,
      linkPartner,
    ],
  );

  async function saveFields() {
    if (!fields.length) {
      showSnackbar("Add at least one field.", "error");
      return;
    }
    setSavingFields(true);
    const result = await updateLeadCaptureFormFields(tenantSlug, form.id, fields);
    setSavingFields(false);
    if (result.ok) {
      showSnackbar("Fields saved.", "success");
      router.refresh();
    } else showSnackbar(result.error, "error");
  }

  async function toggleStatus() {
    const next =
      form.status === LeadCaptureFormStatus.ACTIVE
        ? LeadCaptureFormStatus.PAUSED
        : LeadCaptureFormStatus.ACTIVE;
    const result = await updateLeadCaptureFormStatus(tenantSlug, form.id, next);
    if (result.ok) {
      showSnackbar(`Form ${next === LeadCaptureFormStatus.ACTIVE ? "activated" : "paused"}.`, "success");
      router.refresh();
    } else showSnackbar(result.error, "error");
  }

  async function copyUrl() {
    await navigator.clipboard.writeText(previewUrl);
    showSnackbar("UTM link copied.", "success");
  }

  const embedSnippet = useMemo(
    () => buildEmbedSnippet(siteOrigin, tenantSlug, form.slug),
    [siteOrigin, tenantSlug, form.slug],
  );
  const embedPreviewUrl = `${siteOrigin}${captureFormEmbedPath(tenantSlug, form.slug)}`;
  const publicPath = captureFormPublicPath(tenantSlug, form.slug);

  async function copyText(text: string, label: string) {
    await navigator.clipboard.writeText(text);
    showSnackbar(`${label} copied.`, "success");
  }

  return (
    <div className="w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
      <Link href={`/${tenantSlug}/marketing`} className="text-xs text-muted hover:text-foreground">
        ← Marketing
      </Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{form.name}</h1>
          <p className="mt-1 text-sm text-muted">{form.title}</p>
          <code className="mt-1 block text-xs text-muted">{publicPath}</code>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-foreground/10 px-2.5 py-0.5 text-xs font-semibold">
            {formatEnumLabel(form.status)}
          </span>
          {canEdit ? (
            <button
              type="button"
              onClick={() => void toggleStatus()}
              className="rounded-md border px-3 py-1.5 text-xs"
            >
              {form.status === LeadCaptureFormStatus.ACTIVE ? "Pause" : "Activate"}
            </button>
          ) : null}
          {canEdit ? (
            <ManualCaptureFormFill
              tenantSlug={tenantSlug}
              formSlug={form.slug}
              formName={form.name}
              formTitle={form.title}
              fields={form.fields}
              projectOptions={projectOptions}
              triggerClassName="rounded-md border border-foreground px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-foreground hover:text-background"
            />
          ) : null}
          <a
            href={previewUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-foreground bg-foreground px-3 py-1.5 text-xs font-semibold text-background"
          >
            Preview form
          </a>
        </div>
      </div>

      <div className="mt-6 flex gap-2 border-b border-foreground/10">
        {(
          [
            ["builder", "Form builder"],
            ["analytics", "Analytics & UTM"],
            ["links", "UTM link builder"],
            ["share", "QR & embed"],
            ["settings", "Settings"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold ${
              tab === key ? "border-foreground text-foreground" : "border-transparent text-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "builder" ? (
        <div className="mt-6 space-y-4">
          <CaptureFormBuilder
            fields={fields}
            onChange={canEdit ? setFields : () => {}}
            readOnly={!canEdit}
            title={form.title}
            description={form.description}
          />
          {canEdit ? (
            <button
              type="button"
              disabled={savingFields}
              onClick={() => void saveFields()}
              className="inline-flex items-center gap-2 rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background"
            >
              {savingFields ? <ButtonSpinner /> : null}
              Save form fields
            </button>
          ) : null}
        </div>
      ) : null}

      {tab === "analytics" ? (
        <div className="mt-6 space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              { label: "Views", value: analytics.funnel.views },
              {
                label: "Started",
                value: analytics.funnel.starts,
                sub: `${analytics.funnel.viewToStartPct}% of views`,
              },
              { label: "Partial / abandon", value: analytics.funnel.partials },
              {
                label: "Submissions",
                value: analytics.funnel.submits,
                sub: `${analytics.funnel.startToSubmitPct}% of starts`,
              },
              {
                label: "Peak hour (local)",
                value: analytics.peakHour != null ? `${analytics.peakHour}:00` : "—",
              },
            ].map((s) => (
              <div key={s.label} className="rounded-lg border border-foreground/10 bg-foreground/[0.02] p-4">
                <p className="text-xs uppercase tracking-wide text-muted">{s.label}</p>
                <p className="mt-1 text-2xl font-bold">{s.value}</p>
                {"sub" in s && s.sub ? <p className="text-xs text-muted">{s.sub}</p> : null}
              </div>
            ))}
          </div>

          <div>
            <p className="mb-3 text-sm font-semibold">UTM breakdown — where visitors came from</p>
            <div className="grid gap-4 lg:grid-cols-2">
              <UtmBreakdownTable title="utm_source (platform)" rows={analytics.utm.bySource} />
              <UtmBreakdownTable title="utm_medium (channel)" rows={analytics.utm.byMedium} />
              <UtmBreakdownTable title="utm_campaign" rows={analytics.utm.byCampaign} />
              <UtmBreakdownTable title="utm_content (variant)" rows={analytics.utm.byContent} />
              <UtmBreakdownTable title="utm_term (keyword)" rows={analytics.utm.byTerm} />
              <UtmBreakdownTable title="Drop-off at field" rows={analytics.abandonByField} />
            </div>
          </div>

          {analytics.hourBuckets.length > 0 ? (
            <div className="rounded-lg border border-foreground/10 p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
                Time of day (visitor local hour)
              </p>
              <div className="flex flex-wrap gap-2">
                {analytics.hourBuckets.map((b) => (
                  <span key={b.hour} className="rounded border border-foreground/10 px-2 py-1 text-xs">
                    {b.hour}:00 — {b.count}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <UtmBreakdownTable title="Device" rows={analytics.deviceBreakdown} />
            <UtmBreakdownTable title="Country" rows={analytics.countryBreakdown} />
          </div>
        </div>
      ) : null}

      {tab === "links" ? (
        <div className="mt-6 max-w-2xl space-y-4">
          <p className="text-sm text-muted">
            Build tracked links for bio posts, stories, or sales reps. All five UTM parameters are captured on
            every visit and stored on the lead when they submit.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ["utm_source", utmSource, setUtmSource],
                ["utm_medium", utmMedium, setUtmMedium],
                ["utm_campaign", utmCampaign, setUtmCampaign],
                ["utm_content", utmContent, setUtmContent],
                ["utm_term", utmTerm, setUtmTerm],
              ] as const
            ).map(([key, value, setter]) => (
              <div key={key} className={key === "utm_campaign" ? "sm:col-span-2" : ""}>
                <label className="mb-1 block text-xs font-medium text-muted">{key}</label>
                <input
                  value={value}
                  onChange={(e) => setter(e.target.value)}
                  className="w-full border border-foreground/15 bg-field px-3 py-2 font-mono text-sm"
                  placeholder={key === "utm_campaign" ? form.slug : ""}
                />
                <p className="mt-1 text-[11px] text-muted">{UTM_PARAM_HELP[key]}</p>
              </div>
            ))}
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Sales rep (ref)</label>
              <input
                value={linkRef}
                onChange={(e) => setLinkRef(e.target.value)}
                className="w-full border border-foreground/15 bg-field px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Community partner</label>
              <UiSelect value={linkPartner} onChange={(e) => setLinkPartner(e.target.value)}>
                <option value="">None</option>
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.displayName}
                  </option>
                ))}
              </UiSelect>
            </div>
          </div>
          <div className="rounded-lg border border-foreground/10 bg-foreground/[0.02] p-4">
            <p className="mb-2 text-xs font-semibold uppercase text-muted">Generated URL</p>
            <p className="break-all font-mono text-xs text-foreground">{previewUrl}</p>
            <button
              type="button"
              onClick={() => void copyUrl()}
              className="mt-3 rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background"
            >
              Copy link
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { label: "Instagram bio", source: "instagram", medium: "bio", content: "bio-link" },
              { label: "Instagram story", source: "instagram", medium: "story", content: "story-swipe" },
              { label: "TikTok bio", source: "tiktok", medium: "bio", content: "" },
              { label: "WhatsApp status", source: "whatsapp", medium: "status", content: "" },
            ].map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  setUtmSource(preset.source);
                  setUtmMedium(preset.medium);
                  setUtmCampaign(form.slug);
                  setUtmContent(preset.content);
                }}
                className="rounded-md border border-foreground bg-background px-2.5 py-1.5 text-xs font-semibold text-foreground shadow-sm hover:bg-foreground hover:text-background"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {tab === "share" ? (
        <div className="mt-6 grid gap-8 lg:grid-cols-2">
          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold">QR code</p>
              <p className="mt-1 text-sm text-muted">
                Print on flyers, show at open houses, or add to WhatsApp status. Scans open your tracked form
                URL.
              </p>
            </div>
            <div className="inline-block rounded-xl border border-foreground/10 bg-white p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrCodeImageUrl(previewUrl)}
                alt="QR code for capture form"
                width={240}
                height={240}
                className="block"
              />
            </div>
            <button
              type="button"
              onClick={() => void copyText(previewUrl, "Form URL")}
              className="rounded-md border px-4 py-2 text-sm"
            >
              Copy form URL
            </button>
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold">Website embed</p>
              <p className="mt-1 text-sm text-muted">
                Paste this iframe on your site or landing page. Uses the embed route:{" "}
                <code className="text-xs">{captureFormEmbedPath(tenantSlug, form.slug)}</code>
              </p>
            </div>
            <pre className="overflow-x-auto rounded-lg border border-foreground/10 bg-foreground/[0.03] p-4 text-xs">
              {embedSnippet}
            </pre>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void copyText(embedSnippet, "Embed code")}
                className="rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background"
              >
                Copy embed code
              </button>
              <a
                href={embedPreviewUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-md border px-4 py-2 text-sm"
              >
                Preview embed
              </a>
            </div>
          </div>
        </div>
      ) : null}

      {tab === "settings" ? (
        <form ref={settingsRef} action={settingsFormAction} className="mt-6 max-w-2xl space-y-4">
          {settingsState && !settingsState.ok ? <FormAlert>{settingsState.error}</FormAlert> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-muted">Internal name</label>
              <input
                name="name"
                defaultValue={form.name}
                required
                disabled={!canEdit}
                className="w-full border border-foreground/15 bg-field px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted">Public headline</label>
              <input
                name="title"
                defaultValue={form.title}
                required
                disabled={!canEdit}
                className="w-full border border-foreground/15 bg-field px-3 py-2"
              />
            </div>
            <div className="sm:col-span-2">
              <RichTextField
                name="description"
                label="Description"
                defaultValue={form.description ?? ""}
                readOnly={!canEdit}
                placeholder="Tell prospects what they'll receive."
                minHeight="5.5rem"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted">Campaign</label>
              <UiSelect name="campaignId" defaultValue={form.campaignId ?? ""} disabled={!canEdit}>
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
              <UiSelect
                name="realtorPartnerId"
                defaultValue={form.realtorPartnerId ?? ""}
                disabled={!canEdit}
              >
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
                defaultValue={form.defaultSource ?? "Lead Form"}
                disabled={!canEdit}
                className="w-full border border-foreground/15 bg-field px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted">Redirect URL (optional)</label>
              <input
                name="redirectUrl"
                defaultValue={form.redirectUrl ?? ""}
                disabled={!canEdit}
                className="w-full border border-foreground/15 bg-field px-3 py-2"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm text-muted">Thank you message</label>
              <textarea
                name="thankYouMessage"
                rows={2}
                defaultValue={form.thankYouMessage ?? ""}
                disabled={!canEdit}
                className="w-full border border-foreground/15 bg-field px-3 py-2"
              />
            </div>
            <div className="sm:col-span-2 rounded-lg border border-foreground/10 bg-foreground/[0.02] p-4">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  name="autoWhatsAppEnabled"
                  defaultChecked={form.autoWhatsAppEnabled}
                  disabled={!canEdit}
                />
                Auto WhatsApp follow-up on submit
              </label>
              <p className="mt-1 text-xs text-muted">
                Requires WhatsApp Cloud API in Settings → Integrations. Sends when the lead includes a phone
                number.
              </p>
              <label className="mb-1 mt-3 block text-sm text-muted">Message template</label>
              <textarea
                name="autoWhatsAppMessage"
                rows={3}
                disabled={!canEdit}
                defaultValue={
                  form.autoWhatsAppMessage ??
                  "Hi {name}, thanks for your interest in {form_title}! A member of our team will reach out shortly."
                }
                className="w-full border border-foreground/15 bg-field px-3 py-2 text-sm"
              />
              <p className="mt-1 text-xs text-muted">
                Placeholders: {"{name}"}, {"{form_title}"}, {"{org_name}"}
              </p>
            </div>
          </div>
          {canEdit ? (
            <button
              type="submit"
              disabled={settingsPending}
              className="inline-flex items-center gap-2 rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background"
            >
              {settingsPending ? <ButtonSpinner /> : null}
              Save settings
            </button>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}
