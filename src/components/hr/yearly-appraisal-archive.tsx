"use client";

import { useMemo, useState } from "react";
import { Archive } from "lucide-react";

export type YearlyArchiveEntry = {
  cycleId: string;
  periodLabel: string;
  status: string;
  dueDateLabel: string;
  closedLabel: string;
  appraisals: Array<{
    id: string;
    employeeName: string;
    position: string;
    department: string;
    overallRating: number | null;
    managerNotes: string;
    selfNotes: string;
    reviewedAtLabel: string;
    reviewerLabel: string;
  }>;
};

export function YearlyAppraisalArchive({ entries }: { entries: YearlyArchiveEntry[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(entries[0]?.cycleId ?? null);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
      (e) =>
        e.periodLabel.toLowerCase().includes(q) ||
        e.appraisals.some((a) => a.employeeName.toLowerCase().includes(q)),
    );
  }, [entries, search]);

  if (entries.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-foreground/15 p-8 text-center text-sm text-muted">
        <Archive className="mx-auto mb-2 h-8 w-8 opacity-40" />
        No signed-off yearly reviews yet. Close a yearly period after manager reviews are complete — completed
        reviews appear here.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <input
        type="search"
        placeholder="Search period or employee…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full max-w-sm rounded-md border border-foreground/15 bg-field px-3 py-2 text-sm"
      />
      <ul className="space-y-2">
        {filtered.map((entry) => {
          const reviewed = entry.appraisals.filter((a) => a.reviewedAtLabel !== "—");
          const avgRating =
            reviewed.length > 0
              ? (
                  reviewed.reduce((s, a) => s + (a.overallRating ?? 0), 0) /
                  reviewed.filter((a) => a.overallRating != null).length
                ).toFixed(1)
              : "—";

          return (
            <li key={entry.cycleId} className="rounded-xl border border-foreground/10 overflow-hidden">
              <button
                type="button"
                onClick={() => setExpandedId(expandedId === entry.cycleId ? null : entry.cycleId)}
                className="flex w-full flex-wrap items-center justify-between gap-2 bg-foreground/[0.02] px-4 py-3 text-left"
              >
                <div>
                  <p className="font-semibold text-foreground">{entry.periodLabel}</p>
                  <p className="text-xs text-muted">
                    {reviewed.length} signed off · Avg rating {avgRating} · Closed {entry.closedLabel}
                  </p>
                </div>
                <span className="rounded-full bg-[var(--success-wash)] px-2 py-0.5 text-[10px] font-semibold uppercase text-[var(--success)]">
                  Archive
                </span>
              </button>
              {expandedId === entry.cycleId ? (
                <div className="overflow-x-auto border-t border-foreground/10">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-foreground/10 bg-foreground/[0.03] text-xs uppercase text-muted">
                        <th className="px-4 py-2">Employee</th>
                        <th className="px-4 py-2">Dept</th>
                        <th className="px-4 py-2">Rating</th>
                        <th className="px-4 py-2">Signed off</th>
                        <th className="px-4 py-2">Reviewer</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entry.appraisals.map((a) => (
                        <tr key={a.id} className="border-b border-foreground/10 last:border-0 align-top">
                          <td className="px-4 py-3">
                            <p className="font-medium">{a.employeeName}</p>
                            <p className="text-xs text-muted">{a.position}</p>
                            {a.managerNotes ? (
                              <p className="mt-1 text-xs text-muted line-clamp-2">
                                Manager: {a.managerNotes}
                              </p>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 text-muted">{a.department || "—"}</td>
                          <td className="px-4 py-3">
                            {a.overallRating != null ? `${a.overallRating}/5` : "—"}
                          </td>
                          <td className="px-4 py-3 text-muted">{a.reviewedAtLabel}</td>
                          <td className="px-4 py-3 text-muted">{a.reviewerLabel}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
