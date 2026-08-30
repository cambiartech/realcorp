"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSnackbar } from "@/components/snackbar";
import { ButtonSpinner } from "@/components/button-spinner";
import { UiSelect } from "@/components/ui-select";
import {
  assignMarketingEntry,
  pushAllMarketingEntriesToSales,
  pushMarketingEntryToSales,
} from "../actions";

type EntryRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  source: string;
  campaign: string;
  assignedUserId: string;
  createdAt: string;
};

export function MarketingEntriesWorkspace({
  tenantSlug,
  routingIsHold,
  entries,
  teamMembers,
  canEdit,
}: {
  tenantSlug: string;
  routingIsHold: boolean;
  entries: EntryRow[];
  teamMembers: Array<{ id: string; label: string }>;
  canEdit: boolean;
}) {
  const router = useRouter();
  const { showSnackbar } = useSnackbar();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [owners, setOwners] = useState<Record<string, string>>(() =>
    Object.fromEntries(entries.map((entry) => [entry.id, entry.assignedUserId])),
  );

  async function run(id: string, work: () => Promise<{ ok: boolean; error?: string; count?: number }>, okMessage: string) {
    setPendingId(id);
    const result = await work();
    setPendingId(null);
    if (!result.ok) {
      showSnackbar(result.error || "Could not update that entry.", "error");
      return;
    }
    showSnackbar(okMessage, "success");
    router.refresh();
  }

  return (
    <div className="w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Marketing</p>
          <h1 className="mt-1 text-2xl font-bold text-foreground">Entries</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            {routingIsHold
              ? "New form and ad submissions wait here until Marketing assigns them and pushes them to Sales."
              : "This organization sends marketing inbound straight to Sales Leads. Switch the funnel on Marketing → Settings if you want a hold step."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/${tenantSlug}/marketing/settings`}
            className="rounded-md border border-foreground/15 px-3 py-2 text-sm font-semibold text-foreground hover:bg-foreground/[0.06]"
          >
            Funnel settings
          </Link>
          {canEdit && entries.length > 0 ? (
            <button
              type="button"
              disabled={pendingId === "__all__"}
              onClick={() =>
                void run(
                  "__all__",
                  () => pushAllMarketingEntriesToSales(tenantSlug),
                  "All waiting entries were pushed to Sales Leads.",
                )
              }
              className="rounded-md border border-foreground bg-foreground px-3 py-2 text-sm font-semibold text-background disabled:opacity-50"
            >
              {pendingId === "__all__" ? "Pushing…" : "Push all to Sales"}
            </button>
          ) : null}
        </div>
      </div>

      {entries.length === 0 ? (
        <p className="mt-8 rounded-lg border border-foreground/10 bg-field px-4 py-8 text-sm text-muted">
          No marketing entries waiting. New holds appear here when the funnel is set to review first.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-foreground/10">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-foreground/[0.03] text-[11px] font-semibold uppercase tracking-wide text-muted">
              <tr>
                <th className="px-3 py-2">Person</th>
                <th className="px-3 py-2">Source</th>
                <th className="px-3 py-2">Campaign</th>
                <th className="px-3 py-2">Received</th>
                <th className="px-3 py-2">Assign</th>
                <th className="px-3 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-t border-foreground/10">
                  <td className="px-3 py-3">
                    <p className="font-medium text-foreground">{entry.name || "Unnamed"}</p>
                    <p className="text-xs text-muted">{[entry.email, entry.phone].filter(Boolean).join(" · ") || "—"}</p>
                  </td>
                  <td className="px-3 py-3 text-muted">{entry.source || "—"}</td>
                  <td className="px-3 py-3 text-muted">{entry.campaign || "—"}</td>
                  <td className="px-3 py-3 text-muted">{entry.createdAt}</td>
                  <td className="px-3 py-3">
                    <UiSelect
                      value={owners[entry.id] ?? ""}
                      disabled={!canEdit || pendingId === entry.id}
                      onChange={(event) => {
                        const next = event.target.value;
                        setOwners((current) => ({ ...current, [entry.id]: next }));
                        if (canEdit) {
                          void run(
                            entry.id,
                            () => assignMarketingEntry(tenantSlug, entry.id, next),
                            "Owner updated.",
                          );
                        }
                      }}
                    >
                      <option value="">Unassigned</option>
                      {teamMembers.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.label}
                        </option>
                      ))}
                    </UiSelect>
                  </td>
                  <td className="px-3 py-3 text-right">
                    {canEdit ? (
                      <button
                        type="button"
                        disabled={pendingId === entry.id}
                        onClick={() =>
                          void run(
                            entry.id,
                            () => pushMarketingEntryToSales(tenantSlug, entry.id, owners[entry.id]),
                            "Pushed to Sales Leads.",
                          )
                        }
                        className="inline-flex items-center gap-1.5 rounded-md border border-foreground bg-foreground px-3 py-1.5 text-xs font-semibold text-background disabled:opacity-50"
                      >
                        {pendingId === entry.id ? <ButtonSpinner /> : null}
                        Push to Sales
                      </button>
                    ) : (
                      <span className="text-xs text-muted">View only</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
