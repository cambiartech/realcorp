"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { useSnackbar } from "@/components/snackbar";
import { UiSelect } from "@/components/ui-select";
import { setEmployeeTaskManagers } from "@/app/[tenantSlug]/hr/actions";

type Candidate = { userId: string; label: string };

type Props = {
  tenantSlug: string;
  employeeUserId: string;
  employeeName: string;
  initialManagers: Candidate[];
  candidates: Candidate[];
};

export function EmployeeTaskManagersEditor({
  tenantSlug,
  employeeUserId,
  employeeName,
  initialManagers,
  candidates,
}: Props) {
  const { showSnackbar } = useSnackbar();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [managers, setManagers] = useState(initialManagers);
  const [pickId, setPickId] = useState("");

  const available = useMemo(() => {
    const taken = new Set(managers.map((m) => m.userId));
    return candidates.filter((c) => c.userId !== employeeUserId && !taken.has(c.userId));
  }, [candidates, managers, employeeUserId]);

  function persist(next: Candidate[]) {
    setManagers(next);
    startTransition(async () => {
      const res = await setEmployeeTaskManagers(tenantSlug, {
        employeeUserId,
        managerUserIds: next.map((m) => m.userId),
      });
      if (!res.ok) {
        showSnackbar(res.error || "Could not save managers.", "error");
        setManagers(initialManagers);
        return;
      }
      showSnackbar("Task managers updated.", "success");
      router.refresh();
    });
  }

  function addManager() {
    if (!pickId) return;
    const person = candidates.find((c) => c.userId === pickId);
    if (!person) return;
    setPickId("");
    persist([...managers, person]);
  }

  function removeManager(userId: string) {
    persist(managers.filter((m) => m.userId !== userId));
  }

  return (
    <div className="sm:col-span-2 rounded-lg border border-foreground/10 bg-foreground/[0.02] p-3">
      <p className="text-xs font-medium text-foreground">Task managers (cross-department)</p>
      <p className="mt-1 text-[11px] text-muted">
        These people can assign Tasks to {employeeName || "this employee"} even if they work in
        another department — e.g. a Sales teammate assigning Front Desk. Separate from Department
        lead. Saving managers also creates a draft People record if one does not exist yet.
      </p>

      {managers.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {managers.map((m) => (
            <span
              key={m.userId}
              className="inline-flex items-center gap-1 rounded-full border border-foreground/15 bg-background px-2.5 py-1 text-[11px] font-medium"
            >
              {m.label}
              <button
                type="button"
                disabled={pending}
                onClick={() => removeManager(m.userId)}
                className="rounded p-0.5 text-muted hover:bg-foreground/10 hover:text-foreground disabled:opacity-40"
                aria-label={`Remove ${m.label}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-[11px] text-muted">No cross-department managers yet.</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <UiSelect
          className="min-w-[200px] flex-1 text-sm"
          value={pickId}
          disabled={pending || available.length === 0}
          onChange={(e) => setPickId(e.target.value)}
        >
          <option value="">Add a manager…</option>
          {available.map((c) => (
            <option key={c.userId} value={c.userId}>
              {c.label}
            </option>
          ))}
        </UiSelect>
        <button
          type="button"
          disabled={pending || !pickId}
          onClick={addManager}
          className="rounded-md border border-foreground/15 px-3 py-2 text-xs font-semibold disabled:opacity-40"
        >
          Add
        </button>
      </div>
    </div>
  );
}
