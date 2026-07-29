"use client";

import { ModalOverlay } from "@/components/modal-overlay";
import {
  MODAL_PANEL_LG,
  MODAL_PANEL_MD,
  MODAL_PANEL_SM,
  MODAL_PANEL_XL,
  MODAL_PANEL_XS,
  MODAL_PANEL_2XL,
} from "@/lib/modal-panel";
import { FormAlert } from "@/components/form-message";
import { useSnackbar } from "@/components/snackbar";
import { UiSelect } from "@/components/ui-select";
import { ButtonSpinner } from "@/components/button-spinner";
import {
  type CommunityMemberLeaderboardEntry,
  type CommunityLeaderboardPeriod,
  formatLeaderboardMoney,
} from "@/lib/community-leaderboard";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { createRealtorPartner, rotateRealtorPortalToken, setRealtorPartnerActive } from "./actions";

type PartnerRow = {
  id: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  territory: string | null;
  isActive: boolean;
  hasPortal: boolean;
  leadCount: number;
  createdAt: string;
};

type ActionResult = { ok: true } | { ok: false; error: string };
const initial: ActionResult | null = null;

type CommunityTab = "partners" | "leaderboard";

const PERIOD_OPTIONS: Array<{ id: CommunityLeaderboardPeriod; label: string }> = [
  { id: "month", label: "This month" },
  { id: "quarter", label: "This quarter" },
  { id: "year", label: "This year" },
];

const RANK_STYLE = [
  "border-[var(--warn-line)] bg-[var(--warn-wash)] text-[var(--warn)]",
  "border-slate-300/50 bg-slate-50 text-slate-800 dark:bg-slate-900/40 dark:text-slate-200",
  "border-[var(--warn-line)] bg-[var(--warn-wash)] text-[var(--warn)]",
];

export function CommunityWorkspace({
  tenantSlug,
  tenantName,
  currency,
  canEdit,
  initialTab = "partners",
  initialPeriod = "month",
  leaderboards,
  partners,
  summary,
}: {
  tenantSlug: string;
  tenantName: string;
  currency: string;
  canEdit: boolean;
  initialTab?: CommunityTab;
  initialPeriod?: CommunityLeaderboardPeriod;
  leaderboards: Record<
    CommunityLeaderboardPeriod,
    { label: string; entries: CommunityMemberLeaderboardEntry[] }
  >;
  partners: PartnerRow[];
  summary: {
    totalPartners: number;
    activePartners: number;
    portalReady: number;
    monthLeads: number;
  };
}) {
  const [tab, setTab] = useState<CommunityTab>(initialTab);
  const [period, setPeriod] = useState<CommunityLeaderboardPeriod>(initialPeriod);
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createRealtorPartner.bind(null, tenantSlug), initial);
  const { showSnackbar } = useSnackbar();
  const formRef = useRef<HTMLFormElement | null>(null);
  const [pendingRotate, startRotate] = useTransition();
  const [freshLink, setFreshLink] = useState<string | null>(null);
  const router = useRouter();

  const board = leaderboards[period];
  const topPerformer = board.entries[0] ?? null;

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      showSnackbar("Partner added.", "success");
      formRef.current?.reset();
      queueMicrotask(() => setOpen(false));
    } else {
      showSnackbar(state.error, "error");
    }
  }, [showSnackbar, state]);

  function fullUrl(relativePath: string) {
    if (typeof window === "undefined") return relativePath;
    return `${window.location.origin}${relativePath}`;
  }

  return (
    <div className="w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Community</h1>
          <p className="mt-1 max-w-xl text-sm text-muted">
            Community members submit prospects via portal links — sales picks them up in Leads. Rankings
            celebrate top contributors for <span className="font-medium text-foreground">{tenantName}</span>.
          </p>
        </div>
        {canEdit && tab === "partners" ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90"
          >
            Add partner
          </button>
        ) : null}
      </div>

      <div className="mt-5 flex flex-wrap gap-2 border-b border-foreground/10 pb-3">
        {(
          [
            { id: "partners" as const, label: "Partners" },
            { id: "leaderboard" as const, label: "Leaderboard" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={[
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              tab === t.id
                ? "bg-foreground text-background"
                : "text-muted hover:bg-foreground/[0.06] hover:text-foreground",
            ].join(" ")}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "partners" ? (
        <PartnersTab
          canEdit={canEdit}
          partners={partners}
          summary={summary}
          freshLink={freshLink}
          pendingRotate={pendingRotate}
          tenantSlug={tenantSlug}
          setFreshLink={setFreshLink}
          showSnackbar={showSnackbar}
          startRotate={startRotate}
          router={router}
        />
      ) : (
        <LeaderboardTab
          period={period}
          setPeriod={setPeriod}
          board={board}
          topPerformer={topPerformer}
          currency={currency}
        />
      )}

      <ModalOverlay open={Boolean(open)} onClose={() => setOpen(false)} panelClassName={MODAL_PANEL_MD}>
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold text-foreground">Add partner</h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-foreground/15 text-muted hover:bg-foreground/[0.06]"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <form ref={formRef} action={formAction} className="mt-4 grid gap-3 sm:grid-cols-2">
          {state && !state.ok ? (
            <div className="sm:col-span-2">
              <FormAlert>{state.error}</FormAlert>
            </div>
          ) : null}
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm text-muted">Display name</label>
            <input
              name="displayName"
              required
              className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-muted">Email</label>
            <input
              name="email"
              type="text"
              inputMode="email"
              className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-muted">Phone</label>
            <input
              name="phone"
              type="text"
              className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-muted">Company</label>
            <input
              name="company"
              className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-muted">Territory</label>
            <input
              name="territory"
              className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm text-muted">Notes</label>
            <textarea
              name="notes"
              rows={3}
              className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground"
            />
          </div>
          <div className="flex justify-end gap-2 sm:col-span-2 pt-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md border border-foreground/15 px-4 py-2 text-sm text-foreground hover:bg-foreground/[0.06]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              aria-busy={pending}
              className="inline-flex items-center gap-2 rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-50"
            >
              {pending ? <ButtonSpinner /> : null}
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </ModalOverlay>
    </div>
  );
}

function PartnersTab({
  canEdit,
  partners,
  summary,
  freshLink,
  pendingRotate,
  tenantSlug,
  setFreshLink,
  showSnackbar,
  startRotate,
  router,
}: {
  canEdit: boolean;
  partners: PartnerRow[];
  summary: { totalPartners: number; activePartners: number; portalReady: number; monthLeads: number };
  freshLink: string | null;
  pendingRotate: boolean;
  tenantSlug: string;
  setFreshLink: (v: string | null) => void;
  showSnackbar: (msg: string, tone: "success" | "error" | "info") => void;
  startRotate: (fn: () => void) => void;
  router: ReturnType<typeof useRouter>;
}) {
  return (
    <>
      {!canEdit ? (
        <p className="mt-4 rounded-lg border border-[var(--warn-line)] bg-[var(--warn-wash)] px-4 py-3 text-sm text-foreground">
          Read-only directory. Org admins, community managers, and sales managers can manage partners and
          portal links.
        </p>
      ) : null}

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Community members" value={summary.totalPartners} />
        <KpiCard label="Active members" value={summary.activePartners} />
        <KpiCard label="Portal links live" value={summary.portalReady} />
        <KpiCard label="Prospects this month" value={summary.monthLeads} />
      </section>

      {freshLink ? (
        <div className="mt-6 rounded-lg border border-[var(--success-line)] bg-[var(--success-wash)] px-4 py-3 text-sm">
          <p className="font-semibold text-foreground">
            New portal link (copy now — it won&apos;t be shown again)
          </p>
          <p className="mt-2 break-all font-mono text-xs text-foreground">{freshLink}</p>
          <button
            type="button"
            className="mt-3 rounded-md border border-foreground/20 px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-foreground/[0.06]"
            onClick={async () => {
              await navigator.clipboard.writeText(freshLink);
              showSnackbar("Copied to clipboard.", "success");
            }}
          >
            Copy link
          </button>
          <button
            type="button"
            className="ml-2 mt-3 text-xs text-muted underline"
            onClick={() => setFreshLink(null)}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <div className="mt-8 overflow-hidden rounded-lg border border-foreground/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-foreground/[0.03] text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Partner</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Territory</th>
              <th className="px-4 py-3">Leads</th>
              <th className="px-4 py-3">Portal</th>
              <th className="px-4 py-3">Status</th>
              {canEdit ? <th className="px-4 py-3">Actions</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-foreground/10">
            {partners.length === 0 ? (
              <tr>
                <td colSpan={canEdit ? 7 : 6} className="px-4 py-8 text-muted">
                  No community members yet. Add a member and generate their portal link so they can submit
                  prospects.
                </td>
              </tr>
            ) : (
              partners.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{p.displayName}</div>
                    {p.company ? <div className="text-xs text-muted">{p.company}</div> : null}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    <div>{p.email ?? "—"}</div>
                    <div className="text-xs">{p.phone ?? ""}</div>
                  </td>
                  <td className="px-4 py-3 text-muted">{p.territory ?? "—"}</td>
                  <td className="px-4 py-3 text-foreground">{p.leadCount}</td>
                  <td className="px-4 py-3 text-muted">{p.hasPortal ? "Configured" : "Not set"}</td>
                  <td className="px-4 py-3 text-muted">{p.isActive ? "Active" : "Inactive"}</td>
                  {canEdit ? (
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <button
                          type="button"
                          disabled={pendingRotate}
                          className="text-left text-xs font-semibold text-[var(--info)] underline disabled:opacity-50"
                          onClick={() => {
                            startRotate(async () => {
                              const res = await rotateRealtorPortalToken(tenantSlug, p.id);
                              if (!res.ok) {
                                showSnackbar(res.error, "error");
                                return;
                              }
                              setFreshLink(`${window.location.origin}${res.relativePath}`);
                              showSnackbar("Portal link generated.", "success");
                              router.refresh();
                            });
                          }}
                        >
                          {p.hasPortal ? "Rotate portal link" : "Generate portal link"}
                        </button>
                        <button
                          type="button"
                          className="text-left text-xs text-muted underline"
                          onClick={() => {
                            startRotate(async () => {
                              const res = await setRealtorPartnerActive(tenantSlug, p.id, !p.isActive);
                              if (!res.ok) showSnackbar(res.error, "error");
                              else {
                                showSnackbar(
                                  p.isActive ? "Partner deactivated." : "Partner activated.",
                                  "success",
                                );
                                router.refresh();
                              }
                            });
                          }}
                        >
                          {p.isActive ? "Deactivate" : "Activate"}
                        </button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-muted">
        Each member gets a private portal link (like a sign-up URL). They submit prospects there; your sales
        team sees them under Leads with the member attributed. Generate links from the Actions column.
      </p>
    </>
  );
}

function LeaderboardTab({
  period,
  setPeriod,
  board,
  topPerformer,
  currency,
}: {
  period: CommunityLeaderboardPeriod;
  setPeriod: (p: CommunityLeaderboardPeriod) => void;
  board: { label: string; entries: CommunityMemberLeaderboardEntry[] };
  topPerformer: CommunityMemberLeaderboardEntry | null;
  currency: string;
}) {
  return (
    <div className="mt-4 space-y-4">
      <section className="rounded-lg border border-[var(--info-line)] bg-[var(--info-wash)] p-4 text-sm text-muted">
        <p className="font-medium text-foreground">Community leaderboard — not staff</p>
        <p className="mt-1 text-xs">
          This ranks external community members who submit prospects through portal links or send referrals.
          Sales sees every submission under Leads. Staff performance lives on the Dashboard and in People →
          Appraisals.
        </p>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Ranking period</p>
          <p className="mt-0.5 text-sm font-semibold text-foreground">{board.label}</p>
        </div>
        <UiSelect
          value={period}
          onChange={(e) => setPeriod(e.target.value as CommunityLeaderboardPeriod)}
          className="min-w-[160px] text-sm"
        >
          {PERIOD_OPTIONS.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </UiSelect>
      </div>

      {topPerformer ? (
        <section className="rounded-lg border border-[var(--warn-line)] bg-gradient-to-r from-[var(--warn-wash)] to-background p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--warn)]">
            Top community member · {board.label}
          </p>
          <p className="mt-1 text-lg font-bold text-foreground">{topPerformer.name}</p>
          <p className="text-xs text-muted">
            {topPerformer.company ?? topPerformer.territory ?? "Community"}
            {" · "}
            {topPerformer.prospectsSubmitted + topPerformer.referrals} submissions
            {topPerformer.dealsWon > 0 ? ` · ${topPerformer.dealsWon} closed sale(s)` : ""}
            {" · "}
            {topPerformer.compositeScore} pts
          </p>
        </section>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-foreground/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-foreground/[0.03] text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Rank</th>
              <th className="px-4 py-3">Member</th>
              <th className="px-4 py-3">Prospects</th>
              <th className="px-4 py-3">Referrals</th>
              <th className="px-4 py-3">Hot leads</th>
              <th className="px-4 py-3">Closed sales</th>
              <th className="px-4 py-3">Score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-foreground/10">
            {board.entries.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-muted">
                  No community activity for this period yet. When members submit prospects or referrals
                  through their portal links, rankings appear here.
                </td>
              </tr>
            ) : (
              board.entries.map((entry, idx) => (
                <tr key={entry.partnerId}>
                  <td className="px-4 py-3">
                    <span
                      className={[
                        "inline-flex h-7 w-7 items-center justify-center rounded-full border text-xs font-bold",
                        idx < 3 ? RANK_STYLE[idx] : "border-foreground/15 text-muted",
                      ].join(" ")}
                    >
                      {idx + 1}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{entry.name}</div>
                    <div className="text-xs text-muted">
                      {entry.company ?? "—"}
                      {entry.territory ? ` · ${entry.territory}` : ""}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-foreground">{entry.prospectsSubmitted}</td>
                  <td className="px-4 py-3 text-foreground">{entry.referrals}</td>
                  <td className="px-4 py-3 text-foreground">{entry.hotProspects}</td>
                  <td className="px-4 py-3 text-muted">
                    <div>{entry.dealsWon}</div>
                    <div className="text-xs">{formatLeaderboardMoney(entry.dealValue, currency)}</div>
                  </td>
                  <td className="px-4 py-3 font-semibold text-foreground">{entry.compositeScore}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted">
        Scores weight portal prospects, referrals, hot-lead quality, and closed sales tied to each member. Use
        month / quarter / year views to pick standout community contributors — separate from internal team
        leaderboards.
      </p>
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-foreground/10 bg-foreground/[0.02] px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
    </div>
  );
}
