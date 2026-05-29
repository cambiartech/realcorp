"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { ModalOverlay } from "@/components/modal-overlay";
import { MODAL_PANEL_LG, MODAL_PANEL_MD, MODAL_PANEL_SM, MODAL_PANEL_XL, MODAL_PANEL_XS, MODAL_PANEL_2XL } from "@/lib/modal-panel";
import { ButtonSpinner } from "@/components/button-spinner";
import { FormAlert } from "@/components/form-message";
import { useSnackbar } from "@/components/snackbar";
import { UiSelect } from "@/components/ui-select";
import { ClientDocumentsWorkspace, type ClientDocumentItem } from "@/components/clients/client-documents-workspace";
import { createPropertyClient } from "./actions";

type ClientRow = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  status: string;
  statusValue: string;
  unitsCount: number;
  documentsCount: number;
  createdAtLabel: string;
};

type ActionResult = { ok: true } | { ok: false; error: string };
const initial: ActionResult | null = null;

function statusBadgeClass(status: string) {
  if (status === "ACTIVE") return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
  if (status === "FORMER") return "bg-foreground/10 text-muted";
  return "bg-amber-500/10 text-amber-800 dark:text-amber-300";
}

export function ClientsWorkspace({
  tenantSlug,
  canManage,
  activeTab,
  clients,
  documents,
  documentClients,
}: {
  tenantSlug: string;
  canManage: boolean;
  activeTab: "clients" | "documents";
  clients: ClientRow[];
  documents: ClientDocumentItem[];
  documentClients: Array<{ id: string; fullName: string }>;
}) {
  const router = useRouter();
  const { showSnackbar } = useSnackbar();
  const [tab, setTab] = useState(activeTab);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [state, formAction, pending] = useActionState(createPropertyClient.bind(null, tenantSlug), initial);
  const formRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      showSnackbar("Client added.", "success");
      formRef.current?.reset();
      setIsCreateOpen(false);
      router.refresh();
    } else {
      showSnackbar(state.error, "error");
    }
  }, [router, showSnackbar, state]);

  const stats = useMemo(() => {
    const active = clients.filter((c) => c.statusValue === "ACTIVE").length;
    const totalUnits = clients.reduce((sum, c) => sum + c.unitsCount, 0);
    return { active, totalUnits, total: clients.length };
  }, [clients]);

  return (
    <div className="w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Real estate</p>
          <h1 className="mt-1 text-2xl font-bold text-foreground">Clients</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Property owners and investors — track units, pricing plans, and client documents in one place.
          </p>
        </div>
        {canManage && tab === "clients" ? (
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/${tenantSlug}/clients/import`}
              className="rounded-md border border-foreground/15 px-4 py-2 text-sm font-semibold text-foreground hover:bg-foreground/[0.04]"
            >
              Import CSV
            </Link>
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background"
            >
              Add client
            </button>
          </div>
        ) : null}
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-foreground/10 bg-foreground/[0.02] p-4">
          <p className="text-xs uppercase tracking-wide text-muted">Total clients</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{stats.total}</p>
        </div>
        <div className="rounded-lg border border-foreground/10 bg-foreground/[0.02] p-4">
          <p className="text-xs uppercase tracking-wide text-muted">Active</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{stats.active}</p>
        </div>
        <div className="rounded-lg border border-foreground/10 bg-foreground/[0.02] p-4">
          <p className="text-xs uppercase tracking-wide text-muted">Units linked</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{stats.totalUnits}</p>
        </div>
      </div>

      <div className="mt-6 border-b border-foreground/10">
        <div className="flex gap-5">
          {(["clients", "documents"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={["relative py-2 text-sm font-medium capitalize", tab === key ? "text-foreground" : "text-muted"].join(" ")}
            >
              {key === "clients" ? "All clients" : "Client documents"}
              <span
                className={["absolute -bottom-px left-0 h-0.5 w-full", tab === key ? "bg-foreground" : "bg-transparent"].join(" ")}
              />
            </button>
          ))}
        </div>
      </div>

      {tab === "documents" ? (
        <div className="mt-5">
          <ClientDocumentsWorkspace
            tenantSlug={tenantSlug}
            canManage={canManage}
            clients={documentClients}
            documents={documents}
          />
        </div>
      ) : (
        <div className="mt-5 overflow-hidden rounded-lg border border-foreground/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-foreground/[0.03] text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Units</th>
                <th className="px-4 py-3">Documents</th>
                <th className="px-4 py-3">Added</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-foreground/10">
              {clients.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted">
                    No clients yet.{" "}
                    {canManage ? (
                      <>
                        <Link href={`/${tenantSlug}/clients/import`} className="font-semibold text-foreground underline">
                          Import from CSV
                        </Link>{" "}
                        or add one manually.
                      </>
                    ) : (
                      "Clients will appear here once added."
                    )}
                  </td>
                </tr>
              ) : (
                clients.map((client) => (
                  <tr key={client.id} className="hover:bg-foreground/[0.02]">
                    <td className="px-4 py-3">
                      <Link
                        href={`/${tenantSlug}/clients/${client.id}`}
                        className="font-medium text-foreground underline decoration-foreground/25 underline-offset-2 hover:decoration-foreground/60"
                      >
                        {client.fullName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted">
                      <div>{client.phone || "—"}</div>
                      <div className="text-xs">{client.email || ""}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(client.statusValue)}`}>
                        {client.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-foreground">{client.unitsCount}</td>
                    <td className="px-4 py-3 text-foreground">{client.documentsCount}</td>
                    <td className="px-4 py-3 text-muted">{client.createdAtLabel}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <ModalOverlay open={isCreateOpen} onClose={() => setIsCreateOpen(false)} panelClassName={MODAL_PANEL_XL}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Add client</h2>
              <p className="mt-0.5 text-xs text-muted">Property owner, co-owner, or investor.</p>
            </div>
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-foreground/15 text-muted hover:bg-foreground/[0.06]"
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <form ref={formRef} action={formAction} className="mt-4 space-y-4">
            {state && !state.ok ? <FormAlert>{state.error}</FormAlert> : null}
            <div>
              <label htmlFor="client-name" className="mb-1 block text-sm text-muted">
                Full name
              </label>
              <input
                id="client-name"
                name="fullName"
                required
                placeholder="e.g. Adebayo Okonkwo"
                className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="client-phone" className="mb-1 block text-sm text-muted">
                  Phone
                </label>
                <input id="client-phone" name="phone" className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground" />
              </div>
              <div>
                <label htmlFor="client-email" className="mb-1 block text-sm text-muted">
                  Email
                </label>
                <input id="client-email" name="email" type="email" className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground" />
              </div>
            </div>
            <div>
              <label htmlFor="client-status" className="mb-1 block text-sm text-muted">
                Status
              </label>
              <UiSelect id="client-status" name="status" defaultValue="PROSPECT">
                <option value="PROSPECT">Prospect</option>
                <option value="ACTIVE">Active</option>
                <option value="FORMER">Former</option>
              </UiSelect>
            </div>
            <div>
              <label htmlFor="client-notes" className="mb-1 block text-sm text-muted">
                Notes (optional)
              </label>
              <textarea id="client-notes" name="notes" rows={3} className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground" />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setIsCreateOpen(false)} className="rounded-md border border-foreground/15 px-4 py-2 text-sm">
                Cancel
              </button>
              <button
                type="submit"
                disabled={pending}
                aria-busy={pending}
                className="inline-flex items-center gap-2 rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-50"
              >
                {pending ? <ButtonSpinner /> : null}
                {pending ? "Saving..." : "Add client"}
              </button>
            </div>
          </form>
      </ModalOverlay>
    </div>
  );
}
