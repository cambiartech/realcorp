export type FinanceRecordsFilterState = {
  q: string;
  projectId: string;
  unitId: string;
  department: string;
  /** Inclusive lower bound; empty = no min */
  amountMin: string;
  /** Inclusive upper bound; empty = no max (use for “≤ amount”) */
  amountMax: string;
  dateFrom: string;
  dateTo: string;
  category: string;
  method: string;
  status: string;
};

export const EMPTY_FINANCE_RECORDS_FILTER: FinanceRecordsFilterState = {
  q: "",
  projectId: "all",
  unitId: "all",
  department: "all",
  amountMin: "",
  amountMax: "",
  dateFrom: "",
  dateTo: "",
  category: "all",
  method: "all",
  status: "all",
};

export type FinanceRecordsFilterRow = {
  amountValue: number;
  /** YYYY-MM-DD when available */
  dateValue?: string;
  projectId?: string;
  unitId?: string;
  department?: string;
  category?: string;
  method?: string;
  statusValue?: string;
  statusLabel?: string;
  searchText: string;
};

export function financeRecordsFilterIsActive(filter: FinanceRecordsFilterState) {
  return (
    filter.q.trim() !== "" ||
    filter.projectId !== "all" ||
    filter.unitId !== "all" ||
    filter.department !== "all" ||
    filter.amountMin.trim() !== "" ||
    filter.amountMax.trim() !== "" ||
    filter.dateFrom.trim() !== "" ||
    filter.dateTo.trim() !== "" ||
    filter.category !== "all" ||
    filter.method !== "all" ||
    filter.status !== "all"
  );
}

function parseAmountBound(raw: string): number | null {
  const cleaned = raw.replace(/,/g, "").trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Compare YYYY-MM-DD strings safely. */
function dateInRange(dateValue: string | undefined, from: string, to: string) {
  if (!from && !to) return true;
  const day = (dateValue || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}

export function matchesFinanceRecordsFilter(
  row: FinanceRecordsFilterRow,
  filter: FinanceRecordsFilterState,
) {
  const q = filter.q.trim().toLowerCase();
  if (q && !row.searchText.toLowerCase().includes(q)) return false;

  if (filter.projectId !== "all" && (row.projectId || "") !== filter.projectId) {
    return false;
  }
  if (filter.unitId !== "all" && (row.unitId || "") !== filter.unitId) {
    return false;
  }
  if (
    filter.department !== "all" &&
    (row.department || "") !== filter.department
  ) {
    return false;
  }
  if (filter.category !== "all" && (row.category || "") !== filter.category) {
    return false;
  }
  if (filter.method !== "all" && (row.method || "") !== filter.method) {
    return false;
  }
  if (filter.status !== "all") {
    const status = (row.statusValue || row.statusLabel || "").toLowerCase();
    if (status !== filter.status.toLowerCase()) return false;
  }

  const min = parseAmountBound(filter.amountMin);
  const max = parseAmountBound(filter.amountMax);
  if (min != null && row.amountValue < min) return false;
  if (max != null && row.amountValue > max) return false;

  if (!dateInRange(row.dateValue, filter.dateFrom.trim(), filter.dateTo.trim())) {
    return false;
  }

  return true;
}

export function filterFinanceRecords<T>(
  rows: T[],
  filter: FinanceRecordsFilterState,
  mapRow: (row: T) => FinanceRecordsFilterRow,
) {
  if (!financeRecordsFilterIsActive(filter)) return rows;
  return rows.filter((row) => matchesFinanceRecordsFilter(mapRow(row), filter));
}
