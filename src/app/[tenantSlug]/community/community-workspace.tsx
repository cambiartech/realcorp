"use client";

import { FormAlert } from "@/components/form-message";
import { useSnackbar } from "@/components/snackbar";
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

export function CommunityWorkspace({
  tenantSlug,
  tenantName,
  canEdit,
  partners,
  summary,
}: {
  tenantSlug: string;
  tenantName: string;
  canEdit: boolean;
  partners: PartnerRow[];
  summary: {
    totalPartners: number;
    activePartners: number;
    portalReady: number;
    monthLeads: number;
  };
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createRealtorPartner.bind(null, tenantSlug), initial);
  const { showSnackbar } = useSnackbar();
  const formRef = useRef<HTMLFormElement | null>(null);
  const [pendingRotate, startRotate] = useTransition();
  const [freshLink, setFreshLink] = useState<string | null>(null);
  const router = useRouter();

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
    <div className="mx-auto max-w-6xl px-4 py-6 sm:py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Community & realtors</h1>
          <p className="mt-1 text-sm text-muted">
            Directory and portal access for <span className="font-medium text-foreground">{tenantName}</span>.
          </p>
        </div>
        {canEdit ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90"
          >
            Add realtor partner
          </button>
        ) : null}
      </div>

      {!canEdit ? (
        <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-foreground">
          Read-only directory. Org admins, community managers, and sales managers can manage partners and portal links.
        </p>
      ) : null}

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total partners" value={summary.totalPartners} />
        <KpiCard label="Active partners" value={summary.activePartners} />
        <KpiCard label="Portal configured" value={summary.portalReady} />
        <KpiCard label="Partner leads (month)" value={summary.monthLeads} />
      </section>

      {freshLink ? (
        <div className="mt-6 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm">
          <p className="font-semibold text-foreground">New portal link (copy now — it won’t be shown again)</p>
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
                  No realtor partners yet. Add partners to issue secure submit/track links.
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
                          className="text-left text-xs font-semibold text-indigo-600 underline disabled:opacity-50"
                          onClick={() => {
                            startRotate(async () => {
                              const res = await rotateRealtorPortalToken(tenantSlug, p.id);
                              if (!res.ok) {
                                showSnackbar(res.error, "error");
                                return;
                              }
                              setFreshLink(fullUrl(res.relativePath));
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
                                showSnackbar(p.isActive ? "Partner deactivated." : "Partner activated.", "success");
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
        External realtors use their portal link to submit leads and see submissions tied to their account. Links include a
        secret token — treat them like passwords.
      </p>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-foreground/10 bg-background p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold text-foreground">Add realtor partner</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-foreground/15 text-muted hover:bg-foreground/[0.06]"
                aria-label="Close"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
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
                  className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-muted">Phone</label>
                <input
                  name="phone"
                  type="text"
                  className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-muted">Company</label>
                <input
                  name="company"
                  className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-muted">Territory</label>
                <input
                  name="territory"
                  className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm text-muted">Notes</label>
                <textarea
                  name="notes"
                  rows={3}
                  className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
                />
              </div>
              <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
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
                  className="rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-50"
                >
                  {pending ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
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
