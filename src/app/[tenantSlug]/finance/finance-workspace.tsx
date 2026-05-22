"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { FinanceControls } from "@/lib/finance-controls";
import { useSnackbar } from "@/components/snackbar";
import {
  createExpenseRecord,
  createInvoiceRecord,
  createSalesReceiptRecord,
  createVendorBill,
  recordVendorBillPayment,
  voidVendorBill,
  sendBulkOverdueReminders,
  autoMatchBankStatementRows,
  finalizeBankStatementImport,
  getFinanceUploadSignature,
  getEntityTimelineLogs,
  importBankStatementRows,
  markBankStatementRowException,
  markBankStatementRowMatched,
  saveBankStatementRowNote,
  unmatchBankStatementRow,
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
  issuedAtValue: string;
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
  projectId: string;
  projectLabel: string;
  unitId: string;
  unitLabel: string;
  department: string;
};

type PaymentRow = {
  id: string;
  invoiceLabel: string;
  amountLabel: string;
  amountValue: number;
  method: string;
  reference: string;
  referenceRaw: string;
  paidAtLabel: string;
  paidAtValue: string;
  recordedBy: string;
  hasAttachment: boolean;
  projectId: string;
  projectLabel: string;
  unitId: string;
  unitLabel: string;
  department: string;
};

type ExpenseRow = {
  id: string;
  category: string;
  vendorName: string;
  amountLabel: string;
  amountValue: number;
  paidThroughAccount: string;
  reference: string;
  referenceRaw: string;
  expenseDateLabel: string;
  expenseDateValue: string;
  hasAttachment: boolean;
  projectId: string;
  projectLabel: string;
  unitId: string;
  unitLabel: string;
  department: string;
};

type VendorBillRow = {
  id: string;
  billNumber: string;
  vendorName: string;
  title: string;
  status: string;
  statusValue: "OPEN" | "PARTIAL" | "PAID" | "VOID";
  amountLabel: string;
  amountValue: number;
  balanceLabel: string;
  balanceValue: number;
  currency: string;
  dueDateLabel: string;
  dueDateValue: string;
  issuedAtValue: string;
  department: string;
  isOverdue: boolean;
  overdueDays: number;
  canRecordPayment: boolean;
  canVoid: boolean;
};

type ImportedBankRow = {
  id: string;
  importId?: string;
  importSourceName?: string;
  importImportedAt?: string;
  date: string;
  description: string;
  reference: string;
  debit: number;
  credit: number;
  amountAbs: number;
  direction: "debit" | "credit";
  matchStatus?: "UNMATCHED" | "MATCHED" | "EXCEPTION";
  matchedEntityType?: string | null;
  matchedEntityId?: string | null;
  exceptionReason?: string | null;
  reconciliationNote?: string;
  importIsFinalized?: boolean;
};

type BankingImportSummary = {
  id: string;
  sourceName: string;
  importedAtLabel: string;
  totalRows: number;
  matchedRows: number;
  unmatchedRows: number;
  finalized: boolean;
};

type BankingDateFilter = "all" | "today" | "7d" | "month";
type BankingStatusFilter = "all" | "unmatched" | "matched" | "exception";
type ReportMonthWindow = 3 | 6 | 12;
type ReportKind = "pnl" | "cashflow" | "balance";
type ReportDrilldownKind = "invoices" | "payments" | "expenses";
type ReportCompareMode = "previous_period" | "same_period_last_year";

type BankMatch = {
  kind: "payment" | "expense";
  id: string;
  label: string;
  amount: number;
  date: string;
  score: number;
};

const BANK_EXCEPTION_REASON_OPTIONS = [
  "UNIDENTIFIED_DEPOSIT",
  "BANK_CHARGE",
  "INTEREST_OR_FEE",
  "DATE_MISMATCH",
  "DUPLICATE_LINE",
  "MISSING_INTERNAL_RECORD",
  "OTHER",
] as const;

type SalesReceiptRow = {
  id: string;
  receiptNumber: string;
  title: string;
  customerName: string;
  amountLabel: string;
  paymentMode: string;
  depositAccount: string;
  issuedAtLabel: string;
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
  currency: string;
  companyName: string;
  companyLogoUrl: string | null;
  generatedAtLabel: string;
  pnlLite: {
    invoicedLabel: string;
    collectedLabel: string;
    outstandingLabel: string;
  };
  cashflowLite: {
    currentMonthLabel: string;
    previousMonthLabel: string;
    changeLabel: string;
  };
  collections: {
    collectionRateLabel: string;
    overdueOutstandingLabel: string;
    overdueCount: number;
    remindersSent: number;
  };
  pnlBreakdown: Array<{
    month: string;
    invoiced: number;
    collected: number;
    expenses: number;
    net: number;
  }>;
  expenseBreakdown: Array<{
    category: string;
    total: number;
    count: number;
  }>;
  cashflowBreakdown: Array<{
    month: string;
    inflow: number;
    outflow: number;
    net: number;
  }>;
  balanceSnapshot: {
    receivables: number;
    overdueReceivables: number;
    cashIn: number;
    cashOut: number;
    netCashflow: number;
  };
};

function financeAuditLogsUrl(
  tenantSlug: string,
  filters: Pick<
    LogFilters,
    | "logsPage"
    | "logsQ"
    | "logsModule"
    | "logsAction"
    | "logsActor"
    | "logsFrom"
    | "logsTo"
    | "logsEntityType"
    | "logsEntityId"
  >,
  pageOverride?: number,
) {
  const params = new URLSearchParams();
  const page = pageOverride ?? filters.logsPage;
  if (page > 1) params.set("logsPage", String(page));
  const q = filters.logsQ.trim();
  if (q) params.set("logsQ", q);
  if (filters.logsModule.trim()) params.set("logsModule", filters.logsModule.trim());
  if (filters.logsAction.trim()) params.set("logsAction", filters.logsAction.trim());
  if (filters.logsActor.trim()) params.set("logsActor", filters.logsActor.trim());
  if (filters.logsFrom.trim()) params.set("logsFrom", filters.logsFrom.trim());
  if (filters.logsTo.trim()) params.set("logsTo", filters.logsTo.trim());
  if (filters.logsEntityType.trim()) params.set("logsEntityType", filters.logsEntityType.trim());
  if (filters.logsEntityId.trim()) params.set("logsEntityId", filters.logsEntityId.trim());
  const qs = params.toString();
  const base = `/${tenantSlug}/finance/audit-logs`;
  return qs ? `${base}?${qs}` : base;
}

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  cells.push(current.trim());
  return cells.map((c) => c.replace(/^"(.*)"$/, "$1").trim());
}

function parseMoneyCell(input: string): number {
  const cleaned = input.replace(/[, ]+/g, "").replace(/[^\d.-]/g, "");
  if (!cleaned) return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function csvCell(row: string[], idxMap: Record<string, number>, keys: string[]): string {
  for (const key of keys) {
    const idx = idxMap[key];
    if (idx !== undefined && idx >= 0 && idx < row.length) return String(row[idx] || "").trim();
  }
  return "";
}

function valueTone(value: number) {
  if (value > 0) return "text-emerald-600";
  if (value < 0) return "text-red-600";
  return "text-muted";
}

function rowFocusClass(highlightId: string | null, rowId: string) {
  return highlightId === rowId ? "bg-amber-500/10 ring-1 ring-inset ring-amber-500/35" : "";
}

function shiftMonthBoundary(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

export function FinanceWorkspace({
  tenantSlug,
  canManageFinance,
  deals,
  recentDecisions,
  dealOptions,
  invoices,
  payments,
  expenses,
  salesReceipts,
  masterLogs,
  logFilters,
  logPagination,
  logFilterOptions,
  arView,
  reportView,
  bankingRows,
  bankingImports,
  financeOptions,
  financeControls,
  vendorBills,
}: {
  tenantSlug: string;
  canManageFinance: boolean;
  deals: FinanceDeal[];
  recentDecisions: FinanceDecisionItem[];
  dealOptions: DealOption[];
  invoices: InvoiceRecordItem[];
  payments: PaymentRow[];
  expenses: ExpenseRow[];
  salesReceipts: SalesReceiptRow[];
  masterLogs: MasterLogRow[];
  logFilters: LogFilters;
  logPagination: LogPagination;
  logFilterOptions: LogFilterOptions;
  arView: ArView;
  reportView: ReportView;
  bankingRows: ImportedBankRow[];
  bankingImports: BankingImportSummary[];
  financeOptions: {
    bankAccounts: string[];
    paymentModes: string[];
    currencies: string[];
    departments: string[];
  };
  financeControls: FinanceControls;
  vendorBills: VendorBillRow[];
}) {
  const [items, setItems] = useState(deals);
  const [pendingDealId, setPendingDealId] = useState<string | null>(null);
  const [isCreateInvoiceOpen, setIsCreateInvoiceOpen] = useState(false);
  const [isCreateReceiptOpen, setIsCreateReceiptOpen] = useState(false);
  const [isCreateExpenseOpen, setIsCreateExpenseOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<InvoiceRecordItem | null>(null);
  const [paymentInvoice, setPaymentInvoice] = useState<InvoiceRecordItem | null>(null);
  const [paymentAttachment, setPaymentAttachment] = useState<{
    url: string;
    name: string;
    publicId: string;
  } | null>(null);
  const [uploadPending, setUploadPending] = useState(false);
  const [expenseAttachment, setExpenseAttachment] = useState<{
    url: string;
    name: string;
    publicId: string;
  } | null>(null);
  const [timelineTarget, setTimelineTarget] = useState<{ entityType: string; entityId: string; title: string } | null>(null);
  const [timelineLogs, setTimelineLogs] = useState<TimelineLogRow[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [actionPending, setActionPending] = useState(false);
  const [bankImportName, setBankImportName] = useState("");
  const [importedBankRows, setImportedBankRows] = useState<ImportedBankRow[]>(bankingRows || []);
  const [selectedImportId, setSelectedImportId] = useState<string>("all");
  const [showUnmatchedOnly, setShowUnmatchedOnly] = useState(true);
  const [bankDateFilter, setBankDateFilter] = useState<BankingDateFilter>("all");
  const [bankStatusFilter, setBankStatusFilter] = useState<BankingStatusFilter>("all");
  const [exceptionReasonFilter, setExceptionReasonFilter] = useState<string>("all");
  const [manualMatchSelection, setManualMatchSelection] = useState<Record<string, string>>({});
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [exceptionReasonDrafts, setExceptionReasonDrafts] = useState<Record<string, string>>({});
  const [reportMonthWindow, setReportMonthWindow] = useState<ReportMonthWindow>(6);
  const [reportKind, setReportKind] = useState<ReportKind>("pnl");
  const [reportCompareMode, setReportCompareMode] = useState<ReportCompareMode>("previous_period");
  const [reportProjectFilter, setReportProjectFilter] = useState<string>("all");
  const [reportUnitFilter, setReportUnitFilter] = useState<string>("all");
  const [reportDepartmentFilter, setReportDepartmentFilter] = useState<string>("all");
  const [reportDrilldownMonth, setReportDrilldownMonth] = useState<string | null>(null);
  const [paymentBill, setPaymentBill] = useState<VendorBillRow | null>(null);
  const [isCreateBillOpen, setIsCreateBillOpen] = useState(false);
  const [highlightFocusId, setHighlightFocusId] = useState<string | null>(null);
  const [autoMatching, setAutoMatching] = useState(false);
  const [finalizingImportId, setFinalizingImportId] = useState<string | null>(null);
  const { showSnackbar } = useSnackbar();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const financeBasePath = `/${tenantSlug}/finance`;
  useEffect(() => {
    setImportedBankRows(bankingRows || []);
  }, [bankingRows]);

  useEffect(() => {
    if (!bankingImports.length) {
      setSelectedImportId("all");
      return;
    }
    if (selectedImportId === "all") return;
    const exists = bankingImports.some((x) => x.id === selectedImportId);
    if (!exists) setSelectedImportId(bankingImports[0].id);
  }, [bankingImports, selectedImportId]);

  const selectedImport = useMemo(
    () => (selectedImportId === "all" ? null : bankingImports.find((x) => x.id === selectedImportId) || null),
    [bankingImports, selectedImportId],
  );

  const normalizedPath = (pathname.replace(/\/$/, "") || pathname) as string;
  const isFinanceOverviewSurface =
    normalizedPath === financeBasePath || normalizedPath === `${financeBasePath}/overview`;

  type DedicatedFinanceSlug =
    | "invoices"
    | "payments"
    | "expenses"
    | "receipts"
    | "ar"
    | "payables"
    | "banking"
    | "reports"
    | "logs";

  function dedicatedFinanceSlugFromPath(path: string): DedicatedFinanceSlug | null {
    if (path.endsWith("/finance/invoices")) return "invoices";
    if (path.endsWith("/finance/payments")) return "payments";
    if (path.endsWith("/finance/expenses")) return "expenses";
    if (path.endsWith("/finance/sales-receipts")) return "receipts";
    if (path.endsWith("/finance/receivables")) return "ar";
    if (path.endsWith("/finance/payables")) return "payables";
    if (path.endsWith("/finance/banking")) return "banking";
    if (path.endsWith("/finance/reports")) return "reports";
    if (path.endsWith("/finance/audit-logs")) return "logs";
    return null;
  }

  function openFinanceRecord(kind: "invoice" | "payment" | "expense" | "bill", id: string) {
    const path =
      kind === "invoice"
        ? `${financeBasePath}/invoices`
        : kind === "payment"
          ? `${financeBasePath}/payments`
          : kind === "expense"
            ? `${financeBasePath}/expenses`
            : `${financeBasePath}/payables`;
    router.push(`${path}?focus=${id}`);
  }

  const dedicatedSlug = dedicatedFinanceSlugFromPath(normalizedPath);

  const recordsTab = useMemo<
    "invoices" | "receipts" | "payments" | "expenses" | "logs" | "ar" | "payables" | "banking" | "reports"
  >(() => {
    if (dedicatedSlug === "invoices") return "invoices";
    if (dedicatedSlug === "receipts") return "receipts";
    if (dedicatedSlug === "payments") return "payments";
    if (dedicatedSlug === "expenses") return "expenses";
    if (dedicatedSlug === "logs") return "logs";
    if (dedicatedSlug === "ar") return "ar";
    if (dedicatedSlug === "payables") return "payables";
    if (dedicatedSlug === "banking") return "banking";
    if (dedicatedSlug === "reports") return "reports";
    const r = logFilters.recordsTab;
    if (
      r === "receipts" ||
      r === "payments" ||
      r === "expenses" ||
      r === "logs" ||
      r === "ar" ||
      r === "payables" ||
      r === "banking" ||
      r === "reports"
    )
      return r as "receipts" | "payments" | "expenses" | "logs" | "ar" | "payables" | "banking" | "reports";
    return "invoices";
  }, [dedicatedSlug, logFilters.recordsTab]);

  useEffect(() => {
    const focus = searchParams.get("focus")?.trim();
    if (!focus) return;
    setHighlightFocusId(focus);
    const timer = window.setTimeout(() => {
      const el = document.querySelector(`[data-focus-id="${focus}"]`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);
    const clearTimer = window.setTimeout(() => setHighlightFocusId(null), 6000);
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(clearTimer);
    };
  }, [searchParams, recordsTab, pathname]);

  const dedicatedHeading: Record<DedicatedFinanceSlug, { title: string; subtitle: string }> = {
    invoices: { title: "Invoices", subtitle: "Issue, send, and collect on customer invoices." },
    payments: { title: "Payments", subtitle: "Recorded invoice payments and printable receipts." },
    expenses: { title: "Expenses", subtitle: "Operational spend and reimbursements." },
    receipts: { title: "Sales receipts", subtitle: "Direct collections not tied to an invoice." },
    ar: { title: "Receivables", subtitle: "Money customers owe you — aging and follow-ups." },
    payables: { title: "Payables", subtitle: "Bills you owe vendors — record and pay." },
    banking: { title: "Banking", subtitle: "Import statements and match transactions." },
    reports: { title: "Reports", subtitle: "Profit, cash flow, and balance summaries." },
    logs: { title: "Audit logs", subtitle: "Immutable trail of finance actions." },
  };

  const pageHeading = isFinanceOverviewSurface
    ? {
        title: "Finance overview",
        subtitle:
          "Pending finance checks from sales deals. Use the sidebar for invoices, payments, audit logs, and other records.",
      }
    : dedicatedSlug
      ? dedicatedHeading[dedicatedSlug]
      : { title: "Finance", subtitle: "" };

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
      department: String(formData.get("department") || ""),
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
      department: String(formData.get("department") || ""),
      method: String(formData.get("method") || ""),
      reference: String(formData.get("reference") || ""),
      note: String(formData.get("note") || ""),
      attachmentUrl: paymentAttachment?.url,
      attachmentName: paymentAttachment?.name,
      attachmentPublicId: paymentAttachment?.publicId,
    });
    if (!result.ok) {
      showSnackbar(result.error, "error");
      setActionPending(false);
      return;
    }
    showSnackbar("Payment recorded.", "success");
    setPaymentInvoice(null);
    setPaymentAttachment(null);
    setActionPending(false);
    router.refresh();
  }

  async function uploadPaymentAttachment(file: File) {
    if (!paymentInvoice || uploadPending) return;
    setUploadPending(true);
    const sig = await getFinanceUploadSignature(tenantSlug, { fileName: file.name });
    if (!sig.ok) {
      showSnackbar(sig.error, "info");
      setUploadPending(false);
      return;
    }
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("api_key", sig.apiKey);
      form.append("timestamp", String(sig.timestamp));
      form.append("signature", sig.signature);
      form.append("folder", sig.folder);
      form.append("public_id", sig.publicId);
      form.append("resource_type", "auto");
      const response = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloudName}/auto/upload`, {
        method: "POST",
        body: form,
      });
      if (!response.ok) {
        showSnackbar("Attachment upload failed. You can continue without attachment.", "error");
        setUploadPending(false);
        return;
      }
      const payload = (await response.json()) as { secure_url?: string; original_filename?: string; public_id?: string };
      if (!payload.secure_url || !payload.public_id) {
        showSnackbar("Upload response invalid. Continue without attachment.", "error");
        setUploadPending(false);
        return;
      }
      setPaymentAttachment({
        url: payload.secure_url,
        name: payload.original_filename || file.name,
        publicId: payload.public_id,
      });
      showSnackbar("Attachment uploaded.", "success");
    } catch {
      showSnackbar("Could not upload attachment now. Continue without it.", "error");
    } finally {
      setUploadPending(false);
    }
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
      department: String(formData.get("department") || ""),
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

  async function handleCreateExpense(formData: FormData) {
    if (actionPending) return;
    setActionPending(true);
    const result = await createExpenseRecord(tenantSlug, {
      category: String(formData.get("category") || ""),
      department: String(formData.get("department") || ""),
      vendorName: String(formData.get("vendorName") || ""),
      amount: Number(formData.get("amount") || 0),
      currency: String(formData.get("currency") || "NGN"),
      expenseDate: String(formData.get("expenseDate") || ""),
      paidThroughAccount: String(formData.get("paidThroughAccount") || ""),
      reference: String(formData.get("reference") || ""),
      note: String(formData.get("note") || ""),
      attachmentUrl: expenseAttachment?.url,
      attachmentName: expenseAttachment?.name,
      attachmentPublicId: expenseAttachment?.publicId,
    });
    if (!result.ok) {
      showSnackbar(result.error, "error");
      setActionPending(false);
      return;
    }
    showSnackbar("Expense created.", "success");
    setIsCreateExpenseOpen(false);
    setExpenseAttachment(null);
    setActionPending(false);
    router.refresh();
  }

  async function handleCreateSalesReceipt(formData: FormData) {
    if (actionPending) return;
    setActionPending(true);
    const result = await createSalesReceiptRecord(tenantSlug, {
      dealId: String(formData.get("dealId") || ""),
      title: String(formData.get("title") || ""),
      customerName: String(formData.get("customerName") || ""),
      amount: Number(formData.get("amount") || 0),
      currency: String(formData.get("currency") || "NGN"),
      paymentMode: String(formData.get("paymentMode") || ""),
      depositAccount: String(formData.get("depositAccount") || ""),
      reference: String(formData.get("reference") || ""),
      note: String(formData.get("note") || ""),
    });
    if (!result.ok) {
      showSnackbar(result.error, "error");
      setActionPending(false);
      return;
    }
    showSnackbar("Sales receipt created.", "success");
    setIsCreateReceiptOpen(false);
    setActionPending(false);
    router.refresh();
  }

  async function uploadExpenseAttachment(file: File) {
    if (uploadPending) return;
    setUploadPending(true);
    const sig = await getFinanceUploadSignature(tenantSlug, { fileName: file.name });
    if (!sig.ok) {
      showSnackbar(sig.error, "info");
      setUploadPending(false);
      return;
    }
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("api_key", sig.apiKey);
      form.append("timestamp", String(sig.timestamp));
      form.append("signature", sig.signature);
      form.append("folder", sig.folder);
      form.append("public_id", sig.publicId);
      form.append("resource_type", "auto");
      const response = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloudName}/auto/upload`, {
        method: "POST",
        body: form,
      });
      if (!response.ok) {
        showSnackbar("Attachment upload failed. You can continue without attachment.", "error");
        setUploadPending(false);
        return;
      }
      const payload = (await response.json()) as { secure_url?: string; original_filename?: string; public_id?: string };
      if (!payload.secure_url || !payload.public_id) {
        showSnackbar("Upload response invalid. Continue without attachment.", "error");
        setUploadPending(false);
        return;
      }
      setExpenseAttachment({
        url: payload.secure_url,
        name: payload.original_filename || file.name,
        publicId: payload.public_id,
      });
      showSnackbar("Attachment uploaded.", "success");
    } catch {
      showSnackbar("Could not upload attachment now. Continue without it.", "error");
    } finally {
      setUploadPending(false);
    }
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

  async function handleBulkReminders() {
    if (actionPending) return;
    setActionPending(true);
    const result = await sendBulkOverdueReminders(tenantSlug);
    if (!result.ok) {
      showSnackbar(result.error, "error");
      setActionPending(false);
      return;
    }
    showSnackbar(`Sent ${result.sent} reminder(s). Skipped ${result.skipped}.`, "success");
    setActionPending(false);
    router.refresh();
  }

  async function handleCreateBill(formData: FormData) {
    if (actionPending) return;
    setActionPending(true);
    const result = await createVendorBill(tenantSlug, {
      vendorName: String(formData.get("vendorName") || ""),
      title: String(formData.get("title") || ""),
      amount: Number(formData.get("amount") || 0),
      currency: String(formData.get("currency") || reportView.currency),
      dueDate: String(formData.get("dueDate") || "") || undefined,
      department: String(formData.get("department") || "") || undefined,
      note: String(formData.get("note") || "") || undefined,
    });
    if (!result.ok) {
      showSnackbar(result.error, "error");
      setActionPending(false);
      return;
    }
    showSnackbar("Bill recorded.", "success");
    setIsCreateBillOpen(false);
    setActionPending(false);
    router.refresh();
  }

  async function handleRecordBillPayment(formData: FormData) {
    if (actionPending || !paymentBill) return;
    setActionPending(true);
    const result = await recordVendorBillPayment(tenantSlug, paymentBill.id, {
      amount: Number(formData.get("amount") || 0),
      paidAt: String(formData.get("paidAt") || ""),
      method: String(formData.get("method") || "") || undefined,
      reference: String(formData.get("reference") || "") || undefined,
      paidThroughAccount: String(formData.get("paidThroughAccount") || "") || undefined,
    });
    if (!result.ok) {
      showSnackbar(result.error, "error");
      setActionPending(false);
      return;
    }
    showSnackbar("Bill payment recorded.", "success");
    setPaymentBill(null);
    setActionPending(false);
    router.refresh();
  }

  async function handleVoidBill(bill: VendorBillRow) {
    if (actionPending || !bill.canVoid) return;
    setActionPending(true);
    const result = await voidVendorBill(tenantSlug, bill.id);
    if (!result.ok) {
      showSnackbar(result.error, "error");
      setActionPending(false);
      return;
    }
    showSnackbar("Bill voided.", "success");
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

  async function handleBankCsvUpload(file: File) {
    const text = await file.text();
    const lines = text
      .split(/\r?\n/g)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 2) {
      showSnackbar("CSV looks empty. Add header + rows and try again.", "error");
      return;
    }

    const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, "").replace(/_/g, ""));
    const idxMap: Record<string, number> = {};
    header.forEach((h, idx) => {
      idxMap[h] = idx;
    });

    const parsed: ImportedBankRow[] = [];
    for (let i = 1; i < lines.length; i += 1) {
      const cols = splitCsvLine(lines[i]);
      const date = csvCell(cols, idxMap, ["date", "valuedate", "transactiondate"]);
      const description = csvCell(cols, idxMap, ["description", "narration", "details", "memo"]);
      const reference = csvCell(cols, idxMap, ["reference", "ref", "transactionref"]);
      const debitRaw = csvCell(cols, idxMap, ["debit", "withdrawal", "moneyout"]);
      const creditRaw = csvCell(cols, idxMap, ["credit", "deposit", "moneyin"]);
      const amountRaw = csvCell(cols, idxMap, ["amount"]);

      let debit = parseMoneyCell(debitRaw);
      let credit = parseMoneyCell(creditRaw);
      if (!debit && !credit && amountRaw) {
        const raw = parseMoneyCell(amountRaw);
        if (raw < 0) debit = Math.abs(raw);
        else credit = Math.abs(raw);
      }
      if (!debit && !credit) continue;

      const direction: "debit" | "credit" = debit > 0 ? "debit" : "credit";
      const amountAbs = debit > 0 ? debit : credit;
      parsed.push({
        id: `row-${i}`,
        date,
        description,
        reference,
        debit,
        credit,
        amountAbs,
        direction,
      });
    }

    if (parsed.length === 0) {
      showSnackbar("No usable rows found. Expected amount/debit/credit columns.", "error");
      return;
    }
    const result = await importBankStatementRows(tenantSlug, {
      sourceName: file.name,
      rows: parsed.map((row) => ({
        date: row.date,
        description: row.description,
        reference: row.reference,
        debit: row.debit,
        credit: row.credit,
        amountAbs: row.amountAbs,
        direction: row.direction,
      })),
    });
    if (!result.ok) {
      showSnackbar(result.error, "error");
      return;
    }
    setImportedBankRows(result.rows);
    setBankImportName(file.name);
    showSnackbar(`Imported ${result.rows.length} statement row(s).`, "success");
    router.refresh();
  }

  function suggestMatch(row: ImportedBankRow): BankMatch | null {
    if (row.matchStatus === "MATCHED") return null;
    const refNeedle = `${row.reference} ${row.description}`.toLowerCase();
    const dateMs = row.date ? new Date(row.date).getTime() : NaN;

    const candidates: BankMatch[] =
      row.direction === "credit"
        ? payments.map((p) => {
            const amountDiff = Math.abs(p.amountValue - row.amountAbs);
            const paymentDateMs = p.paidAtValue ? new Date(p.paidAtValue).getTime() : NaN;
            const dateDiffDays =
              Number.isFinite(dateMs) && Number.isFinite(paymentDateMs)
                ? Math.abs(dateMs - paymentDateMs) / (1000 * 60 * 60 * 24)
                : 99;
            const referenceHit =
              p.referenceRaw && refNeedle.includes(p.referenceRaw.toLowerCase()) ? 1 : 0;
            const score = amountDiff + dateDiffDays * 0.2 - referenceHit * 3;
            return {
              kind: "payment" as const,
              id: p.id,
              label: p.invoiceLabel,
              amount: p.amountValue,
              date: p.paidAtValue,
              score,
            };
          })
        : expenses.map((e) => {
            const amountDiff = Math.abs(e.amountValue - row.amountAbs);
            const expenseDateMs = e.expenseDateValue ? new Date(e.expenseDateValue).getTime() : NaN;
            const dateDiffDays =
              Number.isFinite(dateMs) && Number.isFinite(expenseDateMs)
                ? Math.abs(dateMs - expenseDateMs) / (1000 * 60 * 60 * 24)
                : 99;
            const referenceHit =
              e.referenceRaw && refNeedle.includes(e.referenceRaw.toLowerCase()) ? 1 : 0;
            const score = amountDiff + dateDiffDays * 0.2 - referenceHit * 3;
            return {
              kind: "expense" as const,
              id: e.id,
              label: `${e.category} ${e.vendorName !== "—" ? `- ${e.vendorName}` : ""}`,
              amount: e.amountValue,
              date: e.expenseDateValue,
              score,
            };
          });

    if (candidates.length === 0) return null;
    candidates.sort((a, b) => a.score - b.score);
    const best = candidates[0];
    const strictAmountDiff = Math.abs(best.amount - row.amountAbs);
    if (strictAmountDiff > 0.01) return null;
    return best;
  }

  function manualCandidates(row: ImportedBankRow): BankMatch[] {
    const dateMs = row.date ? new Date(row.date).getTime() : NaN;
    const candidates: BankMatch[] =
      row.direction === "credit"
        ? payments.map((p) => {
            const amountDiff = Math.abs(p.amountValue - row.amountAbs);
            const paymentDateMs = p.paidAtValue ? new Date(p.paidAtValue).getTime() : NaN;
            const dateDiffDays =
              Number.isFinite(dateMs) && Number.isFinite(paymentDateMs)
                ? Math.abs(dateMs - paymentDateMs) / (1000 * 60 * 60 * 24)
                : 99;
            return {
              kind: "payment" as const,
              id: p.id,
              label: p.invoiceLabel,
              amount: p.amountValue,
              date: p.paidAtValue,
              score: amountDiff + dateDiffDays * 0.2,
            };
          })
        : expenses.map((e) => {
            const amountDiff = Math.abs(e.amountValue - row.amountAbs);
            const expenseDateMs = e.expenseDateValue ? new Date(e.expenseDateValue).getTime() : NaN;
            const dateDiffDays =
              Number.isFinite(dateMs) && Number.isFinite(expenseDateMs)
                ? Math.abs(dateMs - expenseDateMs) / (1000 * 60 * 60 * 24)
                : 99;
            return {
              kind: "expense" as const,
              id: e.id,
              label: `${e.category} ${e.vendorName !== "—" ? `- ${e.vendorName}` : ""}`,
              amount: e.amountValue,
              date: e.expenseDateValue,
              score: amountDiff + dateDiffDays * 0.2,
            };
          });
    return candidates.sort((a, b) => a.score - b.score).slice(0, 20);
  }

  function includesDateRange(rowDate: string, filter: BankingDateFilter) {
    if (filter === "all") return true;
    if (!rowDate) return false;
    const row = new Date(`${rowDate}T00:00:00`);
    if (Number.isNaN(row.getTime())) return false;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (filter === "today") return row.getTime() >= todayStart.getTime();
    if (filter === "7d") {
      const sevenDaysAgo = new Date(todayStart);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
      return row.getTime() >= sevenDaysAgo.getTime();
    }
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return row.getTime() >= monthStart.getTime();
  }

  function csvEscape(value: string | number | null | undefined) {
    const raw = value == null ? "" : String(value);
    if (!/[",\n]/.test(raw)) return raw;
    return `"${raw.replace(/"/g, "\"\"")}"`;
  }

  function exportReportCsv(kind: "pnl" | "cashflow" | "expenses" | "balance") {
    const toMoney = (n: number) => Number.isFinite(n) ? n : 0;
    if (kind === "pnl") {
      const lines = [
        [csvEscape("company"), csvEscape(reportView.companyName)].join(","),
        [csvEscape("generatedAt"), csvEscape(reportView.generatedAtLabel)].join(","),
        [csvEscape("windowMonths"), csvEscape(reportMonthWindow)].join(","),
        "",
        ["month", "invoiced", "collected", "expenses", "net"].join(","),
        ...visiblePnlBreakdown.map((row) =>
          [row.month, toMoney(row.invoiced), toMoney(row.collected), toMoney(row.expenses), toMoney(row.net)]
            .map((x) => csvEscape(x))
            .join(","),
        ),
      ];
      const blob = new Blob([`${lines.join("\n")}\n`], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `finance-pnl-${reportMonthWindow}m-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }
    if (kind === "cashflow") {
      const lines = [
        [csvEscape("company"), csvEscape(reportView.companyName)].join(","),
        [csvEscape("generatedAt"), csvEscape(reportView.generatedAtLabel)].join(","),
        [csvEscape("windowMonths"), csvEscape(reportMonthWindow)].join(","),
        "",
        ["month", "inflow", "outflow", "net"].join(","),
        ...visibleCashflowBreakdown.map((row) =>
          [row.month, toMoney(row.inflow), toMoney(row.outflow), toMoney(row.net)].map((x) => csvEscape(x)).join(","),
        ),
      ];
      const blob = new Blob([`${lines.join("\n")}\n`], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `finance-cashflow-${reportMonthWindow}m-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }
    if (kind === "balance") {
      const sectionRows = [
        ...balanceSheetSections.assets.map((line) => ["What you own", line.label, toMoney(line.amount)]),
        ...balanceSheetSections.liabilities.map((line) => ["What you owe", line.label, toMoney(line.amount)]),
        ...balanceSheetSections.equity.map((line) => ["Owner position", line.label, toMoney(line.amount)]),
      ];
      const lines = [
        [csvEscape("company"), csvEscape(reportView.companyName)].join(","),
        [csvEscape("generatedAt"), csvEscape(reportView.generatedAtLabel)].join(","),
        "",
        ["section", "line", "amount"].join(","),
        ...sectionRows.map((row) => row.map((x) => csvEscape(x)).join(",")),
      ];
      const blob = new Blob([`${lines.join("\n")}\n`], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `finance-balance-sheet-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }
    const lines = [
      [csvEscape("company"), csvEscape(reportView.companyName)].join(","),
      [csvEscape("generatedAt"), csvEscape(reportView.generatedAtLabel)].join(","),
      "",
      ["category", "count", "total"].join(","),
      ...visibleExpenseBreakdown.map((row) => [row.category, row.count, toMoney(row.total)].map((x) => csvEscape(x)).join(",")),
    ];
    const blob = new Blob([`${lines.join("\n")}\n`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `finance-expense-breakdown-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportReportPack() {
    exportReportCsv("pnl");
    setTimeout(() => exportReportCsv("cashflow"), 250);
    setTimeout(() => exportReportCsv("expenses"), 500);
    setTimeout(() => exportReportCsv("balance"), 750);
  }

  const scopedBankRows = useMemo(() => {
    let rows = importedBankRows;
    if (selectedImportId !== "all") rows = rows.filter((r) => r.importId === selectedImportId);
    rows = rows.filter((r) => includesDateRange(r.date, bankDateFilter));
    return rows;
  }, [importedBankRows, selectedImportId, bankDateFilter]);

  const visibleBankRows = useMemo(() => {
    let rows = scopedBankRows;
    if (showUnmatchedOnly) rows = rows.filter((r) => r.matchStatus !== "MATCHED");
    if (bankStatusFilter === "matched") rows = rows.filter((r) => r.matchStatus === "MATCHED");
    if (bankStatusFilter === "unmatched") rows = rows.filter((r) => r.matchStatus === "UNMATCHED" || !r.matchStatus);
    if (bankStatusFilter === "exception") rows = rows.filter((r) => r.matchStatus === "EXCEPTION");
    if (exceptionReasonFilter !== "all") {
      rows = rows.filter((r) => r.matchStatus === "EXCEPTION" && (r.exceptionReason || "OTHER") === exceptionReasonFilter);
    }
    return rows;
  }, [scopedBankRows, showUnmatchedOnly, bankStatusFilter, exceptionReasonFilter]);

  const reportProjectOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const x of invoices) if (x.projectId) map.set(x.projectId, x.projectLabel);
    for (const x of payments) if (x.projectId) map.set(x.projectId, x.projectLabel);
    for (const x of expenses) if (x.projectId) map.set(x.projectId, x.projectLabel);
    return Array.from(map.entries()).map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [invoices, payments, expenses]);
  const reportUnitOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const x of invoices) if (x.unitId) map.set(x.unitId, x.unitLabel);
    for (const x of payments) if (x.unitId) map.set(x.unitId, x.unitLabel);
    for (const x of expenses) if (x.unitId) map.set(x.unitId, x.unitLabel);
    return Array.from(map.entries()).map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [invoices, payments, expenses]);
  const reportDepartmentOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...financeOptions.departments,
          ...invoices.map((x) => x.department),
          ...payments.map((x) => x.department),
          ...expenses.map((x) => x.department),
        ].filter(Boolean)),
      )
        .sort((a, b) => a.localeCompare(b)),
    [financeOptions.departments, invoices, payments, expenses],
  );

  const filteredInvoices = useMemo(
    () =>
      invoices.filter((x) => {
        if (reportProjectFilter !== "all" && x.projectId !== reportProjectFilter) return false;
        if (reportUnitFilter !== "all" && x.unitId !== reportUnitFilter) return false;
        if (reportDepartmentFilter !== "all" && x.department !== reportDepartmentFilter) return false;
        return true;
      }),
    [invoices, reportProjectFilter, reportUnitFilter, reportDepartmentFilter],
  );
  const filteredPayments = useMemo(
    () =>
      payments.filter((x) => {
        if (reportProjectFilter !== "all" && x.projectId !== reportProjectFilter) return false;
        if (reportUnitFilter !== "all" && x.unitId !== reportUnitFilter) return false;
        if (reportDepartmentFilter !== "all" && x.department !== reportDepartmentFilter) return false;
        return true;
      }),
    [payments, reportProjectFilter, reportUnitFilter, reportDepartmentFilter],
  );
  const filteredExpenses = useMemo(
    () =>
      expenses.filter((x) => {
        if (reportProjectFilter !== "all" && x.projectId !== reportProjectFilter) return false;
        if (reportUnitFilter !== "all" && x.unitId !== reportUnitFilter) return false;
        if (reportDepartmentFilter !== "all" && x.department !== reportDepartmentFilter) return false;
        return true;
      }),
    [expenses, reportProjectFilter, reportUnitFilter, reportDepartmentFilter],
  );

  const visiblePnlBreakdown = useMemo(() => {
    const keys = reportView.pnlBreakdown.map((x) => x.month).slice(-reportMonthWindow);
    const rows = keys.map((month) => ({ month, invoiced: 0, collected: 0, expenses: 0, net: 0 }));
    const index = new Map(rows.map((x, i) => [x.month, i]));
    const monthFmt = new Intl.DateTimeFormat("en-NG", { month: "short", year: "numeric" });
    for (const x of filteredInvoices) {
      const key = monthFmt.format(new Date(`${x.issuedAtValue}T00:00:00`));
      const i = index.get(key);
      if (i !== undefined && x.statusValue !== "VOID") rows[i].invoiced += x.amountValue;
    }
    for (const x of filteredPayments) {
      const key = monthFmt.format(new Date(`${x.paidAtValue}T00:00:00`));
      const i = index.get(key);
      if (i !== undefined) rows[i].collected += x.amountValue;
    }
    for (const x of filteredExpenses) {
      const key = monthFmt.format(new Date(`${x.expenseDateValue}T00:00:00`));
      const i = index.get(key);
      if (i !== undefined) rows[i].expenses += x.amountValue;
    }
    return rows.map((r) => ({ ...r, net: r.collected - r.expenses }));
  }, [reportView.pnlBreakdown, reportMonthWindow, filteredInvoices, filteredPayments, filteredExpenses]);
  const visibleCashflowBreakdown = useMemo(
    () => visiblePnlBreakdown.map((x) => ({ month: x.month, inflow: x.collected, outflow: x.expenses, net: x.collected - x.expenses })),
    [visiblePnlBreakdown],
  );
  const visibleExpenseBreakdown = useMemo(
    () =>
      Array.from(
        filteredExpenses.reduce((acc, row) => {
          const current = acc.get(row.category) || { category: row.category, total: 0, count: 0 };
          current.total += row.amountValue;
          current.count += 1;
          acc.set(row.category, current);
          return acc;
        }, new Map<string, { category: string; total: number; count: number }>()),
      )
        .map(([, v]) => v)
        .sort((a, b) => b.total - a.total),
    [filteredExpenses],
  );
  const reportMonthLabel = useMemo(() => new Intl.DateTimeFormat("en-NG", { month: "short", year: "numeric" }), []);
  const reportDrilldown = useMemo(() => {
    if (!reportDrilldownMonth) return null;
    const invoicesForMonth = filteredInvoices.filter((x) => reportMonthLabel.format(new Date(`${x.issuedAtValue}T00:00:00`)) === reportDrilldownMonth);
    const paymentsForMonth = filteredPayments.filter((x) => reportMonthLabel.format(new Date(`${x.paidAtValue}T00:00:00`)) === reportDrilldownMonth);
    const expensesForMonth = filteredExpenses.filter((x) => reportMonthLabel.format(new Date(`${x.expenseDateValue}T00:00:00`)) === reportDrilldownMonth);
    const totals = {
      invoices: invoicesForMonth.reduce((sum, x) => sum + x.amountValue, 0),
      payments: paymentsForMonth.reduce((sum, x) => sum + x.amountValue, 0),
      expenses: expensesForMonth.reduce((sum, x) => sum + x.amountValue, 0),
    };
    return {
      month: reportDrilldownMonth,
      invoices: invoicesForMonth,
      payments: paymentsForMonth,
      expenses: expensesForMonth,
      totals,
    };
  }, [reportDrilldownMonth, filteredInvoices, filteredPayments, filteredExpenses, reportMonthLabel]);
  const filteredBalanceSnapshot = useMemo(() => {
    const receivables = filteredInvoices
      .filter((x) => x.statusValue !== "VOID" && x.statusValue !== "PAID")
      .reduce((sum, x) => sum + x.balanceValue, 0);
    const overdueReceivables = filteredInvoices
      .filter((x) => x.isOverdue && x.statusValue !== "VOID" && x.statusValue !== "PAID")
      .reduce((sum, x) => sum + x.balanceValue, 0);
    const cashIn = filteredPayments.reduce((sum, x) => sum + x.amountValue, 0);
    const cashOut = filteredExpenses.reduce((sum, x) => sum + x.amountValue, 0);
    return { receivables, overdueReceivables, cashIn, cashOut, netCashflow: cashIn - cashOut };
  }, [filteredInvoices, filteredPayments, filteredExpenses]);
  const reportComparison = useMemo(() => {
    const now = new Date();
    const currentEnd = shiftMonthBoundary(now, 1);
    const currentStart = shiftMonthBoundary(currentEnd, -reportMonthWindow);
    const comparisonEnd =
      reportCompareMode === "previous_period" ? currentStart : shiftMonthBoundary(currentEnd, -12);
    const comparisonStart = shiftMonthBoundary(comparisonEnd, -reportMonthWindow);

    const inRange = (dateStr: string, start: Date, endExclusive: Date) => {
      if (!dateStr) return false;
      const d = new Date(`${dateStr}T00:00:00`);
      const t = d.getTime();
      return Number.isFinite(t) && t >= start.getTime() && t < endExclusive.getTime();
    };

    const current = {
      invoiced: filteredInvoices
        .filter((x) => x.statusValue !== "VOID" && inRange(x.issuedAtValue, currentStart, currentEnd))
        .reduce((sum, x) => sum + x.amountValue, 0),
      collected: filteredPayments.filter((x) => inRange(x.paidAtValue, currentStart, currentEnd)).reduce((sum, x) => sum + x.amountValue, 0),
      expenses: filteredExpenses.filter((x) => inRange(x.expenseDateValue, currentStart, currentEnd)).reduce((sum, x) => sum + x.amountValue, 0),
    };
    const previous = {
      invoiced: filteredInvoices
        .filter((x) => x.statusValue !== "VOID" && inRange(x.issuedAtValue, comparisonStart, comparisonEnd))
        .reduce((sum, x) => sum + x.amountValue, 0),
      collected: filteredPayments.filter((x) => inRange(x.paidAtValue, comparisonStart, comparisonEnd)).reduce((sum, x) => sum + x.amountValue, 0),
      expenses: filteredExpenses.filter((x) => inRange(x.expenseDateValue, comparisonStart, comparisonEnd)).reduce((sum, x) => sum + x.amountValue, 0),
    };
    return {
      current: { ...current, net: current.collected - current.expenses },
      previous: { ...previous, net: previous.collected - previous.expenses },
    };
  }, [filteredInvoices, filteredPayments, filteredExpenses, reportMonthWindow, reportCompareMode]);
  const reportComparisonCards = useMemo(() => {
    const rows = [
      { id: "invoiced", label: "Invoiced", current: reportComparison.current.invoiced, previous: reportComparison.previous.invoiced },
      { id: "collected", label: "Collected", current: reportComparison.current.collected, previous: reportComparison.previous.collected },
      { id: "expenses", label: "Expenses", current: reportComparison.current.expenses, previous: reportComparison.previous.expenses },
      { id: "net", label: "Money left", current: reportComparison.current.net, previous: reportComparison.previous.net },
    ];
    return rows.map((row) => {
      const change = row.current - row.previous;
      const changePct = row.previous !== 0 ? (change / row.previous) * 100 : null;
      return { ...row, change, changePct };
    });
  }, [reportComparison]);

  const openPayablesTotal = useMemo(
    () =>
      vendorBills
        .filter((x) => x.statusValue !== "VOID" && x.statusValue !== "PAID")
        .reduce((sum, x) => sum + x.balanceValue, 0),
    [vendorBills],
  );

  const balanceSheetSections = useMemo(() => {
    const assetsTotal =
      filteredBalanceSnapshot.receivables + filteredBalanceSnapshot.cashIn;
    const liabilitiesTotal = openPayablesTotal;
    const equityTotal = assetsTotal - liabilitiesTotal;
    return {
      assets: [
        { label: "Customer balances owed to you", amount: filteredBalanceSnapshot.receivables, sub: false },
        { label: "Overdue customer balances", amount: filteredBalanceSnapshot.overdueReceivables, sub: true },
        { label: "Cash collected (filtered period)", amount: filteredBalanceSnapshot.cashIn, sub: false },
      ] as Array<{ label: string; amount: number; sub?: boolean }>,
      liabilities: [{ label: "Unpaid vendor bills", amount: liabilitiesTotal }],
      equity: [{ label: "What is left for the business", amount: equityTotal }],
      assetsTotal,
      liabilitiesTotal,
      equityTotal,
    };
  }, [filteredBalanceSnapshot, openPayablesTotal]);

  const payablesAging = useMemo(() => {
    const buckets = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0, noDueDate: 0 };
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    for (const bill of vendorBills) {
      if (bill.statusValue === "VOID" || bill.statusValue === "PAID" || bill.balanceValue <= 0) continue;
      if (!bill.dueDateValue) {
        buckets.noDueDate += bill.balanceValue;
        continue;
      }
      const due = new Date(`${bill.dueDateValue}T00:00:00`);
      const days = Math.floor((startOfToday.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
      if (days <= 0) buckets.current += bill.balanceValue;
      else if (days <= 30) buckets.d1_30 += bill.balanceValue;
      else if (days <= 60) buckets.d31_60 += bill.balanceValue;
      else if (days <= 90) buckets.d61_90 += bill.balanceValue;
      else buckets.d90_plus += bill.balanceValue;
    }
    return buckets;
  }, [vendorBills]);

  const bankingMetrics = useMemo(() => {
    const total = scopedBankRows.length;
    const matched = scopedBankRows.filter((r) => r.matchStatus === "MATCHED").length;
    const unmatchedRows = scopedBankRows.filter((r) => r.matchStatus !== "MATCHED");
    const unmatched = unmatchedRows.length;
    const unmatchedAmount = unmatchedRows.reduce((sum, r) => sum + (Number.isFinite(r.amountAbs) ? r.amountAbs : 0), 0);
    let oldestUnmatchedDays = 0;
    const nowMs = Date.now();
    for (const row of unmatchedRows) {
      if (!row.date) continue;
      const rowMs = new Date(`${row.date}T00:00:00`).getTime();
      if (Number.isNaN(rowMs)) continue;
      const days = Math.floor((nowMs - rowMs) / (1000 * 60 * 60 * 24));
      if (days > oldestUnmatchedDays) oldestUnmatchedDays = days;
    }
    return {
      total,
      matched,
      unmatched,
      matchRate: total > 0 ? (matched / total) * 100 : 0,
      unmatchedAmount,
      oldestUnmatchedDays,
    };
  }, [scopedBankRows]);

  async function handleMarkMatched(row: ImportedBankRow, match: BankMatch) {
    if (row.importIsFinalized) {
      showSnackbar("This batch is finalized and locked.", "info");
      return;
    }
    const result = await markBankStatementRowMatched(tenantSlug, row.id, {
      kind: match.kind,
      entityId: match.id,
    });
    if (!result.ok) {
      showSnackbar(result.error, "error");
      return;
    }
    showSnackbar("Statement row marked as matched.", "success");
    setImportedBankRows((curr) =>
      curr.map((r) =>
        r.id === row.id
          ? {
              ...r,
              matchStatus: "MATCHED",
              matchedEntityType: match.kind === "payment" ? "PAYMENT" : "EXPENSE",
              matchedEntityId: match.id,
              exceptionReason: null,
            }
          : r,
      ),
    );
    router.refresh();
  }

  async function handleUnmatchRow(row: ImportedBankRow) {
    if (row.importIsFinalized) {
      showSnackbar("This batch is finalized and locked.", "info");
      return;
    }
    const result = await unmatchBankStatementRow(tenantSlug, row.id);
    if (!result.ok) {
      showSnackbar(result.error, "error");
      return;
    }
    showSnackbar("Statement row unmatched.", "success");
    setImportedBankRows((curr) =>
      curr.map((r) =>
        r.id === row.id
          ? { ...r, matchStatus: "UNMATCHED", matchedEntityType: null, matchedEntityId: null, exceptionReason: null }
          : r,
      ),
    );
    router.refresh();
  }

  async function handleAutoMatchVisibleRows() {
    if (autoMatching) return;
    const proposals = visibleBankRows
      .filter((row) => row.matchStatus !== "MATCHED" && !row.importIsFinalized)
      .map((row) => {
        const match = suggestMatch(row);
        if (!match) return null;
        return { rowId: row.id, kind: match.kind, entityId: match.id };
      })
      .filter((x): x is { rowId: string; kind: "payment" | "expense"; entityId: string } => Boolean(x));

    if (proposals.length === 0) {
      showSnackbar("No safe auto-match candidates in the current view.", "info");
      return;
    }

    setAutoMatching(true);
    const result = await autoMatchBankStatementRows(tenantSlug, proposals);
    setAutoMatching(false);
    if (!result.ok) {
      showSnackbar(result.error, "error");
      return;
    }

    showSnackbar(
      `Auto-match complete: ${result.matched} matched, ${result.skipped} skipped, ${result.failed} failed.`,
      result.failed > 0 ? "info" : "success",
    );
    if (result.matched > 0) {
      const matchedIds = new Set(result.details.filter((d) => d.status === "matched").map((d) => d.rowId));
      setImportedBankRows((curr) =>
        curr.map((r) =>
          matchedIds.has(r.id)
            ? { ...r, matchStatus: "MATCHED", matchedEntityType: r.direction === "credit" ? "PAYMENT" : "EXPENSE", exceptionReason: null }
            : r,
        ),
      );
    }
    router.refresh();
  }

  async function handleMarkException(row: ImportedBankRow) {
    if (row.importIsFinalized) {
      showSnackbar("This batch is finalized and locked.", "info");
      return;
    }
    const reasonCode = (exceptionReasonDrafts[row.id] ?? row.exceptionReason ?? "OTHER").trim() || "OTHER";
    const note = (noteDrafts[row.id] ?? row.reconciliationNote ?? "").trim();
    const result = await markBankStatementRowException(tenantSlug, row.id, reasonCode, note);
    if (!result.ok) {
      showSnackbar(result.error, "error");
      return;
    }
    showSnackbar("Row moved to exceptions.", "success");
    setImportedBankRows((curr) =>
      curr.map((r) =>
        r.id === row.id
          ? {
              ...r,
              matchStatus: "EXCEPTION",
              matchedEntityType: null,
              matchedEntityId: null,
              exceptionReason: reasonCode,
              reconciliationNote: note,
            }
          : r,
      ),
    );
    router.refresh();
  }

  function downloadBankCsvTemplate() {
    const rows = [
      "date,description,reference,debit,credit,amount,direction",
      "2026-04-20,Transfer from customer,TRX-9001,0,120000,120000,credit",
      "2026-04-21,POS settlement,POS-2211,35000,0,35000,debit",
    ];
    const csv = `${rows.join("\n")}\n`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bank-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleSaveRowNote(row: ImportedBankRow) {
    if (row.importIsFinalized) {
      showSnackbar("This batch is finalized and locked.", "info");
      return;
    }
    const note = (noteDrafts[row.id] ?? "").trim();
    const result = await saveBankStatementRowNote(tenantSlug, row.id, note);
    if (!result.ok) {
      showSnackbar(result.error, "error");
      return;
    }
    showSnackbar("Reconciliation note saved.", "success");
    setImportedBankRows((curr) => curr.map((r) => (r.id === row.id ? { ...r, reconciliationNote: note } : r)));
    setNoteDrafts((curr) => ({ ...curr, [row.id]: note }));
    router.refresh();
  }

  async function handleFinalizeSelectedImport() {
    if (!selectedImport || selectedImport.finalized) return;
    setFinalizingImportId(selectedImport.id);
    const result = await finalizeBankStatementImport(tenantSlug, selectedImport.id);
    setFinalizingImportId(null);
    if (!result.ok) {
      showSnackbar(result.error, "error");
      return;
    }
    showSnackbar("Import batch finalized and locked.", "success");
    router.refresh();
  }

  function handleExportVisibleBankRows() {
    if (visibleBankRows.length === 0) {
      showSnackbar("No rows in current view to export.", "info");
      return;
    }

    const header = [
      "importSource",
      "importedAt",
      "date",
      "description",
      "reference",
      "direction",
      "amountAbs",
      "debit",
      "credit",
      "status",
      "matchedEntityType",
      "matchedEntityId",
      "exceptionReason",
      "reconciliationNote",
      "batchFinalized",
      "suggestedMatchKind",
      "suggestedMatchId",
      "suggestedMatchLabel",
    ];

    const lines = [header.join(",")];
    for (const row of visibleBankRows) {
      const suggested = row.matchStatus === "MATCHED" ? null : suggestMatch(row);
      lines.push(
        [
          row.importSourceName || "",
          row.importImportedAt || "",
          row.date || "",
          row.description || "",
          row.reference || "",
          row.direction,
          row.amountAbs,
          row.debit,
          row.credit,
          row.matchStatus || "UNMATCHED",
          row.matchedEntityType || "",
          row.matchedEntityId || "",
          row.exceptionReason || "",
          row.reconciliationNote || "",
          row.importIsFinalized ? "yes" : "no",
          suggested?.kind || "",
          suggested?.id || "",
          suggested?.label || "",
        ]
          .map((x) => csvEscape(x))
          .join(","),
      );
    }

    const csv = `${lines.join("\n")}\n`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const now = new Date().toISOString().slice(0, 10);
    const scope = selectedImportId === "all" ? "all-imports" : selectedImportId.slice(0, 8);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bank-reconciliation-export-${scope}-${now}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-6 sm:py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{pageHeading.title}</h1>
          <p className="mt-1 text-sm text-muted">{pageHeading.subtitle}</p>
        </div>
      </div>

      {!canManageFinance && isFinanceOverviewSurface ? (
        <div className="mt-6 rounded-lg border border-foreground/10 bg-foreground/[0.02] p-4 text-sm text-muted">
          You can view this queue, but only Org Admin and Finance Manager can approve or reject items.
        </div>
      ) : null}

      {isFinanceOverviewSurface ? (
        <>
          <section className="mt-6 rounded-lg border border-foreground/10 bg-background">
            <header className="border-b border-foreground/10 bg-foreground/[0.02] px-4 py-3">
              <h2 className="text-sm font-semibold text-foreground">Pending finance checks</h2>
            </header>
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
          </section>

          <section className="mt-6 rounded-lg border border-foreground/10 bg-background">
            <header className="border-b border-foreground/10 bg-foreground/[0.02] px-4 py-3">
              <h2 className="text-sm font-semibold text-foreground">Recent finance decisions</h2>
              <p className="mt-0.5 text-xs text-muted">Latest approvals and rejections. Full history lives under Audit Logs.</p>
            </header>
            {recentDecisions.length === 0 ? (
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
            )}
            <div className="border-t border-foreground/10 px-4 py-3">
              <Link
                href={`/${tenantSlug}/finance/audit-logs`}
                className="text-sm font-semibold text-foreground underline decoration-foreground/25 underline-offset-2 hover:decoration-foreground/50"
              >
                View full audit log →
              </Link>
            </div>
          </section>
        </>
      ) : dedicatedSlug ? (
          <section className="mt-6 rounded-lg border border-foreground/10 bg-background">
          <div className="p-4">
            <div className="mb-3 flex items-center justify-end">
              {canManageFinance ? (
                <div className="flex items-center gap-2">
                  {recordsTab === "expenses" ? (
                    <button
                      type="button"
                      onClick={() => {
                        setExpenseAttachment(null);
                        setIsCreateExpenseOpen(true);
                      }}
                      className="rounded-md border border-foreground bg-foreground px-3 py-1.5 text-xs font-semibold text-background transition-opacity hover:opacity-90"
                    >
                      New expense
                    </button>
                  ) : recordsTab === "receipts" ? (
                    <button
                      type="button"
                      onClick={() => setIsCreateReceiptOpen(true)}
                      className="rounded-md border border-foreground bg-foreground px-3 py-1.5 text-xs font-semibold text-background transition-opacity hover:opacity-90"
                    >
                      New sales receipt
                    </button>
                  ) : recordsTab === "invoices" ? (
                    <button
                      type="button"
                      onClick={() => setIsCreateInvoiceOpen(true)}
                      className="rounded-md border border-foreground bg-foreground px-3 py-1.5 text-xs font-semibold text-background transition-opacity hover:opacity-90"
                    >
                      New invoice
                    </button>
                  ) : recordsTab === "payables" ? (
                    <button
                      type="button"
                      onClick={() => setIsCreateBillOpen(true)}
                      className="rounded-md border border-foreground bg-foreground px-3 py-1.5 text-xs font-semibold text-background transition-opacity hover:opacity-90"
                    >
                      New bill
                    </button>
                  ) : null}
                </div>
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
                      <tr key={invoice.id} data-focus-id={invoice.id} className={rowFocusClass(highlightFocusId, invoice.id)}>
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
                                onClick={() => {
                                  setPaymentAttachment(null);
                                  setPaymentInvoice(invoice);
                                }}
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
            ) : recordsTab === "receipts" ? (
              salesReceipts.length === 0 ? (
                <p className="text-sm text-muted">No sales receipts yet.</p>
              ) : (
                <div className="overflow-hidden rounded-lg border border-foreground/10">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-foreground/[0.03] text-xs uppercase tracking-wide text-muted">
                      <tr>
                        <th className="px-3 py-2">Receipt</th>
                        <th className="px-3 py-2">Customer</th>
                        <th className="px-3 py-2">Amount</th>
                        <th className="px-3 py-2">Payment Mode</th>
                        <th className="px-3 py-2">Deposit Account</th>
                        <th className="px-3 py-2">Issued</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-foreground/10">
                      {salesReceipts.map((receipt) => (
                        <tr key={receipt.id}>
                          <td className="px-3 py-2">
                            <p className="font-medium text-foreground">{receipt.receiptNumber}</p>
                            <p className="text-xs text-muted">{receipt.title}</p>
                          </td>
                          <td className="px-3 py-2">{receipt.customerName}</td>
                          <td className="px-3 py-2">{receipt.amountLabel}</td>
                          <td className="px-3 py-2">{receipt.paymentMode}</td>
                          <td className="px-3 py-2">{receipt.depositAccount}</td>
                          <td className="px-3 py-2">{receipt.issuedAtLabel}</td>
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
                        <tr key={payment.id} data-focus-id={payment.id} className={rowFocusClass(highlightFocusId, payment.id)}>
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
                            {payment.hasAttachment ? <span className="ml-2 text-[11px] text-emerald-600">Attachment</span> : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            ) : recordsTab === "expenses" ? (
              expenses.length === 0 ? (
                <p className="text-sm text-muted">No expense records yet.</p>
              ) : (
                <div className="overflow-hidden rounded-lg border border-foreground/10">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-foreground/[0.03] text-xs uppercase tracking-wide text-muted">
                      <tr>
                        <th className="px-3 py-2">Category</th>
                        <th className="px-3 py-2">Vendor</th>
                        <th className="px-3 py-2">Amount</th>
                        <th className="px-3 py-2">Paid Through</th>
                        <th className="px-3 py-2">Reference</th>
                        <th className="px-3 py-2">Date</th>
                        <th className="px-3 py-2">Attachment</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-foreground/10">
                      {expenses.map((expense) => (
                        <tr key={expense.id} data-focus-id={expense.id} className={rowFocusClass(highlightFocusId, expense.id)}>
                          <td className="px-3 py-2">{expense.category}</td>
                          <td className="px-3 py-2">{expense.vendorName}</td>
                          <td className="px-3 py-2">{expense.amountLabel}</td>
                          <td className="px-3 py-2">{expense.paidThroughAccount}</td>
                          <td className="px-3 py-2">{expense.reference}</td>
                          <td className="px-3 py-2">{expense.expenseDateLabel}</td>
                          <td className="px-3 py-2">{expense.hasAttachment ? "Yes" : "No"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            ) : recordsTab === "ar" ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-foreground/10 bg-foreground/[0.02] p-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Payment reminders</p>
                    <p className="text-xs text-muted">
                      First reminder after {financeControls.firstReminderAfterDays} day(s) overdue. Second wave after{" "}
                      {financeControls.secondReminderAfterDays} day(s). One reminder per invoice per 24 hours.
                    </p>
                  </div>
                  {canManageFinance ? (
                    <button
                      type="button"
                      disabled={actionPending}
                      onClick={() => void handleBulkReminders()}
                      className="rounded-md border border-foreground bg-foreground px-3 py-1.5 text-xs font-semibold text-background hover:opacity-90 disabled:opacity-50"
                    >
                      Send reminders to all overdue
                    </button>
                  ) : null}
                </div>
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
            ) : recordsTab === "payables" ? (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-lg border border-foreground/10 bg-foreground/[0.02] p-3">
                    <p className="text-xs uppercase tracking-wide text-muted">Open bills</p>
                    <p className="mt-1 text-xl font-semibold text-foreground">
                      {vendorBills.filter((x) => x.statusValue !== "VOID" && x.statusValue !== "PAID").length}
                    </p>
                  </div>
                  <div className="rounded-lg border border-foreground/10 bg-foreground/[0.02] p-3">
                    <p className="text-xs uppercase tracking-wide text-muted">Total you still owe</p>
                    <p className="mt-1 text-xl font-semibold text-foreground">
                      {reportView.currency} {openPayablesTotal.toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-lg border border-foreground/10 bg-foreground/[0.02] p-3">
                    <p className="text-xs uppercase tracking-wide text-muted">Overdue bills</p>
                    <p className="mt-1 text-xl font-semibold text-foreground">
                      {vendorBills.filter((x) => x.isOverdue).length}
                    </p>
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
                        <td className="px-3 py-2">
                          {reportView.currency} {payablesAging.current.toLocaleString()}
                        </td>
                        <td className="px-3 py-2">
                          {reportView.currency} {payablesAging.d1_30.toLocaleString()}
                        </td>
                        <td className="px-3 py-2">
                          {reportView.currency} {payablesAging.d31_60.toLocaleString()}
                        </td>
                        <td className="px-3 py-2">
                          {reportView.currency} {payablesAging.d61_90.toLocaleString()}
                        </td>
                        <td className="px-3 py-2">
                          {reportView.currency} {payablesAging.d90_plus.toLocaleString()}
                        </td>
                        <td className="px-3 py-2">
                          {reportView.currency} {payablesAging.noDueDate.toLocaleString()}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                {vendorBills.length === 0 ? (
                  <p className="text-sm text-muted">No vendor bills yet. Record a bill when a supplier invoices you.</p>
                ) : (
                  <div className="overflow-hidden rounded-lg border border-foreground/10">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-foreground/[0.03] text-xs uppercase tracking-wide text-muted">
                        <tr>
                          <th className="px-3 py-2">Bill</th>
                          <th className="px-3 py-2">Vendor</th>
                          <th className="px-3 py-2">Status</th>
                          <th className="px-3 py-2">Balance</th>
                          <th className="px-3 py-2">Due</th>
                          <th className="px-3 py-2">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-foreground/10">
                        {vendorBills.map((bill) => (
                          <tr key={bill.id} data-focus-id={bill.id} className={rowFocusClass(highlightFocusId, bill.id)}>
                            <td className="px-3 py-2">
                              <p className="font-medium text-foreground">{bill.billNumber}</p>
                              <p className="text-xs text-muted">{bill.title}</p>
                            </td>
                            <td className="px-3 py-2">{bill.vendorName}</td>
                            <td className="px-3 py-2 text-muted">{bill.status}</td>
                            <td className="px-3 py-2">{bill.balanceLabel}</td>
                            <td className="px-3 py-2 text-muted">
                              {bill.isOverdue ? `${bill.overdueDays} day(s) overdue` : bill.dueDateLabel}
                            </td>
                            <td className="px-3 py-2">
                              {canManageFinance ? (
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    disabled={!bill.canRecordPayment}
                                    onClick={() => setPaymentBill(bill)}
                                    className="text-xs text-foreground underline decoration-foreground/30 underline-offset-2 disabled:opacity-40"
                                  >
                                    Record payment
                                  </button>
                                  <button
                                    type="button"
                                    disabled={!bill.canVoid || actionPending}
                                    onClick={() => void handleVoidBill(bill)}
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
                )}
              </div>
            ) : recordsTab === "reports" ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-foreground/10 bg-background p-3">
                  <div className="flex items-center gap-3">
                    {reportView.companyLogoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={reportView.companyLogoUrl} alt={`${reportView.companyName} logo`} className="h-10 w-auto object-contain" />
                    ) : null}
                    <p className="text-sm font-semibold text-foreground">Financial reports</p>
                    <p className="text-xs text-muted">
                      {reportView.companyName} • Generated {reportView.generatedAtLabel}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <UiSelect value={reportKind} onChange={(e) => setReportKind((e.target.value as ReportKind) || "pnl")}>
                      <option value="pnl">Profit & Loss</option>
                      <option value="cashflow">Cash Flow</option>
                      <option value="balance">Balance Sheet</option>
                    </UiSelect>
                    <UiSelect
                      value={String(reportMonthWindow)}
                      onChange={(e) => setReportMonthWindow((Number(e.target.value) as ReportMonthWindow) || 6)}
                    >
                      <option value="3">Last 3 months</option>
                      <option value="6">Last 6 months</option>
                      <option value="12">Last 12 months</option>
                    </UiSelect>
                    <UiSelect
                      value={reportCompareMode}
                      onChange={(e) => setReportCompareMode((e.target.value as ReportCompareMode) || "previous_period")}
                    >
                      <option value="previous_period">Compared to last period</option>
                      <option value="same_period_last_year">Compared to same months last year</option>
                    </UiSelect>
                    <button
                      type="button"
                      onClick={() => exportReportPack()}
                      className="rounded-md border border-foreground bg-foreground px-3 py-1.5 text-xs font-semibold text-background hover:opacity-90"
                    >
                      Export all (CSV)
                    </button>
                  </div>
                </div>

                <div className="grid gap-3 rounded-lg border border-foreground/10 bg-background p-3 md:grid-cols-3">
                  <UiSelect value={reportProjectFilter} onChange={(e) => setReportProjectFilter(e.target.value)}>
                    <option value="all">All projects</option>
                    {reportProjectOptions.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </UiSelect>
                  <UiSelect value={reportUnitFilter} onChange={(e) => setReportUnitFilter(e.target.value)}>
                    <option value="all">All units</option>
                    {reportUnitOptions.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </UiSelect>
                  <UiSelect value={reportDepartmentFilter} onChange={(e) => setReportDepartmentFilter(e.target.value)}>
                    <option value="all">All departments</option>
                    {reportDepartmentOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </UiSelect>
                </div>
                <p className="text-xs text-muted">Department filter applies across invoices, payments, and expenses.</p>

                <div className="grid gap-3 md:grid-cols-4">
                  {reportComparisonCards.map((card) => (
                    <div key={card.id} className="rounded-lg border border-foreground/10 bg-background p-3">
                      <p className="text-xs uppercase tracking-wide text-muted">{card.label}</p>
                      <p className="mt-1 text-lg font-semibold text-foreground">
                        {reportView.currency} {card.current.toLocaleString()}
                      </p>
                      <p className="text-xs text-muted">
                        Comparison: {reportView.currency} {card.previous.toLocaleString()}
                      </p>
                      <p className={["text-xs font-semibold", valueTone(card.change)].join(" ")}>
                        Change: {card.change >= 0 ? "+" : ""}
                        {reportView.currency} {card.change.toLocaleString()}
                        {card.changePct != null ? ` (${card.changePct.toFixed(1)}%)` : ""}
                      </p>
                      <p className="text-[11px] text-muted">Current minus comparison period</p>
                    </div>
                  ))}
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-lg border border-foreground/10 bg-foreground/[0.02] p-3">
                    <p className="text-xs uppercase tracking-wide text-muted">Invoiced (all time)</p>
                    <p className="mt-1 text-lg font-semibold text-foreground">{reportView.pnlLite.invoicedLabel}</p>
                    <p className="mt-1 text-xs text-muted">Collected: {reportView.pnlLite.collectedLabel}</p>
                    <p className="text-xs text-muted">Outstanding: {reportView.pnlLite.outstandingLabel}</p>
                  </div>
                  <div className="rounded-lg border border-foreground/10 bg-foreground/[0.02] p-3">
                    <p className="text-xs uppercase tracking-wide text-muted">Monthly cash</p>
                    <p className="mt-1 text-xs text-muted">This month: {reportView.cashflowLite.currentMonthLabel}</p>
                    <p className="text-xs text-muted">Last month: {reportView.cashflowLite.previousMonthLabel}</p>
                    <p className="mt-1 text-lg font-semibold text-foreground">Change: {reportView.cashflowLite.changeLabel}</p>
                  </div>
                  <div className="rounded-lg border border-foreground/10 bg-foreground/[0.02] p-3">
                    <p className="text-xs uppercase tracking-wide text-muted">Collections performance</p>
                    <p className="mt-1 text-lg font-semibold text-emerald-600">{reportView.collections.collectionRateLabel}</p>
                    <p className="mt-1 text-xs text-muted">Overdue amount: {reportView.collections.overdueOutstandingLabel}</p>
                    <p className="text-xs text-muted">Overdue invoices: {reportView.collections.overdueCount}</p>
                    <p className="text-xs text-muted">Reminders sent: {reportView.collections.remindersSent}</p>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-4">
                  <div className="rounded-lg border border-foreground/10 bg-background p-3">
                    <p className="text-xs uppercase tracking-wide text-muted">Receivables snapshot</p>
                    <p className="mt-1 text-lg font-semibold text-foreground">
                      {reportView.currency} {filteredBalanceSnapshot.receivables.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted">
                      Overdue: {reportView.currency} {filteredBalanceSnapshot.overdueReceivables.toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-lg border border-foreground/10 bg-background p-3">
                    <p className="text-xs uppercase tracking-wide text-muted">Cash in</p>
                    <p className="mt-1 text-lg font-semibold text-foreground">
                      {reportView.currency} {filteredBalanceSnapshot.cashIn.toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-lg border border-foreground/10 bg-background p-3">
                    <p className="text-xs uppercase tracking-wide text-muted">Cash out</p>
                    <p className="mt-1 text-lg font-semibold text-foreground">
                      {reportView.currency} {filteredBalanceSnapshot.cashOut.toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-lg border border-foreground/10 bg-background p-3">
                    <p className="text-xs uppercase tracking-wide text-muted">Net cashflow</p>
                    <p className={["mt-1 text-lg font-semibold", valueTone(filteredBalanceSnapshot.netCashflow)].join(" ")}>
                      {reportView.currency} {filteredBalanceSnapshot.netCashflow.toLocaleString()}
                    </p>
                  </div>
                </div>

                {reportKind === "balance" ? (
                  <div className="rounded-lg border border-foreground/10 bg-background p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-sm font-semibold text-foreground">Balance sheet</p>
                      <button
                        type="button"
                        onClick={() => exportReportCsv("balance")}
                        className="rounded-md border border-foreground/20 px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-foreground/[0.06]"
                      >
                        Export CSV
                      </button>
                    </div>
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="rounded-lg border border-foreground/10 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted">What you own</p>
                        <ul className="mt-2 space-y-2 text-sm">
                          {balanceSheetSections.assets.map((line) => (
                            <li key={line.label} className={line.sub ? "pl-3 text-muted" : "text-foreground"}>
                              <span>{line.label}</span>
                              <span className="float-right font-semibold">
                                {reportView.currency} {line.amount.toLocaleString()}
                              </span>
                            </li>
                          ))}
                        </ul>
                        <p className="mt-3 border-t border-foreground/10 pt-2 text-sm font-semibold text-foreground">
                          Total{" "}
                          <span className="float-right">
                            {reportView.currency} {balanceSheetSections.assetsTotal.toLocaleString()}
                          </span>
                        </p>
                      </div>
                      <div className="rounded-lg border border-foreground/10 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted">What you owe</p>
                        <ul className="mt-2 space-y-2 text-sm">
                          {balanceSheetSections.liabilities.map((line) => (
                            <li key={line.label} className="text-foreground">
                              <span>{line.label}</span>
                              <span className="float-right font-semibold">
                                {reportView.currency} {line.amount.toLocaleString()}
                              </span>
                            </li>
                          ))}
                        </ul>
                        <p className="mt-3 border-t border-foreground/10 pt-2 text-sm font-semibold text-foreground">
                          Total{" "}
                          <span className="float-right">
                            {reportView.currency} {balanceSheetSections.liabilitiesTotal.toLocaleString()}
                          </span>
                        </p>
                      </div>
                      <div className="rounded-lg border border-foreground/10 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Owner position</p>
                        <ul className="mt-2 space-y-2 text-sm">
                          {balanceSheetSections.equity.map((line) => (
                            <li key={line.label} className="text-foreground">
                              <span>{line.label}</span>
                              <span className={["float-right font-semibold", valueTone(line.amount)].join(" ")}>
                                {reportView.currency} {line.amount.toLocaleString()}
                              </span>
                            </li>
                          ))}
                        </ul>
                        <p className={["mt-3 border-t border-foreground/10 pt-2 text-sm font-semibold", valueTone(balanceSheetSections.equityTotal)].join(" ")}>
                          Total{" "}
                          <span className="float-right">
                            {reportView.currency} {balanceSheetSections.equityTotal.toLocaleString()}
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}

                {reportKind === "pnl" ? (
                  <div className="rounded-lg border border-foreground/10 bg-background p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-semibold text-foreground">Profit & loss by month (last {reportMonthWindow} months)</p>
                    <button
                      type="button"
                      onClick={() => exportReportCsv("pnl")}
                      className="rounded-md border border-foreground/20 px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-foreground/[0.06]"
                    >
                      Export CSV
                    </button>
                  </div>
                  <div className="overflow-hidden rounded-lg border border-foreground/10">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-foreground/[0.03] text-xs uppercase tracking-wide text-muted">
                        <tr>
                          <th className="px-3 py-2">Month</th>
                          <th className="px-3 py-2">Invoiced</th>
                          <th className="px-3 py-2">Collected</th>
                          <th className="px-3 py-2">Expenses</th>
                          <th className="px-3 py-2">Net</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-foreground/10">
                        {visiblePnlBreakdown.map((row) => (
                          <tr key={row.month}>
                            <td className="px-3 py-2">
                              <button
                                type="button"
                                onClick={() => setReportDrilldownMonth(row.month)}
                                className="text-left font-medium text-foreground underline decoration-foreground/25 underline-offset-2 hover:decoration-foreground/60"
                              >
                                {row.month}
                              </button>
                            </td>
                            <td className="px-3 py-2">{reportView.currency} {row.invoiced.toLocaleString()}</td>
                            <td className="px-3 py-2">{reportView.currency} {row.collected.toLocaleString()}</td>
                            <td className="px-3 py-2">{reportView.currency} {row.expenses.toLocaleString()}</td>
                            <td className={["px-3 py-2 font-semibold", valueTone(row.net)].join(" ")}>
                              {reportView.currency} {row.net.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                ) : null}

                <div className="grid gap-4 md:grid-cols-2">
                  {reportKind === "cashflow" ? (
                    <div className="rounded-lg border border-foreground/10 bg-background p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-semibold text-foreground">Cash flow by month</p>
                      <button
                        type="button"
                        onClick={() => exportReportCsv("cashflow")}
                        className="rounded-md border border-foreground/20 px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-foreground/[0.06]"
                      >
                        Export CSV
                      </button>
                    </div>
                    <div className="overflow-hidden rounded-lg border border-foreground/10">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-foreground/[0.03] text-xs uppercase tracking-wide text-muted">
                          <tr>
                            <th className="px-3 py-2">Month</th>
                            <th className="px-3 py-2">Inflow</th>
                            <th className="px-3 py-2">Outflow</th>
                            <th className="px-3 py-2">Net</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-foreground/10">
                          {visibleCashflowBreakdown.map((row) => (
                            <tr key={row.month}>
                              <td className="px-3 py-2">
                                <button
                                  type="button"
                                  onClick={() => setReportDrilldownMonth(row.month)}
                                  className="text-left font-medium text-foreground underline decoration-foreground/25 underline-offset-2 hover:decoration-foreground/60"
                                >
                                  {row.month}
                                </button>
                              </td>
                              <td className="px-3 py-2">{reportView.currency} {row.inflow.toLocaleString()}</td>
                              <td className="px-3 py-2">{reportView.currency} {row.outflow.toLocaleString()}</td>
                              <td className={["px-3 py-2 font-semibold", valueTone(row.net)].join(" ")}>
                                {reportView.currency} {row.net.toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  ) : null}

                  <div className="rounded-lg border border-foreground/10 bg-background p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-semibold text-foreground">Expense by category</p>
                      <button
                        type="button"
                        onClick={() => exportReportCsv("expenses")}
                        className="rounded-md border border-foreground/20 px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-foreground/[0.06]"
                      >
                        Export CSV
                      </button>
                    </div>
                    <div className="overflow-hidden rounded-lg border border-foreground/10">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-foreground/[0.03] text-xs uppercase tracking-wide text-muted">
                          <tr>
                            <th className="px-3 py-2">Category</th>
                            <th className="px-3 py-2">Count</th>
                            <th className="px-3 py-2">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-foreground/10">
                          {visibleExpenseBreakdown.map((row) => (
                            <tr key={row.category}>
                              <td className="px-3 py-2">{row.category}</td>
                              <td className="px-3 py-2">{row.count}</td>
                              <td className="px-3 py-2 font-semibold">{reportView.currency} {row.total.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {reportDrilldown ? (
                  <div className="rounded-lg border border-foreground/10 bg-background p-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-foreground">Transactions for {reportDrilldown.month}</p>
                      <button
                        type="button"
                        onClick={() => setReportDrilldownMonth(null)}
                        className="rounded-md border border-foreground/20 px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-foreground/[0.06]"
                      >
                        Close
                      </button>
                    </div>
                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="rounded-md border border-foreground/10 bg-foreground/[0.02] p-3">
                        <p className="text-xs uppercase tracking-wide text-muted">Invoices</p>
                        <p className="mt-1 text-base font-semibold text-foreground">{reportDrilldown.invoices.length}</p>
                        <p className="text-xs text-muted">{reportView.currency} {reportDrilldown.totals.invoices.toLocaleString()}</p>
                      </div>
                      <div className="rounded-md border border-foreground/10 bg-foreground/[0.02] p-3">
                        <p className="text-xs uppercase tracking-wide text-muted">Payments</p>
                        <p className="mt-1 text-base font-semibold text-foreground">{reportDrilldown.payments.length}</p>
                        <p className="text-xs text-muted">{reportView.currency} {reportDrilldown.totals.payments.toLocaleString()}</p>
                      </div>
                      <div className="rounded-md border border-foreground/10 bg-foreground/[0.02] p-3">
                        <p className="text-xs uppercase tracking-wide text-muted">Expenses</p>
                        <p className="mt-1 text-base font-semibold text-foreground">{reportDrilldown.expenses.length}</p>
                        <p className="text-xs text-muted">{reportView.currency} {reportDrilldown.totals.expenses.toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-4 md:grid-cols-3">
                      <div className="rounded-md border border-foreground/10">
                        <p className="border-b border-foreground/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted">Invoices</p>
                        <div className="max-h-56 overflow-y-auto px-3 py-2 text-xs">
                          {reportDrilldown.invoices.length === 0 ? (
                            <p className="text-muted">No invoices for this month.</p>
                          ) : (
                            reportDrilldown.invoices.map((row) => (
                              <button
                                key={row.id}
                                type="button"
                                onClick={() => openFinanceRecord("invoice", row.id)}
                                className="block w-full py-1 text-left text-foreground underline decoration-foreground/20 underline-offset-2 hover:decoration-foreground/50"
                              >
                                {row.invoiceNumber} — {reportView.currency} {row.amountValue.toLocaleString()}
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                      <div className="rounded-md border border-foreground/10">
                        <p className="border-b border-foreground/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted">Payments</p>
                        <div className="max-h-56 overflow-y-auto px-3 py-2 text-xs">
                          {reportDrilldown.payments.length === 0 ? (
                            <p className="text-muted">No payments for this month.</p>
                          ) : (
                            reportDrilldown.payments.map((row) => (
                              <button
                                key={row.id}
                                type="button"
                                onClick={() => openFinanceRecord("payment", row.id)}
                                className="block w-full py-1 text-left text-foreground underline decoration-foreground/20 underline-offset-2 hover:decoration-foreground/50"
                              >
                                {row.invoiceLabel} — {reportView.currency} {row.amountValue.toLocaleString()}
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                      <div className="rounded-md border border-foreground/10">
                        <p className="border-b border-foreground/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted">Expenses</p>
                        <div className="max-h-56 overflow-y-auto px-3 py-2 text-xs">
                          {reportDrilldown.expenses.length === 0 ? (
                            <p className="text-muted">No expenses for this month.</p>
                          ) : (
                            reportDrilldown.expenses.map((row) => (
                              <button
                                key={row.id}
                                type="button"
                                onClick={() => openFinanceRecord("expense", row.id)}
                                className="block w-full py-1 text-left text-foreground underline decoration-foreground/20 underline-offset-2 hover:decoration-foreground/50"
                              >
                                {row.category} — {reportView.currency} {row.amountValue.toLocaleString()}
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : recordsTab === "banking" ? (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-lg border border-foreground/10 bg-foreground/[0.02] p-3">
                    <p className="text-xs uppercase tracking-wide text-muted">Configured bank/cash accounts</p>
                    <p className="mt-1 text-xl font-semibold text-foreground">{financeOptions.bankAccounts.length}</p>
                    <p className="mt-1 text-xs text-muted">Managed from Finance Settings.</p>
                  </div>
                  <div className="rounded-lg border border-foreground/10 bg-foreground/[0.02] p-3">
                    <p className="text-xs uppercase tracking-wide text-muted">Captured payment modes</p>
                    <p className="mt-1 text-xl font-semibold text-foreground">{financeOptions.paymentModes.length}</p>
                    <p className="mt-1 text-xs text-muted">Available in payment and receipt forms.</p>
                  </div>
                  <div className="rounded-lg border border-foreground/10 bg-foreground/[0.02] p-3">
                    <p className="text-xs uppercase tracking-wide text-muted">Recorded payments</p>
                    <p className="mt-1 text-xl font-semibold text-foreground">{payments.length}</p>
                    <p className="mt-1 text-xs text-muted">Ready for account-level reconciliation.</p>
                  </div>
                </div>
                <div className="rounded-lg border border-foreground/10 bg-background p-4">
                  <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Statement import</p>
                      <p className="text-xs text-muted">
                        Upload bank CSV with columns like date, description, reference, debit, credit, amount.
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="text-[11px] text-muted">Sample templates:</span>
                        <button
                          type="button"
                          className="rounded-md border border-foreground/20 px-2 py-1 text-[11px] font-semibold text-foreground hover:bg-foreground/[0.06]"
                          onClick={() => downloadBankCsvTemplate()}
                        >
                          Download CSV sample
                        </button>
                      </div>
                    </div>
                    <label className="inline-flex cursor-pointer items-center rounded-md border border-foreground/20 px-3 py-2 text-xs font-semibold text-foreground hover:bg-foreground/[0.06]">
                      Import CSV
                      <input
                        type="file"
                        accept=".csv,text/csv"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void handleBankCsvUpload(file);
                          e.currentTarget.value = "";
                        }}
                      />
                    </label>
                  </div>
                  {importedBankRows.length > 0 ? (
                    <div className="mb-4 rounded-md border border-foreground/10 bg-foreground/[0.02] px-3 py-2 text-xs text-muted">
                      Imported file: <span className="font-medium text-foreground">{bankImportName}</span> with{" "}
                      <span className="font-medium text-foreground">{importedBankRows.length}</span> transaction row(s).
                    </div>
                  ) : null}
                  <p className="text-sm font-semibold text-foreground">Next in banking rollout</p>
                  <ul className="mt-2 space-y-1 text-sm text-muted">
                    <li>CSV statement import flow</li>
                    <li>Manual reconciliation queue (match bank lines to receipts/payments/expenses)</li>
                    <li>Bank transaction rule suggestions</li>
                  </ul>
                  <p className="mt-3 text-xs text-muted">
                    You can add or edit bank/cash accounts in{" "}
                    <Link
                      href={`/${tenantSlug}/finance/settings`}
                      className="font-medium text-foreground underline decoration-foreground/30 underline-offset-2"
                    >
                      Finance settings
                    </Link>
                    .
                  </p>
                </div>
                {bankingImports.length > 0 ? (
                  <div className="rounded-lg border border-foreground/10 bg-background p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-foreground">Import history</p>
                      <div className="flex items-center gap-2">
                        <UiSelect value={selectedImportId} onChange={(e) => setSelectedImportId(e.target.value)}>
                          <option value="all">All imports</option>
                          {bankingImports.map((imp) => (
                            <option key={imp.id} value={imp.id}>
                              {imp.sourceName} - {imp.importedAtLabel}
                            </option>
                          ))}
                        </UiSelect>
                        <button
                          type="button"
                          disabled={!selectedImport || selectedImport.finalized || finalizingImportId === selectedImport?.id}
                          onClick={() => void handleFinalizeSelectedImport()}
                          className="rounded-md border border-foreground/20 px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-foreground/[0.06] disabled:opacity-50"
                        >
                          {finalizingImportId === selectedImport?.id ? "Finalizing..." : "Finalize selected"}
                        </button>
                      </div>
                    </div>
                    <div className="overflow-hidden rounded-lg border border-foreground/10">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-foreground/[0.03] text-xs uppercase tracking-wide text-muted">
                          <tr>
                            <th className="px-3 py-2">Source</th>
                            <th className="px-3 py-2">Imported</th>
                            <th className="px-3 py-2">Rows</th>
                            <th className="px-3 py-2">Matched</th>
                            <th className="px-3 py-2">Unmatched</th>
                            <th className="px-3 py-2">Lock</th>
                            <th className="px-3 py-2">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-foreground/10">
                          {bankingImports.slice(0, 10).map((imp) => (
                            <tr key={imp.id}>
                              <td className="px-3 py-2">{imp.sourceName}</td>
                              <td className="px-3 py-2 text-muted">{imp.importedAtLabel}</td>
                              <td className="px-3 py-2">{imp.totalRows}</td>
                              <td className="px-3 py-2 text-emerald-600">{imp.matchedRows}</td>
                              <td className="px-3 py-2 text-amber-600">{imp.unmatchedRows}</td>
                              <td className="px-3 py-2">
                                {imp.finalized ? (
                                  <span className="rounded-full border border-emerald-300/40 px-2 py-0.5 text-xs text-emerald-500">
                                    Finalized
                                  </span>
                                ) : (
                                  <span className="rounded-full border border-foreground/20 px-2 py-0.5 text-xs text-muted">Open</span>
                                )}
                              </td>
                              <td className="px-3 py-2">
                                <button
                                  type="button"
                                  className="text-xs text-foreground underline decoration-foreground/30 underline-offset-2"
                                  onClick={() => setSelectedImportId(imp.id)}
                                >
                                  View batch
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}
                {importedBankRows.length > 0 ? (
                  <div className="rounded-lg border border-foreground/10 bg-background p-4">
                    <div className="mb-3 grid gap-3 md:grid-cols-4">
                      <div className="rounded-lg border border-foreground/10 bg-foreground/[0.02] p-3">
                        <p className="text-xs uppercase tracking-wide text-muted">Match rate</p>
                        <p className="mt-1 text-lg font-semibold text-foreground">{bankingMetrics.matchRate.toFixed(1)}%</p>
                      </div>
                      <div className="rounded-lg border border-foreground/10 bg-foreground/[0.02] p-3">
                        <p className="text-xs uppercase tracking-wide text-muted">Rows in scope</p>
                        <p className="mt-1 text-lg font-semibold text-foreground">{bankingMetrics.total}</p>
                        <p className="text-xs text-muted">Matched {bankingMetrics.matched} / Unmatched {bankingMetrics.unmatched}</p>
                      </div>
                      <div className="rounded-lg border border-foreground/10 bg-foreground/[0.02] p-3">
                        <p className="text-xs uppercase tracking-wide text-muted">Unmatched amount</p>
                        <p className="mt-1 text-lg font-semibold text-foreground">{bankingMetrics.unmatchedAmount.toLocaleString()}</p>
                      </div>
                      <div className="rounded-lg border border-foreground/10 bg-foreground/[0.02] p-3">
                        <p className="text-xs uppercase tracking-wide text-muted">Oldest unmatched</p>
                        <p className="mt-1 text-lg font-semibold text-foreground">{bankingMetrics.oldestUnmatchedDays} day(s)</p>
                      </div>
                    </div>
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-foreground">Reconciliation queue (manual review)</p>
                        <p className="mt-1 text-xs text-muted">
                          Suggested matches are based on exact amount + nearest date + reference hint.
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <label className="inline-flex items-center gap-2 text-xs text-muted">
                          <input
                            type="checkbox"
                            checked={showUnmatchedOnly}
                            onChange={(e) => setShowUnmatchedOnly(e.target.checked)}
                          />
                          Show unmatched only
                        </label>
                        <button
                          type="button"
                          disabled={autoMatching}
                          onClick={() => void handleAutoMatchVisibleRows()}
                          className="rounded-md border border-foreground/20 px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-foreground/[0.06] disabled:opacity-50"
                        >
                          {autoMatching ? "Auto-matching..." : "Auto-match visible"}
                        </button>
                        <button
                          type="button"
                          disabled={visibleBankRows.length === 0}
                          onClick={() => handleExportVisibleBankRows()}
                          className="rounded-md border border-foreground/20 px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-foreground/[0.06] disabled:opacity-50"
                        >
                          Export current view CSV
                        </button>
                      </div>
                    </div>
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      {(
                        [
                          { id: "all", label: "All dates" },
                          { id: "today", label: "Today" },
                          { id: "7d", label: "Last 7d" },
                          { id: "month", label: "This month" },
                        ] as Array<{ id: BankingDateFilter; label: string }>
                      ).map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setBankDateFilter(opt.id)}
                          className={
                            bankDateFilter === opt.id
                              ? "rounded-md border border-foreground bg-foreground px-2.5 py-1 text-xs font-semibold text-background"
                              : "rounded-md border border-foreground/20 px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-foreground/[0.06]"
                          }
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <UiSelect value={bankStatusFilter} onChange={(e) => setBankStatusFilter(e.target.value as BankingStatusFilter)}>
                        <option value="all">All statuses</option>
                        <option value="unmatched">Unmatched</option>
                        <option value="matched">Matched</option>
                        <option value="exception">Exception</option>
                      </UiSelect>
                      <UiSelect value={exceptionReasonFilter} onChange={(e) => setExceptionReasonFilter(e.target.value)}>
                        <option value="all">All exception reasons</option>
                        {BANK_EXCEPTION_REASON_OPTIONS.map((reason) => (
                          <option key={reason} value={reason}>
                            {reason}
                          </option>
                        ))}
                      </UiSelect>
                    </div>
                    <div className="mt-3 overflow-hidden rounded-lg border border-foreground/10">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-foreground/[0.03] text-xs uppercase tracking-wide text-muted">
                          <tr>
                            <th className="px-3 py-2">Statement row</th>
                            <th className="px-3 py-2">Direction</th>
                            <th className="px-3 py-2">Amount</th>
                            <th className="px-3 py-2">Suggested match</th>
                            <th className="px-3 py-2">Status</th>
                            <th className="px-3 py-2">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-foreground/10">
                          {visibleBankRows.length === 0 ? (
                            <tr>
                              <td className="px-3 py-3 text-sm text-muted" colSpan={6}>
                                No rows match the current reconciliation filters.
                              </td>
                            </tr>
                          ) : null}
                          {visibleBankRows.slice(0, 300).map((row) => {
                            const match = suggestMatch(row);
                            const candidates = manualCandidates(row);
                            const selected = manualMatchSelection[row.id] || "";
                            return (
                              <tr key={row.id}>
                                <td className="px-3 py-2">
                                  <p className="font-medium text-foreground">{row.date || "No date"}</p>
                                  <p className="text-xs text-muted">
                                    {row.description || "No description"}
                                    {row.reference ? ` | Ref: ${row.reference}` : ""}
                                  </p>
                                  {row.importIsFinalized ? (
                                    <p className="mt-1 text-[11px] text-emerald-600">Batch finalized (locked)</p>
                                  ) : null}
                                </td>
                                <td className="px-3 py-2">
                                  <span
                                    className={
                                      row.direction === "credit"
                                        ? "rounded-full border border-emerald-300/40 px-2 py-0.5 text-xs text-emerald-500"
                                        : "rounded-full border border-amber-300/40 px-2 py-0.5 text-xs text-amber-500"
                                    }
                                  >
                                    {row.direction}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-foreground">{row.amountAbs.toLocaleString()}</td>
                                <td className="px-3 py-2 text-muted">
                                  {row.matchStatus === "MATCHED" ? (
                                    <p className="text-foreground">
                                      Matched to {row.matchedEntityType || "record"} {row.matchedEntityId ? `(${row.matchedEntityId.slice(0, 8)})` : ""}
                                    </p>
                                  ) : row.matchStatus === "EXCEPTION" ? (
                                    <>
                                      <p className="text-foreground">Exception bucket</p>
                                      <p className="text-xs text-muted">Reason: {row.exceptionReason || "OTHER"}</p>
                                    </>
                                  ) : match ? (
                                    <>
                                      <p className="text-foreground">
                                        {match.kind === "payment" ? "Payment" : "Expense"} - {match.label}
                                      </p>
                                      <p className="text-xs text-muted">
                                        {match.amount.toLocaleString()} on {match.date || "n/a"}
                                      </p>
                                    </>
                                  ) : (
                                    "No exact amount match"
                                  )}
                                </td>
                                <td className="px-3 py-2">
                                  {row.matchStatus === "MATCHED" ? (
                                    <span className="rounded-full border border-emerald-300/40 px-2 py-0.5 text-xs text-emerald-500">
                                      Matched
                                    </span>
                                  ) : row.matchStatus === "EXCEPTION" ? (
                                    <span className="rounded-full border border-amber-300/40 px-2 py-0.5 text-xs text-amber-600">
                                      Exception
                                    </span>
                                  ) : match ? (
                                    <span className="rounded-full border border-emerald-300/40 px-2 py-0.5 text-xs text-emerald-500">
                                      Ready to match
                                    </span>
                                  ) : (
                                    <span className="rounded-full border border-foreground/20 px-2 py-0.5 text-xs text-muted">
                                      Needs review
                                    </span>
                                  )}
                                </td>
                                <td className="px-3 py-2">
                                  <div className="space-y-2">
                                    {row.matchStatus === "MATCHED" ? (
                                      <button
                                        type="button"
                                        disabled={row.importIsFinalized}
                                        className="rounded-md border border-foreground/20 px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-foreground/[0.06] disabled:opacity-50"
                                        onClick={() => void handleUnmatchRow(row)}
                                      >
                                        Unmatch
                                      </button>
                                    ) : match ? (
                                      <button
                                        type="button"
                                        disabled={row.importIsFinalized}
                                        onClick={() => void handleMarkMatched(row, match)}
                                        className="rounded-md border border-foreground/20 px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-foreground/[0.06] disabled:opacity-50"
                                      >
                                        Mark matched
                                      </button>
                                    ) : (
                                      <div className="flex items-center gap-2">
                                        <UiSelect
                                          value={selected}
                                          onChange={(e) =>
                                            setManualMatchSelection((curr) => ({ ...curr, [row.id]: e.target.value }))
                                          }
                                        >
                                          <option value="">Pick record</option>
                                          {candidates.map((c) => (
                                            <option key={`${c.kind}:${c.id}`} value={`${c.kind}:${c.id}`}>
                                              {c.kind === "payment" ? "Payment" : "Expense"} | {c.amount.toLocaleString()} | {c.label}
                                            </option>
                                          ))}
                                        </UiSelect>
                                        <button
                                          type="button"
                                          disabled={!selected || row.importIsFinalized}
                                          className="rounded-md border border-foreground/20 px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-foreground/[0.06] disabled:opacity-50"
                                          onClick={() => {
                                            if (!selected) return;
                                            const [kind, id] = selected.split(":");
                                            if (!id || (kind !== "payment" && kind !== "expense")) return;
                                            const candidate = candidates.find((c) => c.id === id && c.kind === kind);
                                            if (!candidate) return;
                                            void handleMarkMatched(row, candidate);
                                          }}
                                        >
                                          Match
                                        </button>
                                      </div>
                                    )}
                                    <div className="flex items-center gap-2">
                                      <UiSelect
                                        value={exceptionReasonDrafts[row.id] ?? row.exceptionReason ?? "OTHER"}
                                        onChange={(e) =>
                                          setExceptionReasonDrafts((curr) => ({ ...curr, [row.id]: e.target.value }))
                                        }
                                      >
                                        {BANK_EXCEPTION_REASON_OPTIONS.map((reason) => (
                                          <option key={reason} value={reason}>
                                            {reason}
                                          </option>
                                        ))}
                                      </UiSelect>
                                      <input
                                        value={noteDrafts[row.id] ?? row.reconciliationNote ?? ""}
                                        onChange={(e) => setNoteDrafts((curr) => ({ ...curr, [row.id]: e.target.value }))}
                                        placeholder="Exception note"
                                        className="w-40 rounded-md border border-foreground/20 bg-background px-2 py-1 text-xs"
                                        disabled={row.importIsFinalized}
                                      />
                                      <button
                                        type="button"
                                        disabled={row.importIsFinalized}
                                        className="rounded-md border border-foreground/20 px-2 py-1 text-xs text-foreground hover:bg-foreground/[0.06] disabled:opacity-50"
                                        onClick={() => void handleSaveRowNote(row)}
                                      >
                                        Save note
                                      </button>
                                      <button
                                        type="button"
                                        disabled={row.importIsFinalized}
                                        className="rounded-md border border-amber-300/40 px-2 py-1 text-xs text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                                        onClick={() => void handleMarkException(row)}
                                      >
                                        Mark exception
                                      </button>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : masterLogs.length === 0 ? (
              <p className="text-sm text-muted">No master logs yet.</p>
            ) : (
              <div className="space-y-3">
                <form action={`/${tenantSlug}/finance/audit-logs`} method="get" className="grid gap-2 md:grid-cols-6">
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
                <form action={`/${tenantSlug}/finance/audit-logs`} method="get" className="grid gap-2 md:grid-cols-6">
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
                      onClick={() => router.push(`/${tenantSlug}/finance/audit-logs`)}
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
                  href={financeAuditLogsUrl(tenantSlug, logFilters, Math.max(1, logFilters.logsPage - 1))}
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
                  href={financeAuditLogsUrl(tenantSlug, logFilters, Math.min(logPagination.totalPages, logFilters.logsPage + 1))}
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
          </section>
      ) : null}

      {isFinanceOverviewSurface ? (
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
            Open <span className="font-medium text-foreground">Audit Logs</span> from the sidebar for the full searchable
            trail. Invoices, payments, and expenses each have their own pages.
          </p>
        </div>
      </section>
      ) : null}

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
              <p className="rounded-md border border-foreground/10 bg-foreground/[0.02] px-3 py-2 text-[11px] text-muted">
                Currency options come from{" "}
                <Link
                  href={`/${tenantSlug}/finance/settings`}
                  className="font-medium text-foreground underline decoration-foreground/30 underline-offset-2"
                >
                  Finance settings
                </Link>
                .
              </p>
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
                  <UiSelect
                    key={`inv-curr-${financeOptions.currencies.join("|")}`}
                    name="currency"
                    defaultValue={financeOptions.currencies[0] || "NGN"}
                  >
                    {financeOptions.currencies.map((currency) => (
                      <option key={currency} value={currency}>
                        {currency}
                      </option>
                    ))}
                  </UiSelect>
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
              <div>
                <label className="mb-1 block text-sm text-muted">Department (optional)</label>
                <UiSelect
                  name="department"
                  defaultValue={financeOptions.departments[0] || "Finance"}
                >
                  <option value="">Select department</option>
                  {financeOptions.departments.map((department) => (
                    <option key={department} value={department}>
                      {department}
                    </option>
                  ))}
                </UiSelect>
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

      {isCreateReceiptOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-xl border border-foreground/10 bg-background p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Create sales receipt</h2>
                <p className="mt-1 text-xs text-muted">Capture customer payment instantly with account and mode details.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateReceiptOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-foreground/15 text-muted hover:bg-foreground/[0.06] hover:text-foreground"
                aria-label="Close modal"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <form action={handleCreateSalesReceipt} className="mt-4 space-y-3">
              <p className="rounded-md border border-foreground/10 bg-foreground/[0.02] px-3 py-2 text-[11px] text-muted">
                Currency, accounts, and payment modes come from{" "}
                <Link
                  href={`/${tenantSlug}/finance/settings`}
                  className="font-medium text-foreground underline decoration-foreground/30 underline-offset-2"
                >
                  Finance settings
                </Link>
                .
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm text-muted">Title</label>
                  <input name="title" placeholder="Initial allocation payment" className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground" />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-muted">Customer (optional)</label>
                  <input name="customerName" placeholder="Customer name" className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground" />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm text-muted">Amount</label>
                  <input name="amount" inputMode="decimal" className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground" />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-muted">Currency</label>
                  <UiSelect
                    key={`sr-curr-${financeOptions.currencies.join("|")}`}
                    name="currency"
                    defaultValue={financeOptions.currencies[0] || "NGN"}
                  >
                    {financeOptions.currencies.map((currency) => (
                      <option key={currency} value={currency}>
                        {currency}
                      </option>
                    ))}
                  </UiSelect>
                </div>
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
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm text-muted">Payment mode (optional)</label>
                  <UiSelect
                    key={`sr-mode-${financeOptions.paymentModes.join("|")}`}
                    name="paymentMode"
                    defaultValue={financeOptions.paymentModes[0] || ""}
                  >
                    <option value="">Select mode</option>
                    {financeOptions.paymentModes.map((mode) => (
                      <option key={mode} value={mode}>
                        {mode}
                      </option>
                    ))}
                  </UiSelect>
                </div>
                <div>
                  <label className="mb-1 block text-sm text-muted">Deposit account (optional)</label>
                  <UiSelect
                    key={`sr-bank-${financeOptions.bankAccounts.join("|")}`}
                    name="depositAccount"
                    defaultValue={financeOptions.bankAccounts[0] || ""}
                  >
                    <option value="">Select account</option>
                    {financeOptions.bankAccounts.map((account) => (
                      <option key={account} value={account}>
                        {account}
                      </option>
                    ))}
                  </UiSelect>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm text-muted">Reference (optional)</label>
                  <input name="reference" className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground" />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-muted">Notes (optional)</label>
                  <input name="note" className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsCreateReceiptOpen(false)}
                  className="rounded-md border border-foreground/15 px-4 py-2 text-sm text-foreground hover:bg-foreground/[0.06]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionPending}
                  className="rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {actionPending ? "Saving..." : "Create receipt"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {isCreateExpenseOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-foreground/10 bg-background p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold text-foreground">Create expense</h2>
              <button
                type="button"
                onClick={() => setIsCreateExpenseOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-foreground/15 text-muted hover:bg-foreground/[0.06] hover:text-foreground"
                aria-label="Close modal"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <form action={handleCreateExpense} className="mt-4 space-y-3">
              {financeControls.expenseApprovalThreshold ? (
                <p className="rounded-md border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-[11px] text-foreground">
                  Expenses above {financeControls.expenseApprovalThreshold.toLocaleString()} need manager approval before you can record them here.
                </p>
              ) : null}
              <p className="rounded-md border border-foreground/10 bg-foreground/[0.02] px-3 py-2 text-[11px] text-muted">
                Currencies, bank/cash accounts, and payment modes are only edited in{" "}
                <Link
                  href={`/${tenantSlug}/finance/settings`}
                  className="font-medium text-foreground underline decoration-foreground/30 underline-offset-2"
                >
                  Finance settings
                </Link>
                . Save there, then open this form again to see new options.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm text-muted">Category</label>
                  <input name="category" className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground" />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-muted">Vendor (optional)</label>
                  <input name="vendorName" className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground" />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm text-muted">Amount</label>
                  <input name="amount" inputMode="decimal" className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground" />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-muted">Currency</label>
                  <UiSelect
                    key={`exp-curr-${financeOptions.currencies.join("|")}`}
                    name="currency"
                    defaultValue={financeOptions.currencies[0] || "NGN"}
                  >
                    {financeOptions.currencies.map((currency) => (
                      <option key={currency} value={currency}>
                        {currency}
                      </option>
                    ))}
                  </UiSelect>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm text-muted">Expense date</label>
                  <input name="expenseDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground" />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-muted">Paid through (optional)</label>
                  <UiSelect
                    key={`exp-bank-${financeOptions.bankAccounts.join("|")}`}
                    name="paidThroughAccount"
                    defaultValue={financeOptions.bankAccounts[0] || ""}
                  >
                    <option value="">Select account</option>
                    {financeOptions.bankAccounts.map((account) => (
                      <option key={account} value={account}>
                        {account}
                      </option>
                    ))}
                  </UiSelect>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm text-muted">Reference (optional)</label>
                <input name="reference" className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-muted">Note (optional)</label>
                <textarea name="note" rows={3} className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-muted">Department (optional)</label>
                <UiSelect
                  name="department"
                  defaultValue={financeOptions.departments[0] || "Finance"}
                >
                  <option value="">Select department</option>
                  {financeOptions.departments.map((department) => (
                    <option key={department} value={department}>
                      {department}
                    </option>
                  ))}
                </UiSelect>
              </div>
              <div>
                <label className="mb-1 block text-sm text-muted">Attachment (optional)</label>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  disabled={uploadPending}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadExpenseAttachment(file);
                  }}
                  className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground file:mr-3 file:rounded file:border-0 file:bg-foreground file:px-2 file:py-1 file:text-xs file:font-semibold file:text-background"
                />
                <p className="mt-1 text-xs text-muted">
                  {expenseAttachment
                    ? `Attached: ${expenseAttachment.name}`
                    : uploadPending
                      ? "Uploading..."
                      : "If Cloudinary is not configured yet, continue without attachment."}
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateExpenseOpen(false)}
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

      {isCreateBillOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-foreground/10 bg-background p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold text-foreground">Record vendor bill</h2>
              <button
                type="button"
                onClick={() => setIsCreateBillOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-foreground/15 text-muted hover:bg-foreground/[0.06] hover:text-foreground"
                aria-label="Close modal"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <form action={handleCreateBill} className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-sm text-muted">Vendor name</label>
                <input name="vendorName" required className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-muted">Bill title</label>
                <input name="title" required className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm text-muted">Amount</label>
                  <input name="amount" inputMode="decimal" required className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground" />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-muted">Currency</label>
                  <UiSelect name="currency" defaultValue={financeOptions.currencies[0] || "NGN"}>
                    {financeOptions.currencies.map((currency) => (
                      <option key={currency} value={currency}>
                        {currency}
                      </option>
                    ))}
                  </UiSelect>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm text-muted">Due date (optional)</label>
                  <input name="dueDate" type="date" className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground" />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-muted">Department (optional)</label>
                  <UiSelect name="department" defaultValue="">
                    <option value="">Select department</option>
                    {financeOptions.departments.map((department) => (
                      <option key={department} value={department}>
                        {department}
                      </option>
                    ))}
                  </UiSelect>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm text-muted">Note (optional)</label>
                <input name="note" className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground" />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setIsCreateBillOpen(false)} className="rounded-md border border-foreground/15 px-4 py-2 text-sm text-foreground hover:bg-foreground/[0.06]">
                  Cancel
                </button>
                <button type="submit" disabled={actionPending} className="rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-50">
                  {actionPending ? "Saving..." : "Save bill"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {paymentBill ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-foreground/10 bg-background p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-semibold text-foreground">Pay vendor bill</h2>
              <button
                type="button"
                onClick={() => setPaymentBill(null)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-foreground/15 text-muted hover:bg-foreground/[0.06] hover:text-foreground"
                aria-label="Close modal"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <p className="mt-1 text-xs text-muted">
              {paymentBill.billNumber} — Balance: {paymentBill.balanceLabel}
            </p>
            <form action={handleRecordBillPayment} className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-sm text-muted">Amount</label>
                <input name="amount" inputMode="decimal" required className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-muted">Paid date</label>
                <input name="paidAt" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm text-muted">Payment method</label>
                  <UiSelect name="method" defaultValue={financeOptions.paymentModes[0] || ""}>
                    <option value="">Select method</option>
                    {financeOptions.paymentModes.map((mode) => (
                      <option key={mode} value={mode}>
                        {mode}
                      </option>
                    ))}
                  </UiSelect>
                </div>
                <div>
                  <label className="mb-1 block text-sm text-muted">Paid from account</label>
                  <UiSelect name="paidThroughAccount" defaultValue="">
                    <option value="">Select account</option>
                    {financeOptions.bankAccounts.map((account) => (
                      <option key={account} value={account}>
                        {account}
                      </option>
                    ))}
                  </UiSelect>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm text-muted">Reference (optional)</label>
                <input name="reference" className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground" />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setPaymentBill(null)} className="rounded-md border border-foreground/15 px-4 py-2 text-sm text-foreground hover:bg-foreground/[0.06]">
                  Cancel
                </button>
                <button type="submit" disabled={actionPending} className="rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-50">
                  {actionPending ? "Saving..." : "Record payment"}
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
                onClick={() => {
                  setPaymentAttachment(null);
                  setPaymentInvoice(null);
                }}
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
              <p className="rounded-md border border-foreground/10 bg-foreground/[0.02] px-3 py-2 text-[11px] text-muted">
                Payment method options come from{" "}
                <Link
                  href={`/${tenantSlug}/finance/settings`}
                  className="font-medium text-foreground underline decoration-foreground/30 underline-offset-2"
                >
                  Finance settings
                </Link>
                .
              </p>
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
                  <UiSelect
                    key={`pay-mode-${financeOptions.paymentModes.join("|")}`}
                    name="method"
                    defaultValue={financeOptions.paymentModes[0] || ""}
                  >
                    <option value="">Select mode</option>
                    {financeOptions.paymentModes.map((mode) => (
                      <option key={mode} value={mode}>
                        {mode}
                      </option>
                    ))}
                  </UiSelect>
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
                <label className="mb-1 block text-sm text-muted">Department (optional)</label>
                <UiSelect
                  name="department"
                  defaultValue={paymentInvoice.department || financeOptions.departments[0] || "Finance"}
                >
                  <option value="">Select department</option>
                  {financeOptions.departments.map((department) => (
                    <option key={department} value={department}>
                      {department}
                    </option>
                  ))}
                </UiSelect>
              </div>
              <div>
                <label className="mb-1 block text-sm text-muted">Note (optional)</label>
                <textarea
                  name="note"
                  rows={3}
                  className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-muted">Receipt attachment (optional)</label>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  disabled={uploadPending}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadPaymentAttachment(file);
                  }}
                  className="w-full border border-foreground/15 bg-field px-3 py-2 text-foreground file:mr-3 file:rounded file:border-0 file:bg-foreground file:px-2 file:py-1 file:text-xs file:font-semibold file:text-background"
                />
                <p className="mt-1 text-xs text-muted">
                  {paymentAttachment
                    ? `Attached: ${paymentAttachment.name}`
                    : uploadPending
                      ? "Uploading..."
                      : "If Cloudinary is not set yet, continue and add later."}
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPaymentAttachment(null);
                    setPaymentInvoice(null);
                  }}
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
                  <UiSelect name="currency" defaultValue={editingInvoice.currency || financeOptions.currencies[0] || "NGN"}>
                    {financeOptions.currencies.map((currency) => (
                      <option key={currency} value={currency}>
                        {currency}
                      </option>
                    ))}
                  </UiSelect>
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
              <div>
                <label className="mb-1 block text-sm text-muted">Department (optional)</label>
                <UiSelect
                  name="department"
                  defaultValue={editingInvoice.department || financeOptions.departments[0] || "Finance"}
                >
                  <option value="">Select department</option>
                  {financeOptions.departments.map((department) => (
                    <option key={department} value={department}>
                      {department}
                    </option>
                  ))}
                </UiSelect>
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
