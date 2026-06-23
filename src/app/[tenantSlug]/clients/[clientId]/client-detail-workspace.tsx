"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { ModalOverlay } from "@/components/modal-overlay";
import { MODAL_PANEL_LG, MODAL_PANEL_MD, MODAL_PANEL_SM, MODAL_PANEL_XL, MODAL_PANEL_XS, MODAL_PANEL_2XL } from "@/lib/modal-panel";
import { ButtonSpinner } from "@/components/button-spinner";
import { FormAlert } from "@/components/form-message";
import { useSnackbar } from "@/components/snackbar";
import { UiSelect } from "@/components/ui-select";
import { ClientDocumentsWorkspace, type ClientDocumentItem } from "@/components/clients/client-documents-workspace";
import { linkClientUnit, unlinkClientUnit, updatePropertyClient } from "../actions";

type UnitLinkRow = {
  id: string;
  unitLabel: string;
  projectName: string;
  pricingPlanName: string;
  role: string;
  roleValue: string;
};

type UnitOption = {
  id: string;
  label: string;
  projectName: string;
  defaultPricingPlanName: string | null;
};

type ActionResult = { ok: true } | { ok: false; error: string };
const initial: ActionResult | null = null;

export function ClientDetailWorkspace({
  tenantSlug,
  canManage,
  client,
  unitLinks,
  unitOptions,
  documents,
}: {
  tenantSlug: string;
  canManage: boolean;
  client: {
    id: string;
    fullName: string;
    email: string;
    phone: string;
    alternatePhone: string;
    addressLine: string;
    city: string;
    state: string;
    country: string;
    status: string;
    statusValue: string;
    notes: string;
  };
  unitLinks: UnitLinkRow[];
  unitOptions: UnitOption[];
  documents: ClientDocumentItem[];
}) {
  const router = useRouter();
  const { showSnackbar } = useSnackbar();
  const [tab, setTab] = useState<"overview" | "documents">("overview");
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isLinkOpen, setIsLinkOpen] = useState(false);
  const [linkUnitId, setLinkUnitId] = useState(unitOptions[0]?.id ?? "");
  const [editState, editAction, editPending] = useActionState(
    updatePropertyClient.bind(null, tenantSlug, client.id),
    initial,
  );
  const [linkState, linkAction, linkPending] = useActionState(
    linkClientUnit.bind(null, tenantSlug, client.id),
    initial,
  );

  const selectedUnit = unitOptions.find((u) => u.id === linkUnitId);

  useEffect(() => {
    if (!editState) return;
    if (editState.ok) {
      showSnackbar("Client updated.", "success");
      setIsEditOpen(false);
      router.refresh();
    } else showSnackbar(editState.error, "error");
  }, [editState, router, showSnackbar]);

  useEffect(() => {
    if (!linkState) return;
    if (linkState.ok) {
      showSnackbar("Unit linked.", "success");
      setIsLinkOpen(false);
      router.refresh();
    } else showSnackbar(linkState.error, "error");
  }, [linkState, router, showSnackbar]);

  async function handleUnlink(linkId: string) {
    const result = await unlinkClientUnit(tenantSlug, client.id, linkId);
    if (result.ok) {
      showSnackbar("Unit unlinked.", "success");
      router.refresh();
    } else showSnackbar(result.error, "error");
  }

  return (
    <div className="w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={`/${tenantSlug}/clients`} className="text-xs text-muted hover:text-foreground">
            ← All clients
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-foreground">{client.fullName}</h1>
          <p className="mt-1 text-sm text-muted">
            {client.phone || "No phone"}
            {client.email ? ` · ${client.email}` : ""}
          </p>
        </div>
        {canManage ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setIsEditOpen(true)}
              className="rounded-md border border-foreground/15 px-4 py-2 text-sm font-semibold"
            >
              Edit profile
            </button>
            <button
              type="button"
              onClick={() => setIsLinkOpen(true)}
              className="rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background"
            >
              Link unit
            </button>
          </div>
        ) : null}
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-foreground/10 p-4">
          <p className="text-xs uppercase text-muted">Status</p>
          <p className="mt-1 font-semibold">{client.status}</p>
        </div>
        <div className="rounded-lg border border-foreground/10 p-4">
          <p className="text-xs uppercase text-muted">Units</p>
          <p className="mt-1 text-2xl font-bold">{unitLinks.length}</p>
        </div>
        <div className="rounded-lg border border-foreground/10 p-4">
          <p className="text-xs uppercase text-muted">Documents</p>
          <p className="mt-1 text-2xl font-bold">{documents.length}</p>
        </div>
      </div>

      <div className="mt-6 border-b border-foreground/10">
        <div className="flex gap-5">
          {(["overview", "documents"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={["relative py-2 text-sm font-medium capitalize", tab === key ? "text-foreground" : "text-muted"].join(" ")}
            >
              {key}
              <span className={["absolute -bottom-px left-0 h-0.5 w-full", tab === key ? "bg-foreground" : "bg-transparent"].join(" ")} />
            </button>
          ))}
        </div>
      </div>

      {tab === "documents" ? (
        <div className="mt-5">
          <ClientDocumentsWorkspace
            tenantSlug={tenantSlug}
            canManage={canManage}
            clients={[{ id: client.id, fullName: client.fullName }]}
            documents={documents}
            preselectClientId={client.id}
          />
        </div>
      ) : (
        <div className="mt-5 space-y-6">
          <section className="rounded-lg border border-foreground/10 p-4">
            <h2 className="text-sm font-semibold">Contact & address</h2>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted">Alternate phone</dt>
                <dd>{client.alternatePhone || "—"}</dd>
              </div>
              <div>
                <dt className="text-muted">Address</dt>
                <dd>
                  {[client.addressLine, client.city, client.state, client.country].filter(Boolean).join(", ") || "—"}
                </dd>
              </div>
            </dl>
            {client.notes ? (
              <p className="mt-3 text-sm text-muted">
                <span className="font-medium text-foreground">Notes:</span> {client.notes}
              </p>
            ) : null}
          </section>

          <section className="overflow-hidden rounded-lg border border-foreground/10">
            <div className="border-b border-foreground/10 px-4 py-3">
              <h2 className="text-sm font-semibold">Units & pricing plans</h2>
            </div>
            {unitLinks.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted">No units linked yet.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="bg-foreground/[0.03] text-xs uppercase text-muted">
                  <tr>
                    <th className="px-4 py-2">Unit</th>
                    <th className="px-4 py-2">Project</th>
                    <th className="px-4 py-2">Pricing plan</th>
                    <th className="px-4 py-2">Role</th>
                    {canManage ? <th className="px-4 py-2">Actions</th> : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-foreground/10">
                  {unitLinks.map((link) => (
                    <tr key={link.id}>
                      <td className="px-4 py-3 font-medium">{link.unitLabel}</td>
                      <td className="px-4 py-3 text-muted">{link.projectName}</td>
                      <td className="px-4 py-3 text-muted">{link.pricingPlanName}</td>
                      <td className="px-4 py-3">{link.role}</td>
                      {canManage ? (
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => handleUnlink(link.id)}
                            className="text-xs text-error underline"
                          >
                            Unlink
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      )}

      <ModalOverlay open={isEditOpen} onClose={() => setIsEditOpen(false)} panelClassName={MODAL_PANEL_XL}>
          <h2 className="text-lg font-semibold">Edit client</h2>
          <form action={editAction} className="mt-4 space-y-3">
            {editState && !editState.ok ? <FormAlert>{editState.error}</FormAlert> : null}
            <input name="fullName" defaultValue={client.fullName} required className="w-full border border-foreground/15 bg-field px-3 py-2" />
            <div className="grid gap-3 sm:grid-cols-2">
              <input name="phone" defaultValue={client.phone} placeholder="Phone" className="w-full border border-foreground/15 bg-field px-3 py-2" />
              <input name="email" type="email" defaultValue={client.email} placeholder="Email" className="w-full border border-foreground/15 bg-field px-3 py-2" />
            </div>
            <UiSelect name="status" defaultValue={client.statusValue}>
              <option value="PROSPECT">Prospect</option>
              <option value="ACTIVE">Active</option>
              <option value="FORMER">Former</option>
            </UiSelect>
            <textarea name="notes" rows={3} defaultValue={client.notes} className="w-full border border-foreground/15 bg-field px-3 py-2" />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setIsEditOpen(false)} className="rounded-md border px-4 py-2 text-sm">
                Cancel
              </button>
              <button type="submit" disabled={editPending} className="inline-flex items-center gap-2 rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background">
                {editPending ? <ButtonSpinner /> : null}
                Save
              </button>
            </div>
          </form>
      </ModalOverlay>

      <ModalOverlay open={isLinkOpen} onClose={() => setIsLinkOpen(false)} panelClassName={MODAL_PANEL_XL}>
          <h2 className="text-lg font-semibold">Link unit to client</h2>
          <p className="mt-1 text-sm text-muted">
            Connect a project unit to this client&apos;s portfolio. The unit&apos;s pricing plan from inventory is used automatically.
          </p>
          <form action={linkAction} className="mt-5 space-y-4">
            {linkState && !linkState.ok ? <FormAlert>{linkState.error}</FormAlert> : null}
            <div>
              <label className="mb-1 block text-sm text-muted">Unit</label>
              <UiSelect
                name="unitId"
                value={linkUnitId}
                onChange={(e) => setLinkUnitId(e.target.value)}
              >
                {unitOptions.length === 0 ? (
                  <option value="">No units available</option>
                ) : (
                  unitOptions.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.projectName} — {u.label}
                    </option>
                  ))
                )}
              </UiSelect>
              {selectedUnit ? (
                <p className="mt-2 text-xs text-muted">
                  Pricing plan:{" "}
                  <span className="font-medium text-foreground">
                    {selectedUnit.defaultPricingPlanName ?? "No plan on unit"}
                  </span>
                </p>
              ) : null}
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted">Role</label>
              <UiSelect name="role" defaultValue="OWNER">
                <option value="OWNER">Owner</option>
                <option value="CO_OWNER">Co-owner</option>
                <option value="INVESTOR">Investor</option>
                <option value="TENANT">Tenant</option>
                <option value="BENEFICIARY">Beneficiary</option>
              </UiSelect>
            </div>
            <div className="flex justify-end gap-2 border-t border-foreground/10 pt-4">
              <button type="button" onClick={() => setIsLinkOpen(false)} className="rounded-md border px-4 py-2 text-sm">
                Cancel
              </button>
              <button type="submit" disabled={linkPending || !linkUnitId} className="inline-flex items-center gap-2 rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background">
                {linkPending ? <ButtonSpinner /> : null}
                Link unit
              </button>
            </div>
          </form>
      </ModalOverlay>
    </div>
  );
}
