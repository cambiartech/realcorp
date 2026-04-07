"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSnackbar } from "@/components/snackbar";
import {
  createInvoiceRecord,
  getEntityTimelineLogs,
  recordInvoicePayment,
  resolvePendingFinance,
  sendInvoiceRecord,
  sendInvoiceReminder,
  updateInvoiceRecord,
  voidInvoiceRecord,
} from "./actions";
import { UiSelect } from "@/components/ui-select";

type FinanceDeal = {
  id: string;
  title: string;
  owner: string;
  stage: string;
  value: string;
  createdAtLabel: string;
};

type FinanceDecisionItem = {
  id: string;
  title: string;
  decision: "Approved" | "Rejected";
  reviewedBy: string;
  reviewedAtLabel: string;
};

type DealOption = {
  id: string;
  label: string;
};

type InvoiceRecordItem = {
  id: string;
  invoiceNumber: string;
  title: string;
  status: string;
  statusValue: "DRAFT" | "SENT" | "PARTIALLY_PAID" | "PAID" | "VOID";
  amountLabel: string;
  amountValue: number;
  currency: string;
  balanceLabel: string;
  balanceValue: number;
  dueDateLabel: string;
  dueDateValue: string;
  paymentsCount: number;
  lastPaymentLabel: string;
  canRecordPayment: boolean;
  canSend: boolean;
  canVoid: boolean;
  canSendReminder: boolean;
  isOverdue: boolean;
  overdueDays: number;
  reminderCount: number;
  lastReminderLabel: string;
  followUpOwner: string;
};

type PaymentRow = {
  id: string;
  invoiceLabel: string;
  amountLabel: string;
  method: string;
  reference: string;
  paidAtLabel: string;
  recordedBy: string;
};

type MasterLogRow = {
  id: string;
  timestamp: string;
  actor: string;
  module: string;
  action: string;
  entityType: string;
  summary: string;
};

type TimelineLogRow = {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  summary: string;
};

type LogFilters = {
  activeTab: string;
  recordsTab: string;
  logsPage: number;
  logsQ: string;
  logsModule: string;
  logsAction: string;
  logsActor: string;
  logsFrom: string;
  logsTo: string;
  logsEntityType: string;
  logsEntityId: string;
};

type LogPagination = {
  total: number;
  totalPages: number;
  pageSize: number;
};

type LogFilterOptions = {
  modules: string[];
  actions: string[];
  actors: string[];
};

type ArView = {
  totalOpenInvoices: number;
  overdueInvoices: number;
  followUpsNeeded: number;
  agingBuckets: {
    current: string;
    d1_30: string;
    d31_60: string;
    d61_90: string;
    d90_plus: string;
    noDueDate: string;
  };
  followUps: Array<{
    id: string;
    invoiceNumber: string;
    title: string;
    owner: string;
    overdueDays: number;
    balanceLabel: string;
    reminderCount: number;
    lastReminderLabel: string;
  }>;
};

type ReportView = {
  pnlLite: {
    invoicedLabel: string;
    collectedLabel: string;
    outstandingLabel: string;
  };
  cashflowLite: {
    currentMonthLabel: string;
    previousMonthLabel: string;
    deltaLabel: string;
  };
  collections: {
    collectionRateLabel: string;
    overdueOutstandingLabel: string;
    overdueCount: number;
    remindersSent: number;
  };
};

export function FinanceWorkspace({
  tenantSlug,
  canManageFinance,
  deals,
  recentDecisions,
  dealOptions,
  invoices,
  payments,
  masterLogs,
  logFilters,
  logPagination,
  logFilterOptions,
  arView,
  reportView,
}: {
  tenantSlug: string;
  canManageFinance: boolean;
  deals: FinanceDeal[];
  recentDecisions: FinanceDecisionItem[];
  dealOptions: DealOption[];
  invoices: InvoiceRecordItem[];
  payments: PaymentRow[];
  masterLogs: MasterLogRow[];
  logFilters: LogFilters;
  logPagination: LogPagination;
  logFilterOptions: LogFilterOptions;
  arView: ArView;
  reportView: ReportView;
}) {
  const [activeTab, setActiveTab] = useState<"queue" | "audit" | "records">(
    logFilters.activeTab === "records" || logFilters.activeTab === "audit" ? (logFilters.activeTab as "records" | "audit") : "queue",
  );
  const [recordsTab, setRecordsTab] = useState<"invoices" | "payments" | "logs" | "ar" | "reports">(
    logFilters.recordsTab === "payments" ||
      logFilters.recordsTab === "logs" ||
      logFilters.recordsTab === "ar" ||
      logFilters.recordsTab === "reports"
      ? (logFilters.recordsTab as "payments" | "logs" | "ar" | "reports")
      : "invoices",
  );
  const [items, setItems] = useState(deals);
  const [pendingDealId, setPendingDealId] = useState<string | null>(null);
  const [isCreateInvoiceOpen, setIsCreateInvoiceOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<InvoiceRecordItem | null>(null);
  const [paymentInvoice, setPaymentInvoice] = useState<InvoiceRecordItem | null>(null);
  const [timelineTarget, setTimelineTarget] = useState<{ entityType: string; entityId: string; title: string } | null>(null);
  const [timelineLogs, setTimelineLogs] = useState<TimelineLogRow[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [actionPending, setActionPending] = useState(false);
  const { showSnackbar } = useSnackbar();
  const router = useRouter();

  function exportLogsCsv() {
    if (masterLogs.length === 0) {
      showSnackbar("No logs to export for selected filters.", "info");
      return;
    }
    const header = ["Timestamp", "Actor", "Module", "Action", "Entity", "Summary"];
    const rows = masterLogs.map((log) => [
      log.timestamp,
      log.actor,
      log.module,
      log.action,
      log.entityType,
      log.summary,
    ]);
    const toCsvCell = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [header, ...rows].map((line) => line.map(toCsvCell).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `finance-master-log-page-${logFilters.logsPage}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function handleDecision(dealId: string, decision: "APPROVE" | "REJECT") {
    if (!canManageFinance || pendingDealId) return;

    setPendingDealId(dealId);
    const previous = items;
    setItems((curr) => curr.filter((deal) => deal.id !== dealId));

    const result = await resolvePendingFinance(tenantSlug, dealId, decision);
    if (!result.ok) {
      setItems(previous);
      showSnackbar(result.error, "error");
      setPendingDealId(null);
      return;
    }

    showSnackbar(
      decision === "APPROVE" ? "Finance approved and removed from queue." : "Finance rejected and removed from queue.",
      "success",
    );
    setPendingDealId(null);
  }

  async function handleCreateInvoice(formData: FormData) {
    if (actionPending) return;
    setActionPending(true);
    const result = await createInvoiceRecord(tenantSlug, {
      dealId: String(formData.get("dealId") || ""),
      title: String(formData.get("title") || ""),
      amount: Number(formData.get("amount") || 0),
      currency: String(formData.get("currency") || "NGN"),
      dueDate: String(formData.get("dueDate") || ""),
    });
    if (!result.ok) {
      showSnackbar(result.error, "error");
      setActionPending(false);
      return;
    }
    showSnackbar("Invoice created.", "success");
    setIsCreateInvoiceOpen(false);
    setActionPending(false);
    router.refresh();
  }

  async function handleRecordPayment(formData: FormData) {
    if (!paymentInvoice || actionPending) return;
    setActionPending(true);
    const result = await recordInvoicePayment(tenantSlug, paymentInvoice.id, {
      amount: Number(formData.get("amount") || 0),
      paidAt: String(formData.get("paidAt") || ""),
      method: String(formData.get("method") || ""),
      reference: String(formData.get("reference") || ""),
      note: String(formData.get("note") || ""),
    });
    if (!result.ok) {
      showSnackbar(result.error, "error");
      setActionPending(false);
      return;
    }
    showSnackbar("Payment recorded.", "success");
    setPaymentInvoice(null);
    setActionPending(false);
    router.refresh();
  }

  async function handleEditInvoice(formData: FormData) {
    if (!editingInvoice || actionPending) return;
    setActionPending(true);
    const statusRaw = String(formData.get("status") || "SENT");
    const result = await updateInvoiceRecord(tenantSlug, editingInvoice.id, {
      title: String(formData.get("title") || ""),
      amount: Number(formData.get("amount") || 0),
      currency: String(formData.get("currency") || "NGN"),
      dueDate: String(formData.get("dueDate") || ""),
      status: statusRaw === "DRAFT" || statusRaw === "SENT" || statusRaw === "VOID" ? statusRaw : "SENT",
    });
    if (!result.ok) {
      showSnackbar(result.error, "error");
      setActionPending(false);
      return;
    }
    showSnackbar("Invoice updated.", "success");
    setEditingInvoice(null);
    setActionPending(false);
    router.refresh();
  }

  async function handleSendInvoice(invoice: InvoiceRecordItem) {
    if (actionPending || !invoice.canSend) return;
    setActionPending(true);
    const result = await sendInvoiceRecord(tenantSlug, invoice.id);
    if (!result.ok) {
      showSnackbar(result.error, "error");
      setActionPending(false);
      return;
    }
    showSnackbar("Invoice sent.", "success");
    setActionPending(false);
    router.refresh();
  }

  async function handleVoidInvoice(invoice: InvoiceRecordItem) {
    if (actionPending || !invoice.canVoid) return;
    setActionPending(true);
    const result = await voidInvoiceRecord(tenantSlug, invoice.id);
    if (!result.ok) {
      showSnackbar(result.error, "error");
      setActionPending(false);
      return;
    }
    showSnackbar("Invoice voided.", "success");
    setActionPending(false);
    router.refresh();
  }

  async function handleSendReminder(invoice: InvoiceRecordItem) {
    if (actionPending || !invoice.canSendReminder) return;
    setActionPending(true);
    const result = await sendInvoiceReminder(tenantSlug, invoice.id);
    if (!result.ok) {
      showSnackbar(result.error, "error");
      setActionPending(false);
      return;
    }
    showSnackbar("Reminder sent.", "success");
    setActionPending(false);
    router.refresh();
  }

  async function openTimeline(entityType: string, entityId: string, title: string) {
    setTimelineTarget({ entityType, entityId, title });
    setTimelineLoading(true);
    const result = await getEntityTimelineLogs(tenantSlug, entityType, entityId);
    if (!result.ok) {
      showSnackbar(result.error, "error");
      setTimelineLogs([]);
      setTimelineLoading(false);
      return;
    }
    setTimelineLogs(result.logs);
    setTimelineLoading(false);
  }

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-6 sm:py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Finance Queue</h1>
          <p className="mt-1 text-sm text-muted">Review pending finance checks before pipeline progression.</p>
        </div>
      </div>

      <div className="mt-5 border-b border-foreground/10">
        <div className="flex gap-5">
          <button
            type="button"
            onClick={() => setActiveTab("queue")}
            className={["relative py-2 text-sm font-medium", activeTab === "queue" ? "text-foreground" : "text-muted"].join(" ")}
          >
            Pending Queue ({items.length})
            <span
              className={[
                "absolute -bottom-px left-0 h-0.5 w-full",
                activeTab === "queue" ? "bg-foreground" : "bg-transparent",
              ].join(" ")}
            />
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("audit")}
            className={["relative py-2 text-sm font-medium", activeTab === "audit" ? "text-foreground" : "text-muted"].join(" ")}
          >
            Audit Log ({recentDecisions.length})
            <span
              className={[
                "absolute -bottom-px left-0 h-0.5 w-full",
                activeTab === "audit" ? "bg-foreground" : "bg-transparent",
              ].join(" ")}
            />
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("records")}
            className={["relative py-2 text-sm font-medium", activeTab === "records" ? "text-foreground" : "text-muted"].join(" ")}
          >
            Records ({invoices.length})
            <span
              className={[
                "absolute -bottom-px left-0 h-0.5 w-full",
                activeTab === "records" ? "bg-foreground" : "bg-transparent",
              ].join(" ")}
            />
          </button>
        </div>
      </div>

      {!canManageFinance ? (
        <div className="mt-6 rounded-lg border border-foreground/10 bg-foreground/[0.02] p-4 text-sm text-muted">
          You can view this queue, but only Org Admin and Finance Manager can approve or reject items.
        </div>
      ) : null}

      <section className="mt-6 rounded-lg border border-foreground/10 bg-background">
        <header className="border-b border-foreground/10 bg-foreground/[0.02] px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">
            {activeTab === "queue"
              ? "Pending Finance Checks"
              : activeTab === "audit"
                ? "Recent Finance Decisions"
                : "Finance Records"}
          </h2>
        </header>

        {activeTab === "queue" ? (
          <>
            <div className="hidden grid-cols-[2.2fr_1fr_1fr_1fr_1.2fr] gap-3 border-b border-foreground/10 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted md:grid">
              <p>Deal</p>
              <p>Owner</p>
              <p>Stage</p>
              <p>Value</p>
              <p>Action</p>
            </div>
            {items.length === 0 ? (
              <div className="p-5 text-sm text-muted">No pending finance items right now.</div>
            ) : (
              <ul className="divide-y divide-foreground/10">
                {items.map((deal) => {
                  const isPending = pendingDealId === deal.id;
                  return (
                    <li key={deal.id} className="grid gap-3 px-4 py-4 md:grid-cols-[2.2fr_1fr_1fr_1fr_1.2fr] md:items-center">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{deal.title}</p>
                        <p className="mt-0.5 text-xs text-muted">Submitted {deal.createdAtLabel}</p>
                      </div>
                      <p className="text-sm text-muted">{deal.owner}</p>
                      <p className="text-sm text-muted">{deal.stage}</p>
                      <p className="text-sm text-foreground">{deal.value}</p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={!canManageFinance || isPending || Boolean(pendingDealId)}
                          onClick={() => handleDecision(deal.id, "APPROVE")}
                          className="rounded-md border border-foreground bg-foreground px-3 py-1.5 text-xs font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
                        >
                          {isPending ? "Saving..." : "Approve"}
                        </button>
                        <button
                          type="button"
                          disabled={!canManageFinance || isPending || Boolean(pendingDealId)}
                          onClick={() => handleDecision(deal.id, "REJECT")}
                          className="rounded-md border border-error/35 px-3 py-1.5 text-xs font-semibold text-error hover:bg-error/10 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        ) : activeTab === "audit" ? (
          recentDecisions.length === 0 ? (
          <p className="px-4 py-4 text-sm text-muted">No decisions recorded yet.</p>
        ) : (
          <ul className="divide-y divide-foreground/10">
            {recentDecisions.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <div>
                  <p className="font-medium text-foreground">{item.title}</p>
                  <p className="text-xs text-muted">
                    {item.reviewedBy} - {item.reviewedAtLabel}
                  </p>
                </div>
                <span
                  className={[
                    "rounded-full border px-2 py-0.5 text-xs font-semibold",
                    item.decision === "Approved"
                      ? "border-emerald-300/40 text-emerald-400"
                      : "border-red-300/40 text-red-400",
                  ].join(" ")}
                >
                  {item.decision}
                </span>
              </li>
            ))}
          </ul>
        )
        ) : (
          <div className="p-4">
            <div className="mb-3 border-b border-foreground/10">
              <div className="flex gap-5">
                <button
                  type="button"
                  onClick={() => setRecordsTab("invoices")}
                  className={[
                    "relative py-2 text-sm font-medium",
                    recordsTab === "invoices" ? "text-foreground" : "text-muted",
                  ].join(" ")}
                >
                  Invoices ({invoices.length})
                  <span
                    className={[
                      "absolute -bottom-px left-0 h-0.5 w-full",
                      recordsTab === "invoices" ? "bg-foreground" : "bg-transparent",
                    ].join(" ")}
                  />
                </button>
                <button
                  type="button"
                  onClick={() => setRecordsTab("payments")}
                  className={[
                    "relative py-2 text-sm font-medium",
                    recordsTab === "payments" ? "text-foreground" : "text-muted",
                  ].join(" ")}
                >
                  Payments ({payments.length})
                  <span
                    className={[
                      "absolute -bottom-px left-0 h-0.5 w-full",
                      recordsTab === "payments" ? "bg-foreground" : "bg-transparent",
                    ].join(" ")}
                  />
                </button>
                <button
                  type="button"
                  onClick={() => setRecordsTab("logs")}
                  className={[
                    "relative py-2 text-sm font-medium",
                    recordsTab === "logs" ? "text-foreground" : "text-muted",
                  ].join(" ")}
                >
                  Master Log ({masterLogs.length})
                  <span
                    className={[
                      "absolute -bottom-px left-0 h-0.5 w-full",
                      recordsTab === "logs" ? "bg-foreground" : "bg-transparent",
                    ].join(" ")}
                  />
                </button>
                <button
                  type="button"
                  onClick={() => setRecordsTab("ar")}
                  className={[
                    "relative py-2 text-sm font-medium",
                    recordsTab === "ar" ? "text-foreground" : "text-muted",
                  ].join(" ")}
                >
                  AR ({arView.overdueInvoices} overdue)
                  <span
                    className={[
                      "absolute -bottom-px left-0 h-0.5 w-full",
                      recordsTab === "ar" ? "bg-foreground" : "bg-transparent",
                    ].join(" ")}
                  />
                </button>
                <button
                  type="button"
                  onClick={() => setRecordsTab("reports")}
                  className={[
                    "relative py-2 text-sm font-medium",
                    recordsTab === "reports" ? "text-foreground" : "text-muted",
                  ].join(" ")}
                >
                  Reports
                  <span
                    className={[
                      "absolute -bottom-px left-0 h-0.5 w-full",
                      recordsTab === "reports" ? "bg-foreground" : "bg-transparent",
                    ].join(" ")}
                  />
                </button>
              </div>
            </div>
            <div className="mb-3 flex items-center justify-end">
              {canManageFinance ? (
                <button
                  type="button"
                  onClick={() => setIsCreateInvoiceOpen(true)}
                  className="rounded-md border border-foreground bg-foreground px-3 py-1.5 text-xs font-semibold text-background transition-opacity hover:opacity-90"
                >
                  New invoice
                </button>
              ) : null}
            </div>

            {recordsTab === "invoices" ? (
              invoices.length === 0 ? (
              <p className="text-sm text-muted">No invoice records yet.</p>
            ) : (
              <div className="overflow-hidden rounded-lg border border-foreground/10">
                <table className="w-full text-left text-sm">
                  <thead className="bg-foreground/[0.03] text-xs uppercase tracking-wide text-muted">
                    <tr>
                      <th className="px-3 py-2">Invoice</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2">Amount</th>
                      <th className="px-3 py-2">Balance</th>
                      <th className="px-3 py-2">Due</th>
                      <th className="px-3 py-2">Aging</th>
                      <th className="px-3 py-2">Payments</th>
                      <th className="px-3 py-2">Reminders</th>
                      <th className="px-3 py-2">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-foreground/10">
                    {invoices.map((invoice) => (
                      <tr key={invoice.id}>
                        <td className="px-3 py-2">
                          <p className="font-medium text-foreground">{invoice.invoiceNumber}</p>
                          <p className="text-xs text-muted">{invoice.title}</p>
                        </td>
                        <td className="px-3 py-2 text-muted">{invoice.status}</td>
                        <td className="px-3 py-2 text-foreground">{invoice.amountLabel}</td>
                        <td className="px-3 py-2 text-foreground">{invoice.balanceLabel}</td>
                        <td className="px-3 py-2 text-muted">{invoice.dueDateLabel}</td>
                        <td className="px-3 py-2 text-muted">{invoice.isOverdue ? `${invoice.overdueDays} day(s) overdue` : "Current"}</td>
                        <td className="px-3 py-2 text-muted">
                          {invoice.paymentsCount} - {invoice.lastPaymentLabel}
                        </td>
                        <td className="px-3 py-2 text-muted">
                          {invoice.reminderCount} - {invoice.lastReminderLabel}
                        </td>
                        <td className="px-3 py-2">
                          {canManageFinance ? (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setEditingInvoice(invoice)}
                                className="text-xs text-muted underline decoration-foreground/20 underline-offset-2 hover:text-foreground"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => openTimeline("INVOICE", invoice.id, `${invoice.invoiceNumber} timeline`)}
                                className="text-xs text-muted underline decoration-foreground/20 underline-offset-2 hover:text-foreground"
                              >
                                Timeline
                              </button>
                              <button
                                type="button"
                                disabled={!invoice.canRecordPayment}
                                onClick={() => setPaymentInvoice(invoice)}
                                className="text-xs text-foreground underline decoration-foreground/30 underline-offset-2 disabled:opacity-40"
                              >
                                Record payment
                              </button>
                              <button
                                type="button"
                                disabled={!invoice.canSend || actionPending}
                                onClick={() => handleSendInvoice(invoice)}
                                className="text-xs text-foreground underline decoration-foreground/30 underline-offset-2 disabled:opacity-40"
                              >
                                Send
                              </button>
                              <button
                                type="button"
                                disabled={!invoice.canSendReminder || actionPending}
                                onClick={() => handleSendReminder(invoice)}
                                className="text-xs text-foreground underline decoration-foreground/30 underline-offset-2 disabled:opacity-40"
                              >
                                Remind
                              </button>
                              <button
                                type="button"
                                disabled={!invoice.canVoid || actionPending}
                                onClick={() => handleVoidInvoice(invoice)}
                                className="text-xs text-error underline decoration-error/40 underline-offset-2 disabled:opacity-40"
                              >
                                Void
                              </button>
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
            ) : recordsTab === "payments" ? (
              payments.length === 0 ? (
                <p className="text-sm text-muted">No payment records yet.</p>
              ) : (
                <div className="overflow-hidden rounded-lg border border-foreground/10">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-foreground/[0.03] text-xs uppercase tracking-wide text-muted">
                      <tr>
                        <th className="px-3 py-2">Invoice</th>
                        <th className="px-3 py-2">Amount</th>
                        <th className="px-3 py-2">Method</th>
                        <th className="px-3 py-2">Reference</th>
                        <th className="px-3 py-2">Paid At</th>
                        <th className="px-3 py-2">Recorded By</th>
                        <th className="px-3 py-2">Receipt</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-foreground/10">
                      {payments.map((payment) => (
                        <tr key={payment.id}>
                          <td className="px-3 py-2">{payment.invoiceLabel}</td>
                          <td className="px-3 py-2">{payment.amountLabel}</td>
                          <td className="px-3 py-2">{payment.method}</td>
                          <td className="px-3 py-2">{payment.reference}</td>
                          <td className="px-3 py-2">{payment.paidAtLabel}</td>
                          <td className="px-3 py-2">{payment.recordedBy}</td>
                          <td className="px-3 py-2">
                            <Link
                              href={`/${tenantSlug}/finance/receipt/${payment.id}`}
                              className="text-xs text-foreground underline decoration-foreground/30 underline-offset-2"
                            >
                              Open
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            ) : recordsTab === "ar" ? (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-lg border border-foreground/10 bg-foreground/[0.02] p-3">
                    <p className="text-xs uppercase tracking-wide text-muted">Open invoices</p>
                    <p className="mt-1 text-xl font-semibold text-foreground">{arView.totalOpenInvoices}</p>
                  </div>
                  <div className="rounded-lg border border-foreground/10 bg-foreground/[0.02] p-3">
                    <p className="text-xs uppercase tracking-wide text-muted">Overdue</p>
                    <p className="mt-1 text-xl font-semibold text-foreground">{arView.overdueInvoices}</p>
                  </div>
                  <div className="rounded-lg border border-foreground/10 bg-foreground/[0.02] p-3">
                    <p className="text-xs uppercase tracking-wide text-muted">Follow-ups needed</p>
                    <p className="mt-1 text-xl font-semibold text-foreground">{arView.followUpsNeeded}</p>
                  </div>
                </div>
                <div className="overflow-hidden rounded-lg border border-foreground/10">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-foreground/[0.03] text-xs uppercase tracking-wide text-muted">
                      <tr>
                        <th className="px-3 py-2">Current</th>
                        <th className="px-3 py-2">1-30</th>
                        <th className="px-3 py-2">31-60</th>
                        <th className="px-3 py-2">61-90</th>
                        <th className="px-3 py-2">90+</th>
                        <th className="px-3 py-2">No due date</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-t border-foreground/10">
                        <td className="px-3 py-2">{arView.agingBuckets.current}</td>
                        <td className="px-3 py-2">{arView.agingBuckets.d1_30}</td>
                        <td className="px-3 py-2">{arView.agingBuckets.d31_60}</td>
                        <td className="px-3 py-2">{arView.agingBuckets.d61_90}</td>
                        <td className="px-3 py-2">{arView.agingBuckets.d90_plus}</td>
                        <td className="px-3 py-2">{arView.agingBuckets.noDueDate}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                {arView.followUps.length === 0 ? (
                  <p className="text-sm text-muted">No overdue follow-up queue right now.</p>
                ) : (
                  <div className="overflow-hidden rounded-lg border border-foreground/10">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-foreground/[0.03] text-xs uppercase tracking-wide text-muted">
                        <tr>
                          <th className="px-3 py-2">Invoice</th>
                          <th className="px-3 py-2">Owner</th>
                          <th className="px-3 py-2">Overdue</th>
                          <th className="px-3 py-2">Balance</th>
                          <th className="px-3 py-2">Reminder history</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-foreground/10">
                        {arView.followUps.map((row) => (
                          <tr key={row.id}>
                            <td className="px-3 py-2">
                              <p className="font-medium text-foreground">{row.invoiceNumber}</p>
                              <p className="text-xs text-muted">{row.title}</p>
                            </td>
                            <td className="px-3 py-2 text-muted">{row.owner}</td>
                            <td className="px-3 py-2 text-muted">{row.overdueDays} day(s)</td>
                            <td className="px-3 py-2 text-foreground">{row.balanceLabel}</td>
                            <td className="px-3 py-2 text-muted">
                              {row.reminderCount} - {row.lastReminderLabel}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : recordsTab === "reports" ? (
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-lg border border-foreground/10 bg-foreground/[0.02] p-3">
                  <p className="text-xs uppercase tracking-wide text-muted">P&L-lite invoiced</p>
                  <p className="mt-1 text-lg font-semibold text-foreground">{reportView.pnlLite.invoicedLabel}</p>
                  <p className="mt-1 text-xs text-muted">Collected: {reportView.pnlLite.collectedLabel}</p>
                  <p className="text-xs text-muted">Outstanding: {reportView.pnlLite.outstandingLabel}</p>
                </div>
                <div className="rounded-lg border border-foreground/10 bg-foreground/[0.02] p-3">
                  <p className="text-xs uppercase tracking-wide text-muted">Cashflow-lite</p>
                  <p className="mt-1 text-xs text-muted">Current month: {reportView.cashflowLite.currentMonthLabel}</p>
                  <p className="text-xs text-muted">Previous month: {reportView.cashflowLite.previousMonthLabel}</p>
                  <p className="mt-1 text-lg font-semibold text-foreground">Delta: {reportView.cashflowLite.deltaLabel}</p>
                </div>
                <div className="rounded-lg border border-foreground/10 bg-foreground/[0.02] p-3">
                  <p className="text-xs uppercase tracking-wide text-muted">Collections performance</p>
                  <p className="mt-1 text-lg font-semibold text-foreground">{reportView.collections.collectionRateLabel}</p>
                  <p className="mt-1 text-xs text-muted">Overdue amount: {reportView.collections.overdueOutstandingLabel}</p>
                  <p className="text-xs text-muted">Overdue invoices: {reportView.collections.overdueCount}</p>
                  <p className="text-xs text-muted">Reminders sent: {reportView.collections.remindersSent}</p>
                </div>
              </div>
            ) : masterLogs.length === 0 ? (
              <p className="text-sm text-muted">No master logs yet.</p>
            ) : (
              <div className="space-y-3">
                <form action={`/${tenantSlug}/finance`} method="get" className="grid gap-2 md:grid-cols-6">
                  <input type="hidden" name="activeTab" value="records" />
                  <input type="hidden" name="recordsTab" value="logs" />
                  {logFilters.logsEntityType ? <input type="hidden" name="logsEntityType" value={logFilters.logsEntityType} /> : null}
                  {logFilters.logsEntityId ? <input type="hidden" name="logsEntityId" value={logFilters.logsEntityId} /> : null}
                  <input
                    name="logsQ"
                    defaultValue={logFilters.logsQ}
                    placeholder="Search summary, actor, action..."
                    className="md:col-span-2 w-full border border-foreground/15 bg-field px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-foreground/20"
                  />
                  <UiSelect name="logsModule" defaultValue={logFilters.logsModule}>
                    <option value="">All modules</option>
                    {logFilterOptions.modules.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </UiSelect>
                  <UiSelect name="logsAction" defaultValue={logFilters.logsAction}>
                    <option value="">All actions</option>
                    {logFilterOptions.actions.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </UiSelect>
                  <UiSelect name="logsActor" defaultValue={logFilters.logsActor}>
                    <option value="">All actors</option>
                    {logFilterOptions.actors.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </UiSelect>
                  <div className="flex items-center gap-2">
                    <button
                      type="submit"
                      className="rounded-md border border-foreground/15 px-3 py-2 text-xs font-semibold text-foreground hover:bg-foreground/[0.06]"
                    >
                      Apply
                    </button>
                    <button
                      type="button"
                      onClick={exportLogsCsv}
                      className="rounded-md border border-foreground/15 px-3 py-2 text-xs font-semibold text-foreground hover:bg-foreground/[0.06]"
                    >
                      Export CSV
                    </button>
                  </div>
                </form>
                <form action={`/${tenantSlug}/finance`} method="get" className="grid gap-2 md:grid-cols-6">
                  <input type="hidden" name="activeTab" value="records" />
                  <input type="hidden" name="recordsTab" value="logs" />
                  <input type="hidden" name="logsQ" value={logFilters.logsQ} />
                  <input type="hidden" name="logsModule" value={logFilters.logsModule} />
                  <input type="hidden" name="logsAction" value={logFilters.logsAction} />
                  <input type="hidden" name="logsActor" value={logFilters.logsActor} />
                  {logFilters.logsEntityType ? <input type="hidden" name="logsEntityType" value={logFilters.logsEntityType} /> : null}
                  {logFilters.logsEntityId ? <input type="hidden" name="logsEntityId" value={logFilters.logsEntityId} /> : null}
                  <input
                    type="date"
                    name="logsFrom"
                    defaultValue={logFilters.logsFrom}
                    className="w-full border border-foreground/15 bg-field px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
                  />
                  <input
                    type="date"
                    name="logsTo"
                    defaultValue={logFilters.logsTo}
                    className="w-full border border-foreground/15 bg-field px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
                  />
                  <div className="md:col-span-4 flex items-center gap-2">
                    <button
                      type="submit"
                      className="rounded-md border border-foreground/15 px-3 py-2 text-xs font-semibold text-foreground hover:bg-foreground/[0.06]"
                    >
                      Apply dates
                    </button>
                    <button
                      type="button"
                      onClick={() => router.push(`/${tenantSlug}/finance?activeTab=records&recordsTab=logs`)}
                      className="rounded-md border border-foreground/15 px-3 py-2 text-xs font-semibold text-muted hover:text-foreground"
                    >
                      Clear filters
                    </button>
                    <p className="text-xs text-muted">
                      {logPagination.total} total log(s), page {logFilters.logsPage} of {logPagination.totalPages}
                    </p>
                  </div>
                </form>
                <div className="overflow-hidden rounded-lg border border-foreground/10">
                <table className="w-full text-left text-sm">
                  <thead className="bg-foreground/[0.03] text-xs uppercase tracking-wide text-muted">
                    <tr>
                      <th className="px-3 py-2">When</th>
                      <th className="px-3 py-2">Actor</th>
                      <th className="px-3 py-2">Module</th>
                      <th className="px-3 py-2">Action</th>
                      <th className="px-3 py-2">Entity</th>
                      <th className="px-3 py-2">Summary</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-foreground/10">
                    {masterLogs.map((log) => (
                      <tr key={log.id}>
                        <td className="px-3 py-2">{log.timestamp}</td>
                        <td className="px-3 py-2">{log.actor}</td>
                        <td className="px-3 py-2">{log.module}</td>
                        <td className="px-3 py-2">{log.action}</td>
                        <td className="px-3 py-2">{log.entityType}</td>
                        <td className="px-3 py-2">{log.summary}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between">
                <Link
                  href={`/${tenantSlug}/finance?activeTab=records&recordsTab=logs&logsPage=${Math.max(1, logFilters.logsPage - 1)}&logsQ=${encodeURIComponent(logFilters.logsQ)}&logsModule=${encodeURIComponent(logFilters.logsModule)}&logsAction=${encodeURIComponent(logFilters.logsAction)}&logsActor=${encodeURIComponent(logFilters.logsActor)}&logsFrom=${encodeURIComponent(logFilters.logsFrom)}&logsTo=${encodeURIComponent(logFilters.logsTo)}&logsEntityType=${encodeURIComponent(logFilters.logsEntityType)}&logsEntityId=${encodeURIComponent(logFilters.logsEntityId)}`}
                  className={[
                    "rounded-md border px-3 py-1.5 text-xs font-semibold",
                    logFilters.logsPage <= 1
                      ? "pointer-events-none border-foreground/10 text-muted/60"
                      : "border-foreground/15 text-foreground hover:bg-foreground/[0.06]",
                  ].join(" ")}
                >
                  Previous
                </Link>
                <Link
                  href={`/${tenantSlug}/finance?activeTab=records&recordsTab=logs&logsPage=${Math.min(logPagination.totalPages, logFilters.logsPage + 1)}&logsQ=${encodeURIComponent(logFilters.logsQ)}&logsModule=${encodeURIComponent(logFilters.logsModule)}&logsAction=${encodeURIComponent(logFilters.logsAction)}&logsActor=${encodeURIComponent(logFilters.logsActor)}&logsFrom=${encodeURIComponent(logFilters.logsFrom)}&logsTo=${encodeURIComponent(logFilters.logsTo)}&logsEntityType=${encodeURIComponent(logFilters.logsEntityType)}&logsEntityId=${encodeURIComponent(logFilters.logsEntityId)}`}
                  className={[
                    "rounded-md border px-3 py-1.5 text-xs font-semibold",
                    logFilters.logsPage >= logPagination.totalPages
                      ? "pointer-events-none border-foreground/10 text-muted/60"
                      : "border-foreground/15 text-foreground hover:bg-foreground/[0.06]",
                  ].join(" ")}
                >
                  Next
                </Link>
              </div>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="mt-6 rounded-lg border border-foreground/10 bg-foreground/[0.02] p-4">
        <h3 className="text-sm font-semibold text-foreground">How teams interact with this flow</h3>
        <div className="mt-2 grid gap-2 text-sm text-muted">
          <p>
            Sales team creates/updates deals and flags finance checks as pending; those deals appear in{" "}
            <span className="font-medium text-foreground">Pending Queue</span>.
          </p>
          <p>
            Finance Manager or Org Admin approves/rejects from queue; decision metadata is saved with reviewer and
            timestamp.
          </p>
          <p>
            Everyone can see resolved items in <span className="font-medium text-foreground">Audit Log</span> for
            accountability and reporting.
          </p>
        </div>
      </section>

      {isCreateInvoiceOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-foreground/10 bg-background p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold text-foreground">Create invoice</h2>
              <button
                type="button"
                onClick={() => setIsCreateInvoiceOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-foreground/15 text-muted hover:bg-foreground/[0.06] hover:text-foreground"
                aria-label="Close modal"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <form action={handleCreateInvoice} className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-sm text-muted">Linked deal (optional)</label>
                <UiSelect name="dealId" defaultValue="">
                  <option value="">None</option>
                  {dealOptions.map((deal) => (
                    <option key={deal.id} value={deal.id}>
                      {deal.label}
                    </option>
                  ))}
                </UiSelect>
              </div>
              <div>
                <label className="mb-1 block text-sm text-muted">Invoice title</label>
                <input
                  name="title"
                  className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm text-muted">Amount</label>
                  <input
                    name="amount"
                    inputMode="decimal"
                    className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-muted">Currency</label>
                  <input
                    name="currency"
                    defaultValue="NGN"
                    maxLength={3}
                    className="w-full border border-foreground/15 bg-field px-3 py-2 uppercase text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm text-muted">Due date (optional)</label>
                <input
                  name="dueDate"
                  type="date"
                  className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateInvoiceOpen(false)}
                  className="rounded-md border border-foreground/15 px-4 py-2 text-sm text-foreground hover:bg-foreground/[0.06]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionPending}
                  className="rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {actionPending ? "Saving..." : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {paymentInvoice ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-foreground/10 bg-background p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold text-foreground">Record payment</h2>
              <button
                type="button"
                onClick={() => setPaymentInvoice(null)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-foreground/15 text-muted hover:bg-foreground/[0.06] hover:text-foreground"
                aria-label="Close modal"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <p className="mt-1 text-xs text-muted">
              {paymentInvoice.invoiceNumber} - Balance: {paymentInvoice.balanceLabel}
            </p>
            <form action={handleRecordPayment} className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-sm text-muted">Amount</label>
                <input
                  name="amount"
                  inputMode="decimal"
                  className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-muted">Paid date</label>
                <input
                  name="paidAt"
                  type="date"
                  defaultValue={new Date().toISOString().slice(0, 10)}
                  className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm text-muted">Method (optional)</label>
                  <input
                    name="method"
                    placeholder="Transfer"
                    className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-muted">Reference (optional)</label>
                  <input
                    name="reference"
                    className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm text-muted">Note (optional)</label>
                <textarea
                  name="note"
                  rows={3}
                  className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentInvoice(null)}
                  className="rounded-md border border-foreground/15 px-4 py-2 text-sm text-foreground hover:bg-foreground/[0.06]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionPending}
                  className="rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {actionPending ? "Saving..." : "Record"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {editingInvoice ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-foreground/10 bg-background p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold text-foreground">Edit invoice</h2>
              <button
                type="button"
                onClick={() => setEditingInvoice(null)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-foreground/15 text-muted hover:bg-foreground/[0.06] hover:text-foreground"
                aria-label="Close modal"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <form action={handleEditInvoice} className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-sm text-muted">Title</label>
                <input
                  name="title"
                  defaultValue={editingInvoice.title}
                  className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm text-muted">Amount</label>
                  <input
                    name="amount"
                    inputMode="decimal"
                    defaultValue={editingInvoice.amountValue}
                    className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-muted">Currency</label>
                  <input
                    name="currency"
                    defaultValue={editingInvoice.currency || "NGN"}
                    maxLength={3}
                    className="w-full border border-foreground/15 bg-field px-3 py-2 uppercase text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm text-muted">Due date</label>
                  <input
                    name="dueDate"
                    type="date"
                    defaultValue={editingInvoice.dueDateValue}
                    className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-muted">Status</label>
                  <UiSelect
                    name="status"
                    defaultValue={
                      editingInvoice.statusValue === "VOID"
                        ? "VOID"
                        : editingInvoice.statusValue === "DRAFT"
                          ? "DRAFT"
                          : "SENT"
                    }
                  >
                    <option value="DRAFT">Draft</option>
                    <option value="SENT">Sent</option>
                    <option value="VOID">Void</option>
                  </UiSelect>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingInvoice(null)}
                  className="rounded-md border border-foreground/15 px-4 py-2 text-sm text-foreground hover:bg-foreground/[0.06]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionPending}
                  className="rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {actionPending ? "Saving..." : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {timelineTarget ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/35 backdrop-blur-[1px]">
          <div className="h-full w-full max-w-md overflow-y-auto border-l border-foreground/10 bg-background p-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Entity Timeline</h2>
                <p className="text-xs text-muted">{timelineTarget.title}</p>
              </div>
              <button
                type="button"
                onClick={() => setTimelineTarget(null)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-foreground/15 text-muted hover:bg-foreground/[0.06] hover:text-foreground"
                aria-label="Close timeline"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            {timelineLoading ? (
              <p className="mt-4 text-sm text-muted">Loading timeline...</p>
            ) : timelineLogs.length === 0 ? (
              <p className="mt-4 text-sm text-muted">No timeline events yet.</p>
            ) : (
              <ul className="mt-4 space-y-2">
                {timelineLogs.map((log) => (
                  <li key={log.id} className="rounded-md border border-foreground/10 p-3">
                    <p className="text-xs text-muted">{log.timestamp}</p>
                    <p className="mt-0.5 text-sm font-medium text-foreground">{log.action}</p>
                    <p className="text-xs text-muted">By: {log.actor}</p>
                    <p className="mt-1 text-sm text-foreground/90">{log.summary}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
