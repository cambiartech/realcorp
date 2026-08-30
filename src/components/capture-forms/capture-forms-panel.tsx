"use client";

import Link from "next/link";
import { LeadCaptureFormStatus } from "@/generated/prisma";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ManualCaptureFormFill } from "@/components/capture-forms/manual-capture-form-fill";
import { useSnackbar } from "@/components/snackbar";
import {
  buildCaptureFormShareUrl,
  captureFormPublicPath,
  type CaptureFormField,
} from "@/lib/capture-form-types";
import { formatEnumLabel } from "@/lib/ui-format";
import { updateLeadCaptureFormStatus } from "@/app/[tenantSlug]/marketing/capture-form-actions";

const SHARE_BTN =
  "inline-flex items-center rounded-md border border-foreground bg-background px-2.5 py-1.5 text-xs font-semibold text-foreground shadow-sm transition-colors hover:bg-foreground hover:text-background";

type CaptureFormRow = {
  id: string;
  name: string;
  slug: string;
  title: string;
  status: LeadCaptureFormStatus;
  viewCount: number;
  startCount: number;
  submitCount: number;
  campaignName: string | null;
  partnerName: string | null;
  createdAt: string;
  fields: CaptureFormField[];
};

type AnalyticsRow = {
  formId: string;
  formName: string;
  views: number;
  starts: number;
  partials: number;
  submits: number;
  conversionPct: number;
  topSource: string | null;
  peakHour: number | null;
};

function statusClass(status: LeadCaptureFormStatus) {
  if (status === LeadCaptureFormStatus.ACTIVE) return "bg-[var(--success-wash)] text-[var(--success)]";
  if (status === LeadCaptureFormStatus.PAUSED) return "bg-[var(--warn-wash)] text-[var(--warn)]";
  return "bg-foreground/10 text-muted";
}

export function CaptureFormsPanel({
  tenantSlug,
  canEdit,
  currentUserId,
  siteOrigin,
  forms,
  analytics,
  projectOptions,
}: {
  tenantSlug: string;
  canEdit: boolean;
  currentUserId: string;
  siteOrigin: string;
  forms: CaptureFormRow[];
  campaigns: Array<{ id: string; name: string; code: string }>;
  partners: Array<{ id: string; displayName: string }>;
  analytics: AnalyticsRow[];
  projectOptions: string[];
}) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { showSnackbar } = useSnackbar();
  const router = useRouter();

  const analyticsMap = useMemo(() => new Map(analytics.map((a) => [a.formId, a])), [analytics]);

  async function copyLink(form: CaptureFormRow, preset?: "instagram" | "linkedin" | "personal") {
    const params =
      preset === "instagram"
        ? { utmSource: "instagram", utmMedium: "bio", utmCampaign: form.slug }
        : preset === "linkedin"
          ? { utmSource: "linkedin", utmMedium: "bio", utmCampaign: form.slug }
          : { utmSource: "direct", utmMedium: "sales", ref: currentUserId };
    const url = buildCaptureFormShareUrl(siteOrigin, tenantSlug, form.slug, params);
    await navigator.clipboard.writeText(url);
    setCopiedId(`${form.id}-${preset ?? "default"}`);
    showSnackbar("Link copied to clipboard.", "success");
    setTimeout(() => setCopiedId(null), 2000);
  }

  async function toggleStatus(form: CaptureFormRow) {
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Capture forms</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Lead magnets for social bios, WhatsApp status, and community partners. Fill a form for someone
            who calls in or cannot use their phone. Track views, partial fills, and submissions with UTM
            attribution.
          </p>
        </div>
        {canEdit ? (
          <Link
            href={`/${tenantSlug}/marketing/forms/new`}
            className="rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background"
          >
            New capture form
          </Link>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Active forms",
            value: forms.filter((f) => f.status === LeadCaptureFormStatus.ACTIVE).length,
          },
          { label: "Total views", value: forms.reduce((s, f) => s + f.viewCount, 0) },
          { label: "Started", value: forms.reduce((s, f) => s + f.startCount, 0) },
          { label: "Submissions", value: forms.reduce((s, f) => s + f.submitCount, 0) },
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg border border-foreground/10 bg-foreground/[0.02] p-4">
            <p className="text-xs uppercase tracking-wide text-muted">{stat.label}</p>
            <p className="mt-1 text-2xl font-bold">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-foreground/10">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-foreground/10 bg-foreground/[0.03] text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-3">Form</th>
              <th className="px-4 py-3">Funnel</th>
              <th className="px-4 py-3">Attribution</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
              <th className="px-4 py-3">Copy links</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-foreground/10">
            {forms.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted">
                  No capture forms yet.{" "}
                  {canEdit ? (
                    <Link
                      href={`/${tenantSlug}/marketing/forms/new`}
                      className="font-semibold text-foreground underline"
                    >
                      Create your first form
                    </Link>
                  ) : (
                    "Ask a marketing admin to create one."
                  )}
                </td>
              </tr>
            ) : (
              forms.map((form) => {
                const stats = analyticsMap.get(form.id);
                const conv =
                  stats && stats.views > 0 ? `${Math.round((stats.submits / stats.views) * 100)}% conv` : "—";
                return (
                  <tr key={form.id} className="hover:bg-foreground/[0.02]">
                    <td className="px-4 py-3">
                      <p className="font-medium">{form.name}</p>
                      <p className="text-xs text-muted">{form.title}</p>
                      <code className="mt-1 block text-[11px] text-muted">
                        {captureFormPublicPath(tenantSlug, form.slug)}
                      </code>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">
                      <p>
                        {form.viewCount} views → {form.startCount} starts
                      </p>
                      <p>
                        {stats?.partials ?? 0} partial · {form.submitCount} done ({conv})
                      </p>
                      {stats?.peakHour != null ? <p>Peak hour: {stats.peakHour}:00 local</p> : null}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">
                      {form.campaignName ? <p>Campaign: {form.campaignName}</p> : null}
                      {form.partnerName ? <p>Partner: {form.partnerName}</p> : null}
                      {stats?.topSource ? <p>Top source: {stats.topSource}</p> : null}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusClass(form.status)}`}
                      >
                        {formatEnumLabel(form.status)}
                      </span>
                      {canEdit ? (
                        <button
                          type="button"
                          onClick={() => void toggleStatus(form)}
                          className="ml-2 text-xs underline"
                        >
                          {form.status === LeadCaptureFormStatus.ACTIVE ? "Pause" : "Activate"}
                        </button>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        {canEdit ? (
                          <ManualCaptureFormFill
                            tenantSlug={tenantSlug}
                            formSlug={form.slug}
                            formName={form.name}
                            formTitle={form.title}
                            fields={form.fields}
                            projectOptions={projectOptions}
                          />
                        ) : null}
                        {canEdit ? (
                          <Link
                            href={`/${tenantSlug}/marketing/forms/${form.id}?tab=builder`}
                            className="inline-flex w-fit rounded-md border border-foreground bg-foreground px-2.5 py-1 text-xs font-semibold text-background"
                          >
                            Edit form
                          </Link>
                        ) : null}
                        <Link
                          href={`/${tenantSlug}/marketing/forms/${form.id}?tab=analytics`}
                          className="text-xs font-semibold text-foreground underline"
                        >
                          Analytics & UTM
                        </Link>
                        <a
                          href={`${siteOrigin}${captureFormPublicPath(tenantSlug, form.slug)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-muted underline"
                        >
                          Preview live
                        </a>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          title="Copy your tracked sales link"
                          onClick={() => void copyLink(form, "personal")}
                          className={SHARE_BTN}
                        >
                          {copiedId === `${form.id}-personal` ? "Copied" : "Copy my link"}
                        </button>
                        <button
                          type="button"
                          title="Copy Instagram bio link"
                          onClick={() => void copyLink(form, "instagram")}
                          className={SHARE_BTN}
                        >
                          {copiedId === `${form.id}-instagram` ? "Copied" : "Copy IG bio"}
                        </button>
                        <button
                          type="button"
                          title="Copy LinkedIn bio link"
                          onClick={() => void copyLink(form, "linkedin")}
                          className={SHARE_BTN}
                        >
                          {copiedId === `${form.id}-linkedin` ? "Copied" : "Copy LinkedIn"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
