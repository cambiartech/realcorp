"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useRef, useState, Fragment } from "react";
import { ModalOverlay } from "@/components/modal-overlay";
import { MODAL_PANEL_XL } from "@/lib/modal-panel";
import { ButtonSpinner } from "@/components/button-spinner";
import { FormAlert } from "@/components/form-message";
import { GlobalLocationFields } from "@/components/global-location-fields";
import { PaginationControl } from "@/components/pagination";
import { useSnackbar } from "@/components/snackbar";
import { UiSelect } from "@/components/ui-select";
import {
  ClientDocumentsWorkspace,
  type ClientDocumentItem,
} from "@/components/clients/client-documents-workspace";
import type { ClientPortalStatus } from "@/lib/client-portal-invite";
import { buildPageUrl, type Pagination, type SearchParamValue } from "@/lib/pagination";
import { Pencil, Trash2 } from "lucide-react";
import { downloadClientPortfolioXlsx } from "@/lib/client-report-xlsx";
import { formatEnumLabel } from "@/lib/ui-format";
import { UNIT_IMPORT_HINT_MIN } from "@/lib/unit-label-client-import";
import {
  createPropertyClient,
  deletePropertyClient,
  sendClientPortalInvite,
  updatePropertyClient,
} from "./actions";
import { ImportClientsFromUnitsModal } from "@/components/clients/import-clients-from-units-modal";
import { SearchableSelect } from "@/components/searchable-select";
import { SortTh, useTableSort } from "@/components/sort-th";
import { TableSearch, filterTableRows } from "@/components/table-search";
import { sortTableRows } from "@/lib/table-sort";

type ClientRow = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  status: string;
  statusValue: string;
  projects: Array<{ id: string; name: string }>;
  unitsCount: number;
  documentsCount: number;
  paid: number;
  earnings: number;
  remaining: number;
  createdAtLabel: string;
  portalStatus: ClientPortalStatus;
};

type CreateClientResult =
  | { ok: true; inviteSent?: boolean; inviteError?: string; alreadyOnPortal?: boolean }
  | { ok: false; error: string };

const initial: CreateClientResult | null = null;

function portalStatusLabel(status: ClientPortalStatus) {
  switch (status) {
    case "active":
      return "On portal";
    case "invited":
      return "Invite sent";
    case "no_email":
      return "No email";
    default:
      return "Not invited";
  }
}

function portalStatusBadgeClass(status: ClientPortalStatus) {
  if (status === "active") return "bg-[var(--success-wash)] text-[var(--success)] ";
  if (status === "invited") return "bg-[var(--info-wash)] text-[var(--info)] ";
  if (status === "no_email") return "bg-foreground/10 text-muted";
  return "bg-[var(--warn-wash)] text-[var(--warn)] ";
}

function statusBadgeClass(status: string) {
  if (status === "ACTIVE") return "bg-[var(--success-wash)] text-[var(--success)] ";
  if (status === "FORMER") return "bg-foreground/10 text-muted";
  return "bg-[var(--warn-wash)] text-[var(--warn)] ";
}

function moneyLabel(currency: string, value: number) {
  return `${currency} ${value.toLocaleString("en-NG")}`;
}

function groupClientsByProject(rows: ClientRow[]) {
  const groups = new Map<string, { id: string; label: string; rows: ClientRow[] }>();
  const unlinked: ClientRow[] = [];
  for (const row of rows) {
    if (row.projects.length === 0) {
      unlinked.push(row);
      continue;
    }
    const primary = row.projects[0];
    const existing = groups.get(primary.id);
    if (existing) {
      existing.rows.push(row);
      continue;
    }
    groups.set(primary.id, { id: primary.id, label: primary.name, rows: [row] });
  }
  const ordered = Array.from(groups.values()).sort((a, b) => a.label.localeCompare(b.label));
  if (unlinked.length) ordered.push({ id: "none", label: "No project linked", rows: unlinked });
  return ordered;
}

export function ClientsWorkspace({
  tenantSlug,
  companyName,
  currency,
  canManage,
  activeTab,
  clients,
  unitBalances,
  documents,
  documentClients,
  pagination,
  paginationSearchParams,
  projectOptions,
  selectedProjectId,
  selectedProjectName,
  selectedStatus,
  clientStats,
  namedUnlinkedUnitsCount,
}: {
  tenantSlug: string;
  companyName: string;
  currency: string;
  canManage: boolean;
  activeTab: "clients" | "documents";
  clients: ClientRow[];
  unitBalances: Array<{
    clientName: string;
    projectLabel: string;
    unitLabel: string;
    contractValue: number;
    collected: number;
    earnings: number;
    remaining: number;
  }>;
  documents: ClientDocumentItem[];
  documentClients: Array<{ id: string; fullName: string }>;
  pagination: Pagination;
  paginationSearchParams: Record<string, SearchParamValue>;
  projectOptions: Array<{ id: string; name: string }>;
  selectedProjectId: string;
  selectedProjectName: string;
  selectedStatus: string;
  clientStats: { active: number; totalUnits: number };
  namedUnlinkedUnitsCount: number;
}) {
  const router = useRouter();
  const { showSnackbar } = useSnackbar();
  const [tab, setTab] = useState(activeTab);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createPhone, setCreatePhone] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createNotes, setCreateNotes] = useState("");
  const [createStatus, setCreateStatus] = useState("PROSPECT");
  const [sendPortalInvite, setSendPortalInvite] = useState(false);
  const [invitingClientId, setInvitingClientId] = useState<string | null>(null);
  const [clientToDelete, setClientToDelete] = useState<ClientRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [clientToEdit, setClientToEdit] = useState<ClientRow | null>(null);
  const [editDraft, setEditDraft] = useState({
    fullName: "",
    phone: "",
    email: "",
    status: "PROSPECT",
  });
  const [rowOverrides, setRowOverrides] = useState<Record<string, Partial<ClientRow>>>({});
  const [exporting, setExporting] = useState(false);
  const [importUnitsOpen, setImportUnitsOpen] = useState(false);
  const unitImportHintKey = `clients-unit-import-hint:${tenantSlug}`;
  const [dismissUnitImportHint, setDismissUnitImportHint] = useState(true);
  const [state, formAction, pending] = useActionState(createPropertyClient.bind(null, tenantSlug), initial);
  const [editPending, setEditPending] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);
  const [tableQuery, setTableQuery] = useState("");
  const { sortKey, sortDir, onSort } = useTableSort();
  const visibleClients = useMemo(() => {
    const filtered = filterTableRows(
      clients.map((row) => ({ ...row, ...rowOverrides[row.id] })),
      tableQuery,
      (row) =>
        `${row.fullName} ${row.email} ${row.phone} ${row.status} ${row.portalStatus} ${row.createdAtLabel} ${row.projects.map((project) => project.name).join(" ")}`,
    );
    return sortTableRows(filtered, sortKey, sortDir, (row, key) => {
      if (key === "name") return row.fullName;
      if (key === "projects") return row.projects.map((project) => project.name).join(" ");
      if (key === "status") return row.status;
      if (key === "portal") return row.portalStatus;
      if (key === "units") return row.unitsCount;
      if (key === "paid") return row.paid;
      if (key === "earnings") return row.earnings;
      if (key === "remaining") return row.remaining;
      if (key === "added") return row.createdAtLabel;
      return "";
    });
  }, [clients, rowOverrides, tableQuery, sortKey, sortDir]);
  const clientGroups = useMemo(() => {
    if (sortKey) return [{ id: "sorted", label: "", rows: visibleClients }];
    if (selectedProjectId === "none") {
      return [{ id: "none", label: "No project linked", rows: visibleClients }];
    }
    if (selectedProjectId) {
      return [
        {
          id: selectedProjectId,
          label: selectedProjectName || "Selected project",
          rows: visibleClients,
        },
      ];
    }
    return groupClientsByProject(visibleClients);
  }, [selectedProjectId, selectedProjectName, visibleClients, sortKey]);

  function applyListFilter(updates: { projectId?: string; status?: string }) {
    const params = { ...paginationSearchParams } as Record<string, SearchParamValue>;
    if (updates.projectId !== undefined) {
      if (updates.projectId) params.projectId = updates.projectId;
      else delete params.projectId;
    }
    if (updates.status !== undefined) {
      if (updates.status) params.status = updates.status;
      else delete params.status;
    }
    delete params.clientsPage;
    router.push(buildPageUrl(`/${tenantSlug}/clients`, params, "clientsPage", 1));
  }

  function applyProjectFilter(nextId: string) {
    applyListFilter({ projectId: nextId });
  }

  useEffect(() => {
    try {
      setDismissUnitImportHint(window.localStorage.getItem(unitImportHintKey) === "1");
    } catch {
      setDismissUnitImportHint(false);
    }
  }, [unitImportHintKey]);

  useEffect(() => {
    setRowOverrides((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const row of clients) {
        const override = next[row.id];
        if (!override) continue;
        if (!override.statusValue || override.statusValue === row.statusValue) {
          delete next[row.id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [clients]);

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      if (state.alreadyOnPortal) {
        showSnackbar("Client added. They already have portal access for this organization.", "success");
      } else if (state.inviteSent) {
        showSnackbar("Client added and portal invite sent.", "success");
      } else if (state.inviteError) {
        showSnackbar(`Client added, but invite email failed: ${state.inviteError}`, "error");
      } else {
        showSnackbar("Client added.", "success");
      }
      formRef.current?.reset();
      queueMicrotask(() => {
        setCreateName("");
        setCreatePhone("");
        setCreateEmail("");
        setCreateNotes("");
        setCreateStatus("PROSPECT");
        setSendPortalInvite(false);
        setIsCreateOpen(false);
      });
      router.refresh();
    } else {
      showSnackbar(state.error, "error");
    }
  }, [router, showSnackbar, state]);

  async function handleDeleteClient() {
    if (!clientToDelete) return;
    setDeleting(true);
    const result = await deletePropertyClient(tenantSlug, clientToDelete.id);
    setDeleting(false);
    if (!result.ok) {
      showSnackbar(result.error, "error");
      return;
    }
    showSnackbar(`${clientToDelete.fullName} deleted.`, "success");
    setClientToDelete(null);
    router.refresh();
  }

  async function handleEditClient(formData: FormData) {
    if (!clientToEdit) return;
    setEditPending(true);
    const result = await updatePropertyClient(tenantSlug, clientToEdit.id, null, formData);
    setEditPending(false);
    if (!result.ok) {
      showSnackbar(result.error, "error");
      return;
    }
    showSnackbar("Client updated.", "success");
    setRowOverrides((prev) => ({
      ...prev,
      [clientToEdit.id]: {
        fullName: editDraft.fullName,
        phone: editDraft.phone,
        email: editDraft.email,
        statusValue: editDraft.status,
        status: formatEnumLabel(editDraft.status),
      },
    }));
    setClientToEdit(null);
    router.refresh();
  }

  async function handleSendInvite(clientId: string) {
    setInvitingClientId(clientId);
    const result = await sendClientPortalInvite(tenantSlug, clientId);
    setInvitingClientId(null);
    if (!result.ok) {
      showSnackbar(result.error, "error");
      return;
    }
    if (result.alreadyOnPortal) {
      showSnackbar("This client already has portal access.", "success");
    } else if (result.emailSent) {
      showSnackbar("Portal invite sent.", "success");
    } else {
      showSnackbar(result.emailError || "Could not send invite email.", "error");
    }
    router.refresh();
  }

  return (
    <div className="w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Real estate</p>
          <h1 className="mt-1 text-2xl font-bold text-foreground">Clients</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Property owners and investors — track units, pricing plans, and client documents in one place.
          </p>
          {selectedProjectId || selectedStatus ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {selectedProjectId ? (
                <button
                  type="button"
                  onClick={() => applyProjectFilter("")}
                  className="inline-flex items-center gap-1 rounded-full border border-foreground/15 bg-foreground/[0.04] px-2.5 py-1 text-xs text-foreground hover:bg-foreground/[0.08]"
                  title="Clear project filter"
                >
                  <span>Project: {selectedProjectName || selectedProjectId}</span>
                  <span aria-hidden>×</span>
                </button>
              ) : null}
              {selectedStatus ? (
                <button
                  type="button"
                  onClick={() => applyListFilter({ status: "" })}
                  className="inline-flex items-center gap-1 rounded-full border border-foreground/15 bg-foreground/[0.04] px-2.5 py-1 text-xs text-foreground hover:bg-foreground/[0.08]"
                  title="Clear status filter"
                >
                  <span>Status: {formatEnumLabel(selectedStatus)}</span>
                  <span aria-hidden>×</span>
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => applyListFilter({ projectId: "", status: "" })}
                className="text-xs font-semibold text-[var(--info)] underline decoration-[var(--info-line)] underline-offset-2"
              >
                Show all clients
              </button>
            </div>
          ) : null}
        </div>
        {tab === "clients" ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={exporting}
              onClick={() => {
                setExporting(true);
                void downloadClientPortfolioXlsx({
                  companyName,
                  currency,
                  clients: visibleClients.map((c) => ({
                    fullName: c.fullName,
                    email: c.email,
                    phone: c.phone,
                    status: c.status,
                    unitsCount: c.unitsCount,
                    paid: c.paid,
                    earnings: c.earnings,
                    remaining: c.remaining,
                    createdAtLabel: c.createdAtLabel,
                  })),
                  unitBalances,
                }).finally(() => setExporting(false));
              }}
              className="rounded-md border border-foreground/15 px-4 py-2 text-sm font-semibold text-foreground hover:bg-foreground/[0.04] disabled:opacity-50"
            >
              {exporting ? "Preparing…" : "Export Excel"}
            </button>
            {canManage ? (
              <>
                <button
                  type="button"
                  onClick={() => setImportUnitsOpen(true)}
                  className="rounded-md border border-foreground/15 px-4 py-2 text-sm font-semibold text-foreground hover:bg-foreground/[0.04]"
                >
                  From unit names
                </button>
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
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      {canManage &&
      tab === "clients" &&
      namedUnlinkedUnitsCount >= UNIT_IMPORT_HINT_MIN &&
      !dismissUnitImportHint ? (
        <div className="mt-5 flex flex-wrap items-start justify-between gap-3 rounded-xl border border-foreground/15 bg-foreground/[0.03] px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Import clients from units</p>
            <p className="mt-0.5 max-w-2xl text-sm text-muted">
              {namedUnlinkedUnitsCount} unassigned units look like they include a person&apos;s name (for example
              RM 26 MR EMANA EDET). Already mapped units are skipped so you won&apos;t create duplicates.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setDismissUnitImportHint(true);
                try {
                  window.localStorage.setItem(unitImportHintKey, "1");
                } catch {
                  /* ignore */
                }
              }}
              className="rounded-md px-3 py-1.5 text-xs font-medium text-muted hover:text-foreground"
            >
              Not now
            </button>
            <button
              type="button"
              onClick={() => setImportUnitsOpen(true)}
              className="rounded-md border border-foreground bg-foreground px-3 py-1.5 text-xs font-semibold text-background"
            >
              Preview import
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-foreground/10 bg-foreground/[0.02] p-4">
          <p className="text-xs uppercase tracking-wide text-muted">Total clients</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{pagination.total}</p>
          {selectedProjectName ? <p className="mt-1 text-xs text-muted">{selectedProjectName}</p> : null}
        </div>
        <div className="rounded-lg border border-foreground/10 bg-foreground/[0.02] p-4">
          <p className="text-xs uppercase tracking-wide text-muted">Active</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{clientStats.active}</p>
        </div>
        <div className="rounded-lg border border-foreground/10 bg-foreground/[0.02] p-4">
          <p className="text-xs uppercase tracking-wide text-muted">Units linked</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{clientStats.totalUnits}</p>
        </div>
      </div>

      <div className="mt-6 border-b border-foreground/10">
        <div className="flex gap-5">
          {(["clients", "documents"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={[
                "relative py-2 text-sm font-medium capitalize",
                tab === key ? "text-foreground" : "text-muted",
              ].join(" ")}
            >
              {key === "clients" ? "All clients" : "Client documents"}
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
            clients={documentClients}
            documents={documents}
          />
        </div>
      ) : (
        <div className="mt-5">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end">
            <TableSearch
              value={tableQuery}
              onChange={setTableQuery}
              placeholder="Search clients by name, email, phone, project, or status…"
              resultCount={visibleClients.length}
              totalCount={clients.length}
            />
            <div className="w-full sm:max-w-[200px]">
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted">
                Status
              </label>
              <UiSelect
                value={selectedStatus}
                onChange={(event) => applyListFilter({ status: event.target.value })}
              >
                <option value="">All statuses</option>
                <option value="PROSPECT">Prospect</option>
                <option value="ACTIVE">Active</option>
                <option value="FORMER">Former</option>
              </UiSelect>
            </div>
            <div className="w-full sm:max-w-xs">
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted">
                Filter by project
              </label>
              <SearchableSelect
                value={selectedProjectId}
                onChange={applyProjectFilter}
                allowEmpty
                emptyLabel="All projects"
                searchPlaceholder="Search projects…"
                placeholder="All projects"
                options={[
                  { value: "none", label: "No project linked" },
                  ...projectOptions.map((project) => ({
                    value: project.id,
                    label: project.name,
                  })),
                ]}
              />
            </div>
          </div>
        <div className="overflow-hidden rounded-lg border border-foreground/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-foreground/[0.03] text-xs uppercase tracking-wide text-muted">
              <tr>
                <SortTh label="Client" sortKey="name" activeKey={sortKey} dir={sortDir} onSort={onSort} />
                <SortTh label="Projects" sortKey="projects" activeKey={sortKey} dir={sortDir} onSort={onSort} />
                <th className="px-4 py-3">Contact</th>
                <SortTh label="Status" sortKey="status" activeKey={sortKey} dir={sortDir} onSort={onSort} />
                <SortTh label="Portal" sortKey="portal" activeKey={sortKey} dir={sortDir} onSort={onSort} />
                <SortTh label="Units" sortKey="units" activeKey={sortKey} dir={sortDir} onSort={onSort} />
                <SortTh label="Paid" sortKey="paid" activeKey={sortKey} dir={sortDir} onSort={onSort} />
                <SortTh label="Earnings" sortKey="earnings" activeKey={sortKey} dir={sortDir} onSort={onSort} />
                <SortTh label="Remaining" sortKey="remaining" activeKey={sortKey} dir={sortDir} onSort={onSort} />
                <SortTh label="Added" sortKey="added" activeKey={sortKey} dir={sortDir} onSort={onSort} />
                {canManage ? <th className="px-4 py-3" /> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-foreground/10">
              {visibleClients.length === 0 ? (
                <tr>
                  <td colSpan={canManage ? 11 : 10} className="px-4 py-10 text-center text-sm text-muted">
                    {clients.length === 0 ? (
                      <>
                    No clients yet
                    {selectedProjectId
                      ? selectedProjectId === "none"
                        ? " without a linked project."
                        : ` in ${selectedProjectName || "this project"}.`
                      : "."}{" "}
                    {canManage && !selectedProjectId ? (
                      <>
                        Import from{" "}
                        <button
                          type="button"
                          onClick={() => setImportUnitsOpen(true)}
                          className="font-semibold text-foreground underline"
                        >
                          unit names
                        </button>
                        ,{" "}
                        <Link
                          href={`/${tenantSlug}/clients/import`}
                          className="font-semibold text-foreground underline"
                        >
                          CSV
                        </Link>{" "}
                        or add one manually.
                      </>
                    ) : selectedProjectId ? (
                      <button
                        type="button"
                        onClick={() => applyProjectFilter("")}
                        className="font-semibold text-foreground underline"
                      >
                        Show all clients
                      </button>
                    ) : (
                      "Clients will appear here once added."
                    )}
                      </>
                    ) : (
                      "No clients match that search."
                    )}
                  </td>
                </tr>
              ) : (
                clientGroups.map((group) => (
                  <Fragment key={group.id}>
                    {group.label ? (
                    <tr className="bg-foreground/[0.035]">
                      <td
                        colSpan={canManage ? 11 : 10}
                        className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted"
                      >
                        {group.label}
                        <span className="ml-2 font-medium normal-case tracking-normal text-muted">
                          {group.rows.length} {group.rows.length === 1 ? "client" : "clients"}
                        </span>
                      </td>
                    </tr>
                    ) : null}
                    {group.rows.map((client) => (
                  <tr key={client.id} className="hover:bg-foreground/[0.02]">
                    <td className="px-4 py-3">
                      <Link
                        href={`/${tenantSlug}/clients/${client.id}`}
                        className="font-medium text-foreground underline decoration-foreground/25 underline-offset-2 hover:decoration-foreground/60"
                      >
                        {client.fullName}
                      </Link>
                    </td>
                    <td className="max-w-[180px] px-4 py-3 text-xs text-muted">
                      {client.projects.length ? (
                        <span title={client.projects.map((project) => project.name).join(", ")}>
                          {client.projects.map((project) => project.name).join(" · ")}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted">
                      <div>{client.phone || "—"}</div>
                      <div className="text-xs">{client.email || ""}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(client.statusValue)}`}
                      >
                        {client.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${portalStatusBadgeClass(client.portalStatus)}`}
                      >
                        {portalStatusLabel(client.portalStatus)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-foreground">{client.unitsCount}</td>
                    <td className="px-4 py-3 text-foreground">{moneyLabel(currency, client.paid)}</td>
                    <td className="px-4 py-3 text-foreground">{moneyLabel(currency, client.earnings)}</td>
                    <td className="px-4 py-3 font-medium text-foreground">
                      {moneyLabel(currency, client.remaining)}
                    </td>
                    <td className="px-4 py-3 text-muted">{client.createdAtLabel}</td>
                    {canManage ? (
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          {client.portalStatus !== "active" && client.portalStatus !== "no_email" ? (
                            <button
                              type="button"
                              onClick={() => handleSendInvite(client.id)}
                              disabled={invitingClientId === client.id}
                              className="text-xs font-semibold text-foreground underline decoration-foreground/25 underline-offset-2 hover:decoration-foreground/60 disabled:opacity-50"
                            >
                              {invitingClientId === client.id
                                ? "Sending…"
                                : client.portalStatus === "invited"
                                  ? "Resend invite"
                                  : "Send invite"}
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => {
                              setEditDraft({
                                fullName: client.fullName,
                                phone: client.phone,
                                email: client.email,
                                status: client.statusValue,
                              });
                              setClientToEdit(client);
                            }}
                            className="inline-flex items-center gap-1 rounded-md border border-foreground/15 px-2 py-1 text-xs font-semibold hover:bg-foreground/[0.04]"
                          >
                            <Pencil className="h-3 w-3" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setClientToDelete(client)}
                            className="inline-flex items-center gap-1 rounded-md border border-foreground/15 px-2 py-1 text-xs font-semibold text-[var(--danger)] hover:bg-[var(--danger-wash)]"
                          >
                            <Trash2 className="h-3 w-3" />
                            Delete
                          </button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                    ))}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
          <PaginationControl
            pathname={`/${tenantSlug}/clients`}
            searchParams={paginationSearchParams}
            pageParam="clientsPage"
            itemLabel="clients"
            {...pagination}
          />
        </div>
        </div>
      )}

      <ModalOverlay
        open={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        panelClassName={MODAL_PANEL_XL}
      >
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
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="e.g. Adebayo Okonkwo"
              className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="client-phone" className="mb-1 block text-sm text-muted">
                Phone
              </label>
              <input
                id="client-phone"
                name="phone"
                value={createPhone}
                onChange={(e) => setCreatePhone(e.target.value)}
                className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground"
              />
            </div>
            <div>
              <label htmlFor="client-email" className="mb-1 block text-sm text-muted">
                Email <span className="font-normal text-muted">(optional)</span>
              </label>
              <input
                id="client-email"
                name="email"
                type="text"
                inputMode="email"
                autoComplete="email"
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
                placeholder="Leave blank if you do not have it"
                className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground"
              />
            </div>
          </div>
          <label className="flex items-start gap-3 rounded-md border border-foreground/10 bg-foreground/[0.02] px-3 py-3">
            <input
              type="checkbox"
              name="sendPortalInvite"
              checked={sendPortalInvite && Boolean(createEmail.trim())}
              disabled={!createEmail.trim()}
              onChange={(e) => setSendPortalInvite(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              <span className="block text-sm font-medium text-foreground">Send portal invitation</span>
              <span className="mt-0.5 block text-xs text-muted">
                Email them a link to sign in and view their units at /portal. Existing Realcorp users are
                linked to this organization automatically.
              </span>
            </span>
          </label>
          <div>
            <label htmlFor="client-status" className="mb-1 block text-sm text-muted">
              Status
            </label>
            <UiSelect
              id="client-status"
              name="status"
              value={createStatus}
              onChange={(e) => setCreateStatus(e.target.value)}
            >
              <option value="PROSPECT">Prospect</option>
              <option value="ACTIVE">Active</option>
              <option value="FORMER">Former</option>
            </UiSelect>
          </div>
          <div>
            <label htmlFor="client-address" className="mb-1 block text-sm text-muted">
              Street address (optional)
            </label>
            <input
              id="client-address"
              name="addressLine"
              placeholder="House number and street"
              className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground"
            />
          </div>
          <GlobalLocationFields defaultCountry="Nigeria" />
          <div>
            <label htmlFor="client-notes" className="mb-1 block text-sm text-muted">
              Notes (optional)
            </label>
            <textarea
              id="client-notes"
              name="notes"
              rows={3}
              value={createNotes}
              onChange={(e) => setCreateNotes(e.target.value)}
              className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="rounded-md border border-foreground/15 px-4 py-2 text-sm"
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
              {pending ? "Saving..." : "Add client"}
            </button>
          </div>
        </form>
      </ModalOverlay>

      <ModalOverlay
        open={Boolean(clientToEdit)}
        onClose={() => setClientToEdit(null)}
        panelClassName={MODAL_PANEL_XL}
      >
        <h2 className="text-lg font-semibold">Edit client</h2>
        {clientToEdit ? (
          <form action={handleEditClient} className="mt-4 space-y-3">
            <input
              name="fullName"
              value={editDraft.fullName}
              onChange={(e) => setEditDraft((d) => ({ ...d, fullName: e.target.value }))}
              required
              className="w-full border border-foreground/15 bg-field px-3 py-2"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                name="phone"
                value={editDraft.phone}
                onChange={(e) => setEditDraft((d) => ({ ...d, phone: e.target.value }))}
                placeholder="Phone"
                className="w-full border border-foreground/15 bg-field px-3 py-2"
              />
              <input
                name="email"
                type="text"
                inputMode="email"
                value={editDraft.email}
                onChange={(e) => setEditDraft((d) => ({ ...d, email: e.target.value }))}
                placeholder="Email (optional)"
                className="w-full border border-foreground/15 bg-field px-3 py-2"
              />
            </div>
            <UiSelect
              name="status"
              value={editDraft.status}
              onChange={(e) => setEditDraft((d) => ({ ...d, status: e.target.value }))}
            >
              <option value="PROSPECT">Prospect</option>
              <option value="ACTIVE">Active</option>
              <option value="FORMER">Former</option>
            </UiSelect>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setClientToEdit(null)}
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
        ) : null}
      </ModalOverlay>

      <ModalOverlay
        open={Boolean(clientToDelete)}
        onClose={() => setClientToDelete(null)}
        panelClassName={MODAL_PANEL_XL}
      >
        <h2 className="text-lg font-semibold">Delete this client?</h2>
        <p className="mt-2 text-sm text-muted">
          Are you sure you want to delete {clientToDelete?.fullName}? This cannot be undone. Payments
          already recorded in Finance will stay on the books.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setClientToDelete(null)}
            className="rounded-md border px-4 py-2 text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={deleting}
            onClick={() => void handleDeleteClient()}
            className="inline-flex items-center gap-2 rounded-md border border-[var(--danger)] bg-[var(--danger)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {deleting ? <ButtonSpinner /> : null}
            {deleting ? "Deleting…" : "Yes, delete"}
          </button>
        </div>
      </ModalOverlay>

      <ImportClientsFromUnitsModal
        tenantSlug={tenantSlug}
        open={importUnitsOpen}
        onClose={() => setImportUnitsOpen(false)}
        onImported={(summary) => {
          showSnackbar(summary, "success");
          setDismissUnitImportHint(true);
          router.refresh();
        }}
      />
    </div>
  );
}
