"use client";

import { ModalOverlay } from "@/components/modal-overlay";
import { MODAL_PANEL_LG, MODAL_PANEL_MD, MODAL_PANEL_SM, MODAL_PANEL_XL, MODAL_PANEL_XS, MODAL_PANEL_2XL } from "@/lib/modal-panel";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { LeadQuality } from "@/generated/prisma";
import { FormAlert, FormFieldError } from "@/components/form-message";
import { useSnackbar } from "@/components/snackbar";
import { UiSelect } from "@/components/ui-select";
import { ButtonSpinner } from "@/components/button-spinner";
import { sendWhatsAppToLead, updateLead } from "../actions";
import { ActivityFeed, type ActivityRow } from "@/components/activity-feed";

type DealRow = {
  id: string;
  stage: string;
  stageValue: string;
  value: string;
  unitLabel: string;
  projectName: string;
  projectId: string | null;
  ownerLabel: string;
  createdAt: string;
};

type LeadData = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  source: string | null;
  campaignId: string | null;
  campaignName: string | null | undefined;
  projectInterest: string | null;
  budgetRange: string | null;
  quality: LeadQuality;
  qualityLabel: string;
  score: number;
  lastActivityAt: string | null;
  assignedUserId: string | null;
  ownerLabel: string;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  notes: string | null;
  realtorPartnerName: string | null;
  createdAt: string;
  updatedAt: string;
};

type WhatsAppRow = {
  id: string;
  direction: string;
  body: string;
  timestamp: string;
  fromPhone: string | null;
  toPhone: string | null;
  status: string | null;
};

/** WhatsApp-style status ticks for outbound messages. */
function WaStatusTicks({ status }: { status: string | null }) {
  if (!status) return null;
  if (status === "failed") {
    return <span className="font-medium text-red-600" title="Failed to deliver">Failed</span>;
  }
  const double = status === "delivered" || status === "read";
  const read = status === "read";
  return (
    <span
      className={read ? "text-sky-500" : "text-muted"}
      title={status === "sent" ? "Sent" : status === "delivered" ? "Delivered" : "Read"}
      aria-label={status}
    >
      {double ? "✓✓" : "✓"}
    </span>
  );
}

type ActionResult = { ok: true } | { ok: false; error: string };
const initial: ActionResult | null = null;

function buildWhatsAppTemplates(lead: LeadData): Array<{ id: string; label: string; body: string }> {
  const firstName = lead.name.split(" ")[0] || "there";
  const project = lead.projectInterest ?? "your preferred property";
  return [
    {
      id: "intro",
      label: "Intro follow-up",
      body: `Hi ${firstName}, thanks for your interest in ${project}. I am your sales advisor from our team and I would like to guide you on available options. What time works best for a quick call today?`,
    },
    {
      id: "inspection",
      label: "Inspection booking",
      body: `Hi ${firstName}, we can schedule your site inspection for ${project}. Please share your preferred date and time, and I will confirm immediately.`,
    },
    {
      id: "negotiation",
      label: "Negotiation nudge",
      body: `Hi ${firstName}, just checking in on your decision for ${project}. If you are ready, I can walk you through available payment options and next steps today.`,
    },
    {
      id: "documents",
      label: "Document request",
      body: `Hi ${firstName}, to proceed with your reservation for ${project}, kindly share your full legal name and preferred email for documentation.`,
    },
  ];
}

function ScorePill({ score }: { score: number }) {
  const hot = score >= 70;
  const warm = score >= 40;
  const cls = hot
    ? "bg-red-500/10 text-red-600 ring-1 ring-red-400/40"
    : warm
      ? "bg-amber-400/10 text-amber-600 ring-1 ring-amber-400/40"
      : "bg-foreground/5 text-muted ring-1 ring-foreground/10";
  const emoji = hot ? "🔥" : warm ? "☀" : "❄";
  return (
    <span
      title={`Lead score: ${score}/100. Score is calculated from contact completeness, profile richness, source quality, engagement recency, and deal progress.`}
      className={`inline-flex cursor-help items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}
    >
      {emoji} {score}/100
    </span>
  );
}

const QUALITY_STYLES: Record<string, string> = {
  HOT: "bg-red-500/15 text-red-600 border border-red-500/30",
  WARM: "bg-amber-500/15 text-amber-600 border border-amber-500/30",
  COLD: "bg-sky-500/15 text-sky-600 border border-sky-500/30",
};

const STAGE_STYLES: Record<string, string> = {
  CLOSED_WON: "text-green-600",
  CLOSED_LOST: "text-red-500",
  RESERVATION_MADE: "text-amber-600",
};

export function LeadDetailWorkspace({
  tenantSlug,
  canEdit,
  lead,
  deals,
  users,
  projectOptions,
  campaignOptions,
  sourceOptions,
  activities,
  currentUserId,
  whatsappMessages,
}: {
  tenantSlug: string;
  canEdit: boolean;
  lead: LeadData;
  deals: DealRow[];
  users: { id: string; label: string }[];
  projectOptions: { id: string; name: string }[];
  campaignOptions: { id: string; label: string }[];
  sourceOptions: string[];
  activities: ActivityRow[];
  currentUserId: string;
  whatsappMessages: WhatsAppRow[];
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [isWhatsAppOpen, setIsWhatsAppOpen] = useState(false);
  const [waMessage, setWaMessage] = useState("");
  const [state, formAction, pending] = useActionState(
    updateLead.bind(null, tenantSlug, lead.id),
    initial,
  );
  const [waState, waAction, waPending] = useActionState(
    sendWhatsAppToLead.bind(null, tenantSlug, lead.id),
    initial,
  );
  const { showSnackbar } = useSnackbar();
  const formRef = useRef<HTMLFormElement | null>(null);
  const waFormRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      showSnackbar("Lead updated successfully.", "success");
      setIsEditing(false);
    } else {
      showSnackbar(state.error, "error");
    }
  }, [state, showSnackbar]);

  useEffect(() => {
    if (!waState) return;
    if (waState.ok) {
      showSnackbar("WhatsApp message sent.", "success");
      waFormRef.current?.reset();
      setWaMessage("");
      setIsWhatsAppOpen(false);
    } else {
      showSnackbar(waState.error, "error");
    }
  }, [waState, showSnackbar]);

  const qualityStyle = QUALITY_STYLES[lead.quality] ?? "bg-foreground/10 text-foreground border border-foreground/15";
  const waTemplates = buildWhatsAppTemplates(lead);

  return (
    <div className="w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href={`/${tenantSlug}/leads`}
            className="mb-2 inline-flex items-center gap-1 text-xs text-muted hover:text-foreground"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 6l-6 6 6 6" />
            </svg>
            Back to leads
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-foreground">{lead.name}</h1>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${qualityStyle}`}>
              {lead.qualityLabel}
            </span>
            <ScorePill score={lead.score} />
          </div>
          <p className="mt-0.5 text-sm text-muted">
            {lead.source ? `Source: ${lead.source}` : "No source"} ·{" "}
            {lead.ownerLabel} · Added {lead.createdAt.slice(0, 10)}
            {lead.lastActivityAt ? ` · Last activity ${lead.lastActivityAt}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lead.phone ? (
            <button
              type="button"
              onClick={() => setIsWhatsAppOpen(true)}
              className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-500/15"
            >
              WhatsApp
            </button>
          ) : null}
          {canEdit ? (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="rounded-md border border-foreground/20 px-4 py-2 text-sm font-medium text-foreground hover:bg-foreground/[0.06]"
            >
              Edit lead
            </button>
          ) : null}
          <Link
            href={`/${tenantSlug}/deals?leadId=${lead.id}`}
            className="rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background hover:opacity-90"
          >
            + Convert to deal
          </Link>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Left column: contact info + UTM */}
        <div className="space-y-4 lg:col-span-1">
          <section className="rounded-lg border border-foreground/10 bg-foreground/[0.015] p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-muted">Contact</p>
            <dl className="space-y-2 text-sm">
              <DetailRow label="Email" value={lead.email} href={lead.email ? `mailto:${lead.email}` : undefined} />
              <DetailRow label="Phone" value={lead.phone} href={lead.phone ? `tel:${lead.phone}` : undefined} />
              <DetailRow label="Budget" value={lead.budgetRange} />
              <DetailRow label="Project interest" value={lead.projectInterest} />
              <DetailRow label="Campaign" value={lead.campaignName} />
              <DetailRow label="Realtor partner" value={lead.realtorPartnerName} />
            </dl>
          </section>

          {(lead.utmSource || lead.utmMedium || lead.utmCampaign || lead.utmContent || lead.utmTerm) ? (
            <section className="rounded-lg border border-foreground/10 bg-foreground/[0.015] p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-muted">UTM tracking</p>
              <dl className="space-y-2 text-sm">
                <DetailRow label="utm_source" value={lead.utmSource} mono />
                <DetailRow label="utm_medium" value={lead.utmMedium} mono />
                <DetailRow label="utm_campaign" value={lead.utmCampaign} mono />
                <DetailRow label="utm_content" value={lead.utmContent} mono />
                <DetailRow label="utm_term" value={lead.utmTerm} mono />
              </dl>
            </section>
          ) : null}

          {lead.notes ? (
            <section className="rounded-lg border border-foreground/10 bg-foreground/[0.015] p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-muted">Form responses</p>
              <pre className="whitespace-pre-wrap font-sans text-sm text-foreground">{lead.notes}</pre>
            </section>
          ) : null}
        </div>

        {/* Right column: deals */}
        <div className="lg:col-span-2">
          <section>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-muted">
              Deals ({deals.length})
            </p>
            {deals.length === 0 ? (
              <div className="rounded-lg border border-foreground/10 p-6 text-center text-sm text-muted">
                No deals yet.{" "}
                <Link href={`/${tenantSlug}/deals?leadId=${lead.id}`} className="underline decoration-foreground/30 hover:text-foreground">
                  Convert this lead to a deal.
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-foreground/10 overflow-hidden rounded-lg border border-foreground/10">
                {deals.map((deal) => (
                  <div key={deal.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-foreground/[0.02]">
                    <div>
                      <p className="text-sm font-medium text-foreground">{deal.unitLabel}</p>
                      <p className="mt-0.5 text-xs text-muted">{deal.projectName} · {deal.ownerLabel} · {deal.createdAt}</p>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <span className={`font-medium ${STAGE_STYLES[deal.stageValue] ?? "text-foreground"}`}>
                        {deal.stage}
                      </span>
                      <span className="text-muted">{deal.value}</span>
                      <Link
                        href={`/${tenantSlug}/deals/${deal.id}`}
                        className="text-xs text-muted underline decoration-foreground/20 hover:text-foreground"
                      >
                        View
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="mt-6">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-muted">
              WhatsApp conversation
            </p>
            <div className="mb-6 rounded-lg border border-foreground/10 bg-foreground/[0.015] p-3">
              {whatsappMessages.length === 0 ? (
                <p className="text-sm text-muted">
                  No WhatsApp messages yet. Use the WhatsApp button above to start the conversation.
                </p>
              ) : (
                <div className="space-y-2">
                  {whatsappMessages.map((msg) => {
                    const inbound = msg.direction === "INBOUND";
                    return (
                      <div
                        key={msg.id}
                        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${inbound ? "mr-auto bg-foreground/[0.06]" : "ml-auto bg-emerald-500/10"}`}
                      >
                        <p className="whitespace-pre-wrap text-foreground">{msg.body}</p>
                        <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted">
                          <span>
                            {inbound ? "Inbound" : "Outbound"} · {new Date(msg.timestamp).toLocaleString()}
                          </span>
                          {!inbound ? <WaStatusTicks status={msg.status} /> : null}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-muted">
              Activity feed
            </p>
            <ActivityFeed
              tenantSlug={tenantSlug}
              entityType="LEAD"
              entityId={lead.id}
              initialActivities={activities}
              users={users}
              currentUserId={currentUserId}
              canManage={canEdit}
            />
          </section>
        </div>
      </div>

      {/* Edit modal */}
      <ModalOverlay open={Boolean(isEditing)} onClose={() => setIsEditing(false)} panelClassName={MODAL_PANEL_MD}>
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold text-foreground">Edit lead</h2>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-foreground/15 text-muted hover:bg-foreground/[0.06] hover:text-foreground"
                aria-label="Close"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            <form ref={formRef} action={formAction} className="mt-4 space-y-3">
              {state && !state.ok ? <FormAlert>{state.error}</FormAlert> : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="edit-lead-name" className="mb-1 block text-xs text-muted">Name *</label>
                  <input
                    id="edit-lead-name"
                    name="name"
                    defaultValue={lead.name}
                    required
                    className="w-full border border-foreground/15 bg-field px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-foreground/20"
                  />
                </div>
                <div>
                  <label htmlFor="edit-lead-phone" className="mb-1 block text-xs text-muted">Phone</label>
                  <input
                    id="edit-lead-phone"
                    name="phone"
                    defaultValue={lead.phone ?? ""}
                    placeholder="+234..."
                    className="w-full border border-foreground/15 bg-field px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-foreground/20"
                  />
                </div>
                <div>
                  <label htmlFor="edit-lead-email" className="mb-1 block text-xs text-muted">Email</label>
                  <input
                    id="edit-lead-email"
                    name="email"
                    type="email"
                    defaultValue={lead.email ?? ""}
                    className="w-full border border-foreground/15 bg-field px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-foreground/20"
                  />
                </div>
                <div>
                  <label htmlFor="edit-lead-budget" className="mb-1 block text-xs text-muted">Budget range</label>
                  <input
                    id="edit-lead-budget"
                    name="budgetRange"
                    defaultValue={lead.budgetRange ?? ""}
                    placeholder="e.g. ₦30–50M"
                    className="w-full border border-foreground/15 bg-field px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-foreground/20"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="edit-lead-source" className="mb-1 block text-xs text-muted">Source</label>
                  <UiSelect id="edit-lead-source" name="source" defaultValue={lead.source ?? ""}>
                    <option value="">— Select source —</option>
                    {sourceOptions.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </UiSelect>
                </div>
                <div>
                  <label htmlFor="edit-lead-quality" className="mb-1 block text-xs text-muted">Quality</label>
                  <UiSelect id="edit-lead-quality" name="quality" defaultValue={lead.quality}>
                    <option value={LeadQuality.HOT}>Hot</option>
                    <option value={LeadQuality.WARM}>Warm</option>
                    <option value={LeadQuality.COLD}>Cold</option>
                  </UiSelect>
                </div>
                <div>
                  <label htmlFor="edit-lead-project" className="mb-1 block text-xs text-muted">Project interest</label>
                  <UiSelect id="edit-lead-project" name="projectInterest" defaultValue={lead.projectInterest ?? ""}>
                    <option value="">— None —</option>
                    {projectOptions.map((p) => (
                      <option key={p.id} value={p.name}>{p.name}</option>
                    ))}
                  </UiSelect>
                </div>
                <div>
                  <label htmlFor="edit-lead-owner" className="mb-1 block text-xs text-muted">Assigned owner</label>
                  <UiSelect id="edit-lead-owner" name="assignedUserId" defaultValue={lead.assignedUserId ?? ""}>
                    <option value="">Unassigned</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.label}</option>
                    ))}
                  </UiSelect>
                </div>
                <div>
                  <label htmlFor="edit-lead-campaign" className="mb-1 block text-xs text-muted">Campaign</label>
                  <UiSelect id="edit-lead-campaign" name="campaignId" defaultValue={lead.campaignId ?? ""}>
                    <option value="">— None —</option>
                    {campaignOptions.map((c) => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </UiSelect>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="rounded-md border border-foreground/15 px-4 py-2 text-sm text-foreground hover:bg-foreground/[0.06]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pending}
                  aria-busy={pending}
                  className="inline-flex items-center gap-2 rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background hover:opacity-90 disabled:opacity-50"
                >
                  {pending ? <ButtonSpinner /> : null}
                  {pending ? "Saving…" : "Save changes"}
                </button>
              </div>
            </form>
      </ModalOverlay>

      {/* WhatsApp modal */}
      <ModalOverlay open={Boolean(isWhatsAppOpen)} onClose={() => setIsWhatsAppOpen(false)} panelClassName={MODAL_PANEL_MD}>
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold text-foreground">Send WhatsApp message</h2>
              <button
                type="button"
                onClick={() => setIsWhatsAppOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-foreground/15 text-muted hover:bg-foreground/[0.06] hover:text-foreground"
                aria-label="Close"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            <p className="mt-1 text-sm text-muted">
              Sending to <span className="font-medium text-foreground">{lead.phone}</span>
            </p>

            <form ref={waFormRef} action={waAction} className="mt-4 space-y-3">
              {waState && !waState.ok ? <FormAlert>{waState.error}</FormAlert> : null}

              <div>
                <p className="mb-2 text-xs text-muted">Quick templates</p>
                <div className="flex flex-wrap gap-2">
                  {waTemplates.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => setWaMessage(template.body)}
                      className="rounded-full border border-foreground/15 px-2.5 py-1 text-xs text-foreground hover:bg-foreground/[0.06]"
                    >
                      {template.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="wa-message" className="mb-1 block text-xs text-muted">Message *</label>
                <textarea
                  id="wa-message"
                  name="message"
                  value={waMessage}
                  onChange={(e) => setWaMessage(e.target.value)}
                  required
                  rows={5}
                  placeholder={`Hi ${lead.name}, just following up on your property interest.`}
                  className="w-full resize-y border border-foreground/15 bg-field px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-foreground/20"
                />
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsWhatsAppOpen(false)}
                  className="rounded-md border border-foreground/15 px-4 py-2 text-sm text-foreground hover:bg-foreground/[0.06]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={waPending}
                  aria-busy={waPending}
                  className="inline-flex items-center gap-2 rounded-md border border-emerald-600 bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                >
                  {waPending ? <ButtonSpinner /> : null}
                  {waPending ? "Sending…" : "Send WhatsApp"}
                </button>
              </div>
            </form>
      </ModalOverlay>
    </div>
  );
}

function DetailRow({
  label,
  value,
  href,
  mono,
}: {
  label: string;
  value: string | null | undefined;
  href?: string;
  mono?: boolean;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-2">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className={`text-right text-foreground ${mono ? "font-mono text-xs" : ""}`}>
        {href ? (
          <a href={href} className="underline decoration-foreground/30 hover:text-foreground">
            {value}
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}
