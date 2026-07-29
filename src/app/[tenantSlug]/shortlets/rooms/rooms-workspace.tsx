"use client";

import { useTransition } from "react";
import { useSnackbar } from "@/components/snackbar";
import { UiSelect } from "@/components/ui-select";
import { assignHousekeeperToUnit, updateHousekeepingStatus } from "../actions";

type Room = {
  id: string;
  name: string;
  propertyName: string | null;
  location: string;
  status: string;
  statusValue: string;
  guestLabel: string | null;
  checkoutLabel: string | null;
  alertLevel: "normal" | "due-soon" | "overdue" | null;
  assignedToUserId: string | null;
  assignedToLabel: string | null;
};

type Props = {
  tenantSlug: string;
  canHousekeeping: boolean;
  rooms: Room[];
  summary: { vacantClean: number; vacantDirty: number; occupied: number; outOfOrder: number };
  teamOptions: Array<{ id: string; label: string }>;
};

const STATUS_STYLES: Record<string, string> = {
  VACANT_CLEAN: "border-[var(--success-line)] bg-[var(--success-wash)]",
  VACANT_DIRTY: "border-[var(--warn-line)] bg-[var(--warn-wash)]",
  OCCUPIED: "border-[var(--info-line)] bg-[var(--info-wash)]",
  OUT_OF_ORDER: "border-foreground/20 bg-foreground/[0.04]",
};

export function RoomsWorkspace({ tenantSlug, canHousekeeping, rooms, summary, teamOptions }: Props) {
  const { showSnackbar } = useSnackbar();
  const [isPending, startTransition] = useTransition();

  function setStatus(unitId: string, status: "VACANT_CLEAN" | "VACANT_DIRTY" | "OUT_OF_ORDER") {
    startTransition(async () => {
      const res = await updateHousekeepingStatus(tenantSlug, { unitId, status });
      if (res.ok) showSnackbar("Room updated.", "success");
      else showSnackbar(res.error || "Could not update.", "error");
    });
  }

  function assign(unitId: string, userId: string) {
    startTransition(async () => {
      const res = await assignHousekeeperToUnit(tenantSlug, { unitId, userId: userId || undefined });
      if (res.ok) showSnackbar("Housekeeper assigned.", "success");
      else showSnackbar(res.error || "Could not assign.", "error");
    });
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Clean & vacant" value={summary.vacantClean} />
        <Stat label="Dirty & vacant" value={summary.vacantDirty} />
        <Stat label="Occupied" value={summary.occupied} />
        <Stat label="Out of order" value={summary.outOfOrder} />
      </section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {rooms.map((room) => (
          <article
            key={room.id}
            className={[
              "rounded-lg border p-4",
              STATUS_STYLES[room.statusValue] || STATUS_STYLES.OUT_OF_ORDER,
              room.alertLevel === "overdue"
                ? "ring-2 ring-[var(--danger-line)]"
                : room.alertLevel === "due-soon"
                  ? "ring-2 ring-[var(--warn-line)]"
                  : "",
            ].join(" ")}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-foreground">{room.name}</h3>
                <p className="text-xs text-muted">
                  {room.propertyName ? `${room.propertyName} · ` : ""}
                  {room.location}
                </p>
              </div>
              <span className="rounded-full border border-foreground/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                {room.status}
              </span>
            </div>
            {room.guestLabel ? <p className="mt-2 text-sm">{room.guestLabel}</p> : null}
            {room.checkoutLabel ? (
              <p
                className={[
                  "mt-1 text-xs",
                  room.alertLevel === "overdue" ? "font-semibold text-[var(--danger)]" : "text-muted",
                ].join(" ")}
              >
                Checkout: {room.checkoutLabel}
              </p>
            ) : null}
            {canHousekeeping ? (
              <div className="mt-3">
                <label className="text-[11px] text-muted">
                  Assigned to
                  <UiSelect
                    className="mt-1 text-xs"
                    value={room.assignedToUserId || ""}
                    onChange={(e) => assign(room.id, e.target.value)}
                    disabled={isPending}
                  >
                    <option value="">Unassigned</option>
                    {teamOptions.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </UiSelect>
                </label>
              </div>
            ) : room.assignedToLabel ? (
              <p className="mt-2 text-xs text-muted">Assigned: {room.assignedToLabel}</p>
            ) : null}
            {canHousekeeping && room.statusValue !== "OCCUPIED" ? (
              <div className="mt-3 flex flex-wrap gap-1">
                {room.statusValue !== "VACANT_CLEAN" ? (
                  <ActionBtn disabled={isPending} onClick={() => setStatus(room.id, "VACANT_CLEAN")}>
                    Mark clean
                  </ActionBtn>
                ) : null}
                {room.statusValue !== "VACANT_DIRTY" ? (
                  <ActionBtn disabled={isPending} onClick={() => setStatus(room.id, "VACANT_DIRTY")}>
                    Mark dirty
                  </ActionBtn>
                ) : null}
                {room.statusValue !== "OUT_OF_ORDER" ? (
                  <ActionBtn disabled={isPending} onClick={() => setStatus(room.id, "OUT_OF_ORDER")}>
                    Out of order
                  </ActionBtn>
                ) : null}
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-foreground/10 p-4">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
    </div>
  );
}

function ActionBtn({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded border border-foreground/15 px-2 py-1 text-[11px] hover:bg-foreground/[0.06] disabled:opacity-50"
    >
      {children}
    </button>
  );
}
