"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
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
import { downloadClientStatementXlsx } from "@/lib/client-report-xlsx";
import { formatEnumLabel } from "@/lib/ui-format";
import {
  deletePropertyClient,
  linkClientShortlet,
  linkClientUnit,
  recordClientDeposit,
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

type ActionResult = { ok: true; message?: string } | { ok: false; error: string };
const initial: ActionResult | null = null;

function moneyLabel(currency: string, value: number) {
  return `${currency} ${value.toLocaleString("en-NG")}`;
}

const PAGE_SIZE = 8;

type ClientTab = "overview" | "payments" | "properties" | "documents";

function usePaged<T>(items: T[], resetKey: string) {
  const [page, setPage] = useState(1);
  useEffect(() => {
    setPage(1);
  }, [resetKey]);
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  return {
    page: safePage,
    setPage,
    totalPages,
    total: items.length,
    rows: items.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
  };
}

function LocalPager({
  page,
  totalPages,
  total,
  itemLabel,
  onPage,
}: {
  page: number;
  totalPages: number;
  total: number;
  itemLabel: string;
  onPage: (page: number) => void;
}) {
  if (total <= PAGE_SIZE) return null;
  const first = (page - 1) * PAGE_SIZE + 1;
  const last = Math.min(page * PAGE_SIZE, total);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-foreground/10 px-4 py-3">
      <p className="text-xs text-muted">
        Showing {first}–{last} of {total} {itemLabel}
      </p>
      <div className="flex gap-1">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className="rounded-md border border-foreground/15 px-2.5 py-1 text-xs font-medium disabled:opacity-40"
        >
          Previous
        </button>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
          className="rounded-md border border-foreground/15 px-2.5 py-1 text-xs font-medium disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}

export function ClientDetailWorkspace({
  tenantSlug,
  companyName,
  currency,
  canManage,
  moduleShortLets,
  client,
  depositSummary,
  depositRows,
  payments,
  paymentUnitOptions,
  unitLinks,
  shortletLinks,
  projectOptions,
  shortletPropertyOptions,
  documents,
}: {
  tenantSlug: string;
  companyName: string;
  currency: string;
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
  depositSummary: { contractValue: number; collected: number; remaining: number };
  depositRows: Array<{
    id: string;
    unitId: string;
    projectLabel: string;
    unitLabel: string;
    listPrice: number;
    contractValue: number;
    collected: number;
    remaining: number;
    isDiscounted: boolean;
    adjustmentReason: string | null;
  }>;
  payments: Array<{
    id: string;
    title: string;
    unitLabel: string;
    amount: number;
    currency: string;
    paidAtLabel: string;
    method: string;
    reference: string;
  }>;
  paymentUnitOptions: Array<{ id: string; label: string; listPrice: number }>;
  unitLinks: UnitLinkRow[];
  shortletLinks: ShortletLinkRow[];
  projectOptions: ProjectOption[];
  shortletPropertyOptions: ShortletPropertyOption[];
  documents: ClientDocumentItem[];
}) {
  const router = useRouter();
  const { showSnackbar } = useSnackbar();
  const [tab, setTab] = useState<ClientTab>("overview");
  const [profile, setProfile] = useState(client);
  const [editDraft, setEditDraft] = useState({
    fullName: client.fullName,
    phone: client.phone,
    email: client.email,
    status: client.statusValue,
    notes: client.notes,
  });
  const editDraftRef = useRef(editDraft);
  editDraftRef.current = editDraft;
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isLinkOpen, setIsLinkOpen] = useState(false);
  const [isPayOpen, setIsPayOpen] = useState(false);
  const [payUnitId, setPayUnitId] = useState(paymentUnitOptions[0]?.id ?? "");
  const [balanceAdjustment, setBalanceAdjustment] = useState<"none" | "set_sale_price" | "waive_remaining">(
    "none",
  );
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
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
  const [payState, payAction, payPending] = useActionState(
    recordClientDeposit.bind(null, tenantSlug, client.id),
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
  const linkedRows = useMemo(
    () => [
      ...unitLinks.map((link) => ({ kind: "project" as const, link })),
      ...shortletLinks.map((link) => ({ kind: "shortlet" as const, link })),
    ],
    [unitLinks, shortletLinks],
  );
  const pagedBalances = usePaged(depositRows, `${client.id}-balances-${depositRows.length}`);
  const pagedPayments = usePaged(payments, `${client.id}-payments-${payments.length}`);
  const pagedLinks = usePaged(linkedRows, `${client.id}-links-${linkedRows.length}`);
  const selectedPayUnit = paymentUnitOptions.find((unit) => unit.id === payUnitId) ?? paymentUnitOptions[0];
  const selectedPayBalance = depositRows.find((row) => row.unitId === selectedPayUnit?.id);

  useEffect(() => {
    setProfile(client);
  }, [client]);

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
      const draft = editDraftRef.current;
      setProfile((current) => ({
        ...current,
        fullName: draft.fullName,
        phone: draft.phone,
        email: draft.email,
        notes: draft.notes,
        statusValue: draft.status,
        status: formatEnumLabel(draft.status),
      }));
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

  useEffect(() => {
    if (!payState) return;
    if (payState.ok) {
      showSnackbar(payState.message || "Payment recorded.", "success");
      setIsPayOpen(false);
      setBalanceAdjustment("none");
      router.refresh();
    } else showSnackbar(payState.error, "error");
  }, [payState, router, showSnackbar]);

  function openEditModal() {
    setEditDraft({
      fullName: profile.fullName,
      phone: profile.phone,
      email: profile.email,
      status: profile.statusValue,
      notes: profile.notes,
    });
    setIsEditOpen(true);
  }

  function openPayModal() {
    setPayUnitId(paymentUnitOptions[0]?.id ?? "");
    setBalanceAdjustment("none");
    setIsPayOpen(true);
  }

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

  async function handleDeleteClient() {
    setDeleting(true);
    const result = await deletePropertyClient(tenantSlug, client.id);
    setDeleting(false);
    if (!result.ok) {
      showSnackbar(result.error, "error");
      return;
    }
    showSnackbar(`${client.fullName} deleted.`, "success");
    router.push(`/${tenantSlug}/clients`);
    router.refresh();
  }

  return (
    <div className="w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={`/${tenantSlug}/clients`} className="text-xs text-muted hover:text-foreground">
            ← All clients
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-foreground">{profile.fullName}</h1>
          <p className="mt-1 text-sm text-muted">
            {profile.phone || "No phone"}
            {profile.email ? ` · ${profile.email}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={exporting}
            onClick={() => {
              setExporting(true);
              void downloadClientStatementXlsx({
                companyName,
                currency,
                clientName: profile.fullName,
                phone: profile.phone,
                email: profile.email,
                status: profile.status,
                contractValue: depositSummary.contractValue,
                collected: depositSummary.collected,
                remaining: depositSummary.remaining,
                unitBalances: depositRows.map((row) => ({
                  clientName: profile.fullName,
                  projectLabel: row.projectLabel,
                  unitLabel: row.unitLabel,
                  contractValue: row.contractValue,
                  collected: row.collected,
                  remaining: row.remaining,
                })),
                payments: payments.map((payment) => ({
                  paidAtLabel: payment.paidAtLabel,
                  unitLabel: payment.unitLabel,
                  amount: payment.amount,
                  method: payment.method,
                  reference: payment.reference,
                })),
              }).finally(() => setExporting(false));
            }}
            className="rounded-md border border-foreground/15 px-4 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {exporting ? "Preparing…" : "Export Excel"}
          </button>
          {canManage ? (
            <>
            <button
              type="button"
              onClick={openEditModal}
              className="rounded-md border border-foreground/15 px-4 py-2 text-sm font-semibold"
            >
              Edit profile
            </button>
            <button
              type="button"
              onClick={openPayModal}
              className="rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background"
            >
              Add payment
            </button>
            <button
              type="button"
              onClick={openLinkModal}
              className="rounded-md border border-foreground/15 px-4 py-2 text-sm font-semibold"
            >
              Link property
            </button>
            <button
              type="button"
              onClick={() => setIsDeleteOpen(true)}
              className="rounded-md border border-foreground/15 px-4 py-2 text-sm font-semibold text-[var(--danger)]"
            >
              Delete
            </button>
            </>
          ) : null}
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-foreground/10 p-4">
          <p className="text-xs uppercase text-muted">Status</p>
          <p className="mt-1 font-semibold">{profile.status}</p>
          <p className="mt-1 text-xs text-muted">
            {linkedCount} linked {linkedCount === 1 ? "property" : "properties"}
          </p>
        </div>
        <div className="rounded-lg border border-foreground/10 p-4">
          <p className="text-xs uppercase text-muted">Sale amount</p>
          <p className="mt-1 text-2xl font-bold">{moneyLabel(currency, depositSummary.contractValue)}</p>
        </div>
        <div className="rounded-lg border border-foreground/10 p-4">
          <p className="text-xs uppercase text-muted">Paid</p>
          <p className="mt-1 text-2xl font-bold">{moneyLabel(currency, depositSummary.collected)}</p>
        </div>
        <div className="rounded-lg border border-foreground/10 p-4">
          <p className="text-xs uppercase text-muted">Remaining</p>
          <p className="mt-1 text-2xl font-bold">{moneyLabel(currency, depositSummary.remaining)}</p>
        </div>
      </div>

      <div className="mt-6 border-b border-foreground/10">
        <div className="flex flex-wrap gap-5">
          {(
            [
              { id: "overview", label: "Overview" },
              { id: "payments", label: `Payments${payments.length ? ` (${payments.length})` : ""}` },
              { id: "properties", label: `Properties${linkedCount ? ` (${linkedCount})` : ""}` },
              { id: "documents", label: `Documents${documents.length ? ` (${documents.length})` : ""}` },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={[
                "relative py-2 text-sm font-medium",
                tab === item.id ? "text-foreground" : "text-muted",
              ].join(" ")}
            >
              {item.label}
              <span
                className={[
                  "absolute -bottom-px left-0 h-0.5 w-full",
                  tab === item.id ? "bg-foreground" : "bg-transparent",
                ].join(" ")}
              />
            </button>
          ))}
        </div>
      </div>

      {tab === "overview" ? (
        <div className="mt-5">
          <section className="rounded-lg border border-foreground/10 p-4">
            <h2 className="text-sm font-semibold">Contact & address</h2>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted">Alternate phone</dt>
                <dd>{profile.alternatePhone || "—"}</dd>
              </div>
              <div>
                <dt className="text-muted">Address</dt>
                <dd>
                  {[profile.addressLine, profile.city, profile.state, profile.country]
                    .filter(Boolean)
                    .join(", ") || "—"}
                </dd>
              </div>
            </dl>
            {profile.notes ? (
              <p className="mt-3 text-sm text-muted">
                <span className="font-medium text-foreground">Notes:</span> {profile.notes}
              </p>
            ) : null}
          </section>
        </div>
      ) : null}

      {tab === "payments" ? (
        <section className="mt-5 overflow-hidden rounded-lg border border-foreground/10">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-foreground/10 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold">Payments & balance</h2>
              <p className="mt-0.5 text-xs text-muted">
                Part payments for a project unit. Remaining follows the sale price for this client, including
                any promo or waived balance.
              </p>
            </div>
            {canManage ? (
              <button
                type="button"
                onClick={openPayModal}
                className="rounded-md border border-foreground bg-foreground px-3 py-1.5 text-xs font-semibold text-background"
              >
                Add payment
              </button>
            ) : null}
          </div>
          {depositRows.length === 0 && payments.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted">
              No payments yet. Link a unit, then record a part payment.
            </p>
          ) : (
            <div className="divide-y divide-foreground/10">
              {depositRows.length > 0 ? (
                <>
                  <table className="w-full text-left text-sm">
                    <thead className="bg-foreground/[0.03] text-xs uppercase text-muted">
                      <tr>
                        <th className="px-4 py-2">Unit</th>
                        <th className="px-4 py-2">Amount</th>
                        <th className="px-4 py-2">Paid</th>
                        <th className="px-4 py-2">Remaining</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-foreground/10">
                      {pagedBalances.rows.map((row) => (
                        <tr key={row.id}>
                          <td className="px-4 py-3">
                            <p className="font-medium">{row.unitLabel}</p>
                            <p className="text-xs text-muted">{row.projectLabel}</p>
                          </td>
                          <td className="px-4 py-3">
                            <p>{moneyLabel(currency, row.contractValue)}</p>
                            {row.isDiscounted ? (
                              <p className="text-xs text-muted">
                                List {moneyLabel(currency, row.listPrice)}
                                {row.adjustmentReason ? ` · ${row.adjustmentReason}` : " · promo"}
                              </p>
                            ) : null}
                          </td>
                          <td className="px-4 py-3">{moneyLabel(currency, row.collected)}</td>
                          <td className="px-4 py-3 font-semibold">
                            {moneyLabel(currency, row.remaining)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <LocalPager
                    page={pagedBalances.page}
                    totalPages={pagedBalances.totalPages}
                    total={pagedBalances.total}
                    itemLabel="units"
                    onPage={pagedBalances.setPage}
                  />
                </>
              ) : null}
              {payments.length > 0 ? (
                <div>
                  <p className="px-4 pt-3 text-xs font-semibold uppercase tracking-wide text-muted">
                    Payment history
                  </p>
                  <ul className="space-y-2 px-4 py-3">
                    {pagedPayments.rows.map((payment) => (
                      <li key={payment.id} className="flex flex-wrap justify-between gap-2 text-sm">
                        <div>
                          <p className="font-medium">{payment.unitLabel}</p>
                          <p className="text-xs text-muted">
                            {payment.paidAtLabel}
                            {payment.method ? ` · ${payment.method}` : ""}
                            {payment.reference ? ` · ${payment.reference}` : ""}
                          </p>
                        </div>
                        <p className="font-semibold">
                          {moneyLabel(payment.currency || currency, payment.amount)}
                        </p>
                      </li>
                    ))}
                  </ul>
                  <LocalPager
                    page={pagedPayments.page}
                    totalPages={pagedPayments.totalPages}
                    total={pagedPayments.total}
                    itemLabel="payments"
                    onPage={pagedPayments.setPage}
                  />
                </div>
              ) : null}
            </div>
          )}
        </section>
      ) : null}

      {tab === "properties" ? (
        <section className="mt-5 overflow-hidden rounded-lg border border-foreground/10">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-foreground/10 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold">Linked properties</h2>
              <p className="mt-0.5 text-xs text-muted">
                Project units and short-let apartments are tracked separately.
              </p>
            </div>
            {canManage ? (
              <button
                type="button"
                onClick={openLinkModal}
                className="rounded-md border border-foreground/15 px-3 py-1.5 text-xs font-semibold"
              >
                Link property
              </button>
            ) : null}
          </div>
          {linkedCount === 0 ? (
            <p className="px-4 py-6 text-sm text-muted">No properties linked yet.</p>
          ) : (
            <>
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
                  {pagedLinks.rows.map((row) =>
                    row.kind === "project" ? (
                      <tr key={`unit-${row.link.id}`}>
                        <td className="px-4 py-3">
                          <span className="rounded bg-foreground/5 px-2 py-0.5 text-xs font-medium">
                            Project
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted">{row.link.projectName}</td>
                        <td className="px-4 py-3 font-medium">{row.link.unitLabel}</td>
                        <td className="px-4 py-3 text-muted">{row.link.pricingPlanName}</td>
                        <td className="px-4 py-3">{row.link.role}</td>
                        {canManage ? (
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => handleUnlinkUnit(row.link.id)}
                              className="text-xs text-error underline"
                            >
                              Unlink
                            </button>
                          </td>
                        ) : null}
                      </tr>
                    ) : (
                      <tr key={`shortlet-${row.link.id}`}>
                        <td className="px-4 py-3">
                          <span className="rounded bg-[var(--warn-wash)] px-2 py-0.5 text-xs font-medium text-[var(--warn)]">
                            Short-let
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted">{row.link.propertyName}</td>
                        <td className="px-4 py-3 font-medium">{row.link.unitName}</td>
                        <td className="px-4 py-3 text-muted">{row.link.nightlyRateLabel}</td>
                        <td className="px-4 py-3">{row.link.role}</td>
                        {canManage ? (
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => handleUnlinkShortlet(row.link.id)}
                              className="text-xs text-error underline"
                            >
                              Unlink
                            </button>
                          </td>
                        ) : null}
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
              <LocalPager
                page={pagedLinks.page}
                totalPages={pagedLinks.totalPages}
                total={pagedLinks.total}
                itemLabel="properties"
                onPage={pagedLinks.setPage}
              />
            </>
          )}
        </section>
      ) : null}

      {tab === "documents" ? (
        <div className="mt-5">
          <ClientDocumentsWorkspace
            tenantSlug={tenantSlug}
            canManage={canManage}
            clients={[{ id: client.id, fullName: profile.fullName }]}
            documents={documents}
            preselectClientId={client.id}
          />
        </div>
      ) : null}

      <ModalOverlay open={isEditOpen} onClose={() => setIsEditOpen(false)} panelClassName={MODAL_PANEL_XL}>
        <h2 className="text-lg font-semibold">Edit client</h2>
        <form action={editAction} className="mt-4 space-y-3">
          {editState && !editState.ok ? <FormAlert>{editState.error}</FormAlert> : null}
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
          <textarea
            name="notes"
            rows={3}
            value={editDraft.notes}
            onChange={(e) => setEditDraft((d) => ({ ...d, notes: e.target.value }))}
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

      <ModalOverlay open={isPayOpen} onClose={() => setIsPayOpen(false)} panelClassName={MODAL_PANEL_XL}>
        <h2 className="text-lg font-semibold">Add payment</h2>
        <p className="mt-1 text-sm text-muted">
          Record a part payment for a project unit. If this client has a promo or you are writing off the
          leftover, override the sale price so remaining does not stay on the full unit price.
        </p>
        <form action={payAction} className="mt-4 space-y-3">
          {payState && !payState.ok ? <FormAlert>{payState.error}</FormAlert> : null}
          <div>
            <label className="mb-1 block text-sm text-muted">Project unit</label>
            <UiSelect
              name="unitId"
              value={selectedPayUnit?.id ?? ""}
              onChange={(event) => setPayUnitId(event.target.value)}
            >
              {paymentUnitOptions.length === 0 ? (
                <option value="">No units available</option>
              ) : (
                paymentUnitOptions.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.label}
                  </option>
                ))
              )}
            </UiSelect>
            {selectedPayBalance || selectedPayUnit?.listPrice ? (
              <p className="mt-1 text-xs text-muted">
                {selectedPayBalance
                  ? `Sale ${moneyLabel(currency, selectedPayBalance.contractValue)} · Paid ${moneyLabel(currency, selectedPayBalance.collected)} · Remaining ${moneyLabel(currency, selectedPayBalance.remaining)}`
                  : `List ${moneyLabel(currency, selectedPayUnit?.listPrice || 0)}`}
              </p>
            ) : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-muted">
                Amount{balanceAdjustment === "none" ? "" : " (optional if you are only adjusting the sale price)"}
              </label>
              <input
                name="amount"
                type="number"
                min="0"
                step="0.01"
                required={balanceAdjustment === "none"}
                placeholder="0.00"
                className="w-full border border-foreground/15 bg-field px-3 py-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted">Date paid</label>
              <input
                name="paidAt"
                type="date"
                required
                defaultValue={new Date().toISOString().slice(0, 10)}
                className="w-full border border-foreground/15 bg-field px-3 py-2"
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-muted">Method</label>
              <UiSelect name="method" defaultValue="Bank Transfer">
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Cash">Cash</option>
                <option value="POS">POS</option>
                <option value="Cheque">Cheque</option>
              </UiSelect>
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted">Reference (optional)</label>
              <input
                name="reference"
                placeholder="Transfer ref"
                className="w-full border border-foreground/15 bg-field px-3 py-2"
              />
            </div>
          </div>
          <textarea
            name="note"
            rows={2}
            placeholder="Note (optional)"
            className="w-full border border-foreground/15 bg-field px-3 py-2"
          />
          <div className="rounded-md border border-foreground/10 bg-foreground/[0.02] p-3">
            <label className="mb-1 block text-sm font-medium text-foreground">Sale price for this client</label>
            <p className="mb-2 text-xs text-muted">
              Use this when they are not paying the brochure unit price — promo, staff discount, or writing off
              the leftover balance.
            </p>
            <UiSelect
              name="balanceAdjustment"
              value={balanceAdjustment}
              onChange={(event) =>
                setBalanceAdjustment(event.target.value as "none" | "set_sale_price" | "waive_remaining")
              }
            >
              <option value="none">Keep current sale price</option>
              <option value="set_sale_price">Set a discounted sale price</option>
              <option value="waive_remaining">This settles the account (waive leftover)</option>
            </UiSelect>
            {balanceAdjustment === "set_sale_price" ? (
              <div className="mt-3">
                <label className="mb-1 block text-sm text-muted">Agreed sale price</label>
                <input
                  name="agreedPrice"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  defaultValue={
                    selectedPayBalance?.contractValue
                      ? String(selectedPayBalance.contractValue)
                      : selectedPayUnit?.listPrice
                        ? String(selectedPayUnit.listPrice)
                        : ""
                  }
                  className="w-full border border-foreground/15 bg-field px-3 py-2"
                />
              </div>
            ) : null}
            {balanceAdjustment !== "none" ? (
              <div className="mt-3">
                <label className="mb-1 block text-sm text-muted">Reason</label>
                <input
                  name="adjustmentReason"
                  required
                  maxLength={240}
                  placeholder="e.g. Launch promo, staff discount, goodwill write-off"
                  className="w-full border border-foreground/15 bg-field px-3 py-2"
                />
              </div>
            ) : null}
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsPayOpen(false)}
              className="rounded-md border px-4 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={payPending || paymentUnitOptions.length === 0}
              className="inline-flex items-center gap-2 rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-50"
            >
              {payPending ? <ButtonSpinner /> : null}
              {balanceAdjustment === "none" ? "Save payment" : "Save"}
            </button>
          </div>
        </form>
      </ModalOverlay>

      <ModalOverlay open={isDeleteOpen} onClose={() => setIsDeleteOpen(false)} panelClassName={MODAL_PANEL_XL}>
        <h2 className="text-lg font-semibold">Delete this client?</h2>
        <p className="mt-2 text-sm text-muted">
          Are you sure you want to delete {client.fullName}? This cannot be undone. Payments already
          recorded in Finance will stay on the books.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setIsDeleteOpen(false)}
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
    </div>
  );
}
