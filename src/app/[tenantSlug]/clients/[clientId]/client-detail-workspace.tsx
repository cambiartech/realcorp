"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useState } from "react";
import { ModalOverlay } from "@/components/modal-overlay";
import { MODAL_PANEL_XL } from "@/lib/modal-panel";
import { ButtonSpinner } from "@/components/button-spinner";
import { FormAlert } from "@/components/form-message";
import { useSnackbar } from "@/components/snackbar";
import { UiSelect } from "@/components/ui-select";
import {
  ClientDocumentsWorkspace,
  type ClientDocumentItem,
} from "@/components/clients/client-documents-workspace";
import {
  linkClientShortlet,
  linkClientUnit,
  unlinkClientShortlet,
  unlinkClientUnit,
  updatePropertyClient,
} from "../actions";

type UnitLinkRow = {
  id: string;
  unitLabel: string;
  projectName: string;
  pricingPlanName: string;
  role: string;
  roleValue: string;
};

type ShortletLinkRow = {
  id: string;
  unitName: string;
  propertyName: string;
  nightlyRateLabel: string;
  role: string;
  roleValue: string;
};

type ProjectOption = {
  id: string;
  name: string;
  units: {
    id: string;
    label: string;
    defaultPricingPlanName: string | null;
  }[];
};

type ShortletPropertyOption = {
  id: string;
  name: string;
  units: {
    id: string;
    name: string;
    location: string;
    nightlyRate: string;
    currency: string;
  }[];
};

type ActionResult = { ok: true } | { ok: false; error: string };
const initial: ActionResult | null = null;

export function ClientDetailWorkspace({
  tenantSlug,
  canManage,
  moduleShortLets,
  client,
  unitLinks,
  shortletLinks,
  projectOptions,
  shortletPropertyOptions,
  documents,
}: {
  tenantSlug: string;
  canManage: boolean;
  moduleShortLets: boolean;
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
  shortletLinks: ShortletLinkRow[];
  projectOptions: ProjectOption[];
  shortletPropertyOptions: ShortletPropertyOption[];
  documents: ClientDocumentItem[];
}) {
  const router = useRouter();
  const { showSnackbar } = useSnackbar();
  const [tab, setTab] = useState<"overview" | "documents">("overview");
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isLinkOpen, setIsLinkOpen] = useState(false);
  const [linkKind, setLinkKind] = useState<"project" | "shortlet">("project");
  const [projectSearch, setProjectSearch] = useState("");
  const [shortletSearch, setShortletSearch] = useState("");
  const [linkProjectId, setLinkProjectId] = useState(projectOptions[0]?.id ?? "");
  const [linkUnitId, setLinkUnitId] = useState(projectOptions[0]?.units[0]?.id ?? "");
  const [linkPropertyId, setLinkPropertyId] = useState(shortletPropertyOptions[0]?.id ?? "");
  const [linkShortletUnitId, setLinkShortletUnitId] = useState(
    shortletPropertyOptions[0]?.units[0]?.id ?? "",
  );

  const [editState, editAction, editPending] = useActionState(
    updatePropertyClient.bind(null, tenantSlug, client.id),
    initial,
  );
  const [linkState, linkAction, linkPending] = useActionState(
    linkClientUnit.bind(null, tenantSlug, client.id),
    initial,
  );
  const [shortletLinkState, shortletLinkAction, shortletLinkPending] = useActionState(
    linkClientShortlet.bind(null, tenantSlug, client.id),
    initial,
  );

  const filteredProjects = useMemo(() => {
    const q = projectSearch.trim().toLowerCase();
    if (!q) return projectOptions;
    return projectOptions.filter((p) => p.name.toLowerCase().includes(q));
  }, [projectOptions, projectSearch]);

  const filteredShortletProperties = useMemo(() => {
    const q = shortletSearch.trim().toLowerCase();
    if (!q) return shortletPropertyOptions;
    return shortletPropertyOptions.filter((p) => p.name.toLowerCase().includes(q));
  }, [shortletPropertyOptions, shortletSearch]);

  const selectedProject = projectOptions.find((p) => p.id === linkProjectId);
  const unitsForProject = selectedProject?.units ?? [];
  const selectedUnit = unitsForProject.find((u) => u.id === linkUnitId);

  const selectedShortletProperty = shortletPropertyOptions.find((p) => p.id === linkPropertyId);
  const shortletUnitsForProperty = selectedShortletProperty?.units ?? [];
  const selectedShortletUnit = shortletUnitsForProperty.find((u) => u.id === linkShortletUnitId);

  const linkedCount = unitLinks.length + shortletLinks.length;

  useEffect(() => {
    if (!filteredProjects.some((p) => p.id === linkProjectId)) {
      const next = filteredProjects[0];
      setLinkProjectId(next?.id ?? "");
      setLinkUnitId(next?.units[0]?.id ?? "");
    }
  }, [filteredProjects, linkProjectId]);

  useEffect(() => {
    if (selectedProject && !unitsForProject.some((u) => u.id === linkUnitId)) {
      setLinkUnitId(unitsForProject[0]?.id ?? "");
    }
  }, [selectedProject, unitsForProject, linkUnitId]);

  useEffect(() => {
    if (!filteredShortletProperties.some((p) => p.id === linkPropertyId)) {
      const next = filteredShortletProperties[0];
      setLinkPropertyId(next?.id ?? "");
      setLinkShortletUnitId(next?.units[0]?.id ?? "");
    }
  }, [filteredShortletProperties, linkPropertyId]);

  useEffect(() => {
    if (selectedShortletProperty && !shortletUnitsForProperty.some((u) => u.id === linkShortletUnitId)) {
      setLinkShortletUnitId(shortletUnitsForProperty[0]?.id ?? "");
    }
  }, [selectedShortletProperty, shortletUnitsForProperty, linkShortletUnitId]);

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
      showSnackbar("Project unit linked.", "success");
      setIsLinkOpen(false);
      router.refresh();
    } else showSnackbar(linkState.error, "error");
  }, [linkState, router, showSnackbar]);

  useEffect(() => {
    if (!shortletLinkState) return;
    if (shortletLinkState.ok) {
      showSnackbar("Short-let apartment linked.", "success");
      setIsLinkOpen(false);
      router.refresh();
    } else showSnackbar(shortletLinkState.error, "error");
  }, [shortletLinkState, router, showSnackbar]);

  function openLinkModal() {
    setLinkKind("project");
    setProjectSearch("");
    setShortletSearch("");
    setLinkProjectId(projectOptions[0]?.id ?? "");
    setLinkUnitId(projectOptions[0]?.units[0]?.id ?? "");
    setLinkPropertyId(shortletPropertyOptions[0]?.id ?? "");
    setLinkShortletUnitId(shortletPropertyOptions[0]?.units[0]?.id ?? "");
    setIsLinkOpen(true);
  }

  async function handleUnlinkUnit(linkId: string) {
    const result = await unlinkClientUnit(tenantSlug, client.id, linkId);
    if (result.ok) {
      showSnackbar("Project unit unlinked.", "success");
      router.refresh();
    } else showSnackbar(result.error, "error");
  }

  async function handleUnlinkShortlet(linkId: string) {
    const result = await unlinkClientShortlet(tenantSlug, client.id, linkId);
    if (result.ok) {
      showSnackbar("Short-let apartment unlinked.", "success");
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
              onClick={openLinkModal}
              className="rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background"
            >
              Link property
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
          <p className="text-xs uppercase text-muted">Linked properties</p>
          <p className="mt-1 text-2xl font-bold">{linkedCount}</p>
          {moduleShortLets ? (
            <p className="mt-1 text-xs text-muted">
              {unitLinks.length} project · {shortletLinks.length} short-let
            </p>
          ) : null}
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
              className={[
                "relative py-2 text-sm font-medium capitalize",
                tab === key ? "text-foreground" : "text-muted",
              ].join(" ")}
            >
              {key}
              <span
                className={[
                  "absolute -bottom-px left-0 h-0.5 w-full",
                  tab === key ? "bg-foreground" : "bg-transparent",
                ].join(" ")}
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
                  {[client.addressLine, client.city, client.state, client.country]
                    .filter(Boolean)
                    .join(", ") || "—"}
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
              <h2 className="text-sm font-semibold">Linked properties</h2>
              <p className="mt-0.5 text-xs text-muted">
                Project units and short-let apartments are tracked separately.
              </p>
            </div>
            {linkedCount === 0 ? (
              <p className="px-4 py-6 text-sm text-muted">No properties linked yet.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="bg-foreground/[0.03] text-xs uppercase text-muted">
                  <tr>
                    <th className="px-4 py-2">Type</th>
                    <th className="px-4 py-2">Property</th>
                    <th className="px-4 py-2">Unit / apartment</th>
                    <th className="px-4 py-2">Plan / rate</th>
                    <th className="px-4 py-2">Role</th>
                    {canManage ? <th className="px-4 py-2">Actions</th> : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-foreground/10">
                  {unitLinks.map((link) => (
                    <tr key={`unit-${link.id}`}>
                      <td className="px-4 py-3">
                        <span className="rounded bg-foreground/5 px-2 py-0.5 text-xs font-medium">
                          Project
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted">{link.projectName}</td>
                      <td className="px-4 py-3 font-medium">{link.unitLabel}</td>
                      <td className="px-4 py-3 text-muted">{link.pricingPlanName}</td>
                      <td className="px-4 py-3">{link.role}</td>
                      {canManage ? (
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => handleUnlinkUnit(link.id)}
                            className="text-xs text-error underline"
                          >
                            Unlink
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                  {shortletLinks.map((link) => (
                    <tr key={`shortlet-${link.id}`}>
                      <td className="px-4 py-3">
                        <span className="rounded bg-[var(--warn-wash)] px-2 py-0.5 text-xs font-medium text-[var(--warn)]">
                          Short-let
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted">{link.propertyName}</td>
                      <td className="px-4 py-3 font-medium">{link.unitName}</td>
                      <td className="px-4 py-3 text-muted">{link.nightlyRateLabel}</td>
                      <td className="px-4 py-3">{link.role}</td>
                      {canManage ? (
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => handleUnlinkShortlet(link.id)}
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
          <input
            name="fullName"
            defaultValue={client.fullName}
            required
            className="w-full border border-foreground/15 bg-field px-3 py-2"
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              name="phone"
              defaultValue={client.phone}
              placeholder="Phone"
              className="w-full border border-foreground/15 bg-field px-3 py-2"
            />
            <input
              name="email"
              type="email"
              defaultValue={client.email}
              placeholder="Email"
              className="w-full border border-foreground/15 bg-field px-3 py-2"
            />
          </div>
          <UiSelect name="status" defaultValue={client.statusValue}>
            <option value="PROSPECT">Prospect</option>
            <option value="ACTIVE">Active</option>
            <option value="FORMER">Former</option>
          </UiSelect>
          <textarea
            name="notes"
            rows={3}
            defaultValue={client.notes}
            className="w-full border border-foreground/15 bg-field px-3 py-2"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsEditOpen(false)}
              className="rounded-md border px-4 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={editPending}
              className="inline-flex items-center gap-2 rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background"
            >
              {editPending ? <ButtonSpinner /> : null}
              Save
            </button>
          </div>
        </form>
      </ModalOverlay>

      <ModalOverlay open={isLinkOpen} onClose={() => setIsLinkOpen(false)} panelClassName={MODAL_PANEL_XL}>
        <h2 className="text-lg font-semibold">Link property to client</h2>
        <p className="mt-1 text-sm text-muted">
          Choose a development project unit or a short-let apartment. These are separate inventory types.
        </p>

        {moduleShortLets ? (
          <div className="mt-4 flex gap-2 border-b border-foreground/10 pb-3">
            <button
              type="button"
              onClick={() => setLinkKind("project")}
              className={[
                "rounded-md px-3 py-1.5 text-sm font-medium",
                linkKind === "project" ? "bg-foreground text-background" : "text-muted hover:text-foreground",
              ].join(" ")}
            >
              Project unit
            </button>
            <button
              type="button"
              onClick={() => setLinkKind("shortlet")}
              className={[
                "rounded-md px-3 py-1.5 text-sm font-medium",
                linkKind === "shortlet"
                  ? "bg-foreground text-background"
                  : "text-muted hover:text-foreground",
              ].join(" ")}
            >
              Short-let apartment
            </button>
          </div>
        ) : null}

        {linkKind === "project" || !moduleShortLets ? (
          <form action={linkAction} className="mt-5 space-y-4">
            {linkState && !linkState.ok ? <FormAlert>{linkState.error}</FormAlert> : null}
            <div>
              <label className="mb-1 block text-sm text-muted">Search project</label>
              <input
                type="search"
                value={projectSearch}
                onChange={(e) => setProjectSearch(e.target.value)}
                placeholder="Type to filter projects…"
                className="w-full border border-foreground/15 bg-field px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted">Project</label>
              <UiSelect
                value={linkProjectId}
                onChange={(e) => {
                  const projectId = e.target.value;
                  setLinkProjectId(projectId);
                  const project = projectOptions.find((p) => p.id === projectId);
                  setLinkUnitId(project?.units[0]?.id ?? "");
                }}
              >
                {filteredProjects.length === 0 ? (
                  <option value="">No projects available</option>
                ) : (
                  filteredProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.units.length} units)
                    </option>
                  ))
                )}
              </UiSelect>
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted">Unit</label>
              <UiSelect name="unitId" value={linkUnitId} onChange={(e) => setLinkUnitId(e.target.value)}>
                {unitsForProject.length === 0 ? (
                  <option value="">No units available in this project</option>
                ) : (
                  unitsForProject.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.label}
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
              <button
                type="button"
                onClick={() => setIsLinkOpen(false)}
                className="rounded-md border px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={linkPending || !linkUnitId}
                className="inline-flex items-center gap-2 rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background"
              >
                {linkPending ? <ButtonSpinner /> : null}
                Link project unit
              </button>
            </div>
          </form>
        ) : (
          <form action={shortletLinkAction} className="mt-5 space-y-4">
            {shortletLinkState && !shortletLinkState.ok ? (
              <FormAlert>{shortletLinkState.error}</FormAlert>
            ) : null}
            <div>
              <label className="mb-1 block text-sm text-muted">Search property / location</label>
              <input
                type="search"
                value={shortletSearch}
                onChange={(e) => setShortletSearch(e.target.value)}
                placeholder="Type to filter short-let properties…"
                className="w-full border border-foreground/15 bg-field px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted">Property / location</label>
              <UiSelect
                value={linkPropertyId}
                onChange={(e) => {
                  const propertyId = e.target.value;
                  setLinkPropertyId(propertyId);
                  const property = shortletPropertyOptions.find((p) => p.id === propertyId);
                  setLinkShortletUnitId(property?.units[0]?.id ?? "");
                }}
              >
                {filteredShortletProperties.length === 0 ? (
                  <option value="">No short-let properties available</option>
                ) : (
                  filteredShortletProperties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.units.length} apartments)
                    </option>
                  ))
                )}
              </UiSelect>
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted">Apartment</label>
              <UiSelect
                name="shortletUnitId"
                value={linkShortletUnitId}
                onChange={(e) => setLinkShortletUnitId(e.target.value)}
              >
                {shortletUnitsForProperty.length === 0 ? (
                  <option value="">No apartments available</option>
                ) : (
                  shortletUnitsForProperty.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                      {u.location ? ` — ${u.location}` : ""}
                    </option>
                  ))
                )}
              </UiSelect>
              {selectedShortletUnit ? (
                <p className="mt-2 text-xs text-muted">
                  Nightly rate:{" "}
                  <span className="font-medium text-foreground">
                    {selectedShortletUnit.currency}{" "}
                    {Number(selectedShortletUnit.nightlyRate).toLocaleString()}
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
              <button
                type="button"
                onClick={() => setIsLinkOpen(false)}
                className="rounded-md border px-4 py-2 text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={shortletLinkPending || !linkShortletUnitId}
                className="inline-flex items-center gap-2 rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background"
              >
                {shortletLinkPending ? <ButtonSpinner /> : null}
                Link short-let
              </button>
            </div>
          </form>
        )}
      </ModalOverlay>
    </div>
  );
}
