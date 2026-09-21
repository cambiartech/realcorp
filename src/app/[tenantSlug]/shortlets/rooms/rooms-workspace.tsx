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
  OUT_OF_ORDER: "border-[var(--border-subtle)] bg-[var(--surface)]",
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
    <div className="rc-page !gap-5">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Clean & vacant" value={summary.vacantClean} tone="success" />
        <Stat label="Dirty & vacant" value={summary.vacantDirty} tone="warn" />
        <Stat label="Occupied" value={summary.occupied} tone="info" />
        <Stat label="Out of order" value={summary.outOfOrder} />
      </section>

      {rooms.length === 0 ? (
        <div className="rc-empty">
          <p className="rc-empty-title">No rooms yet</p>
          <p className="rc-empty-body">Add apartments under Short Lets → Apartments to populate the board.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {rooms.map((room) => (
            <article
              key={room.id}
              className={[
                "rounded-xl border p-4 shadow-sm",
                STATUS_STYLES[room.statusValue] || STATUS_STYLES.OUT_OF_ORDER,
                room.alertLevel === "overdue"
                  ? "ring-2 ring-[var(--danger-line)]"
                  : room.alertLevel === "due-soon"
                    ? "ring-2 ring-[var(--warn-line)]"
                    : "",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate text-[14px] font-semibold tracking-tight text-foreground">
                    {room.name}
                  </h3>
                  <p className="mt-0.5 truncate text-[12px] text-muted">
                    {room.propertyName ? `${room.propertyName} · ` : ""}
                    {room.location}
                  </p>
                </div>
                <span className="rc-pill rc-pill-neutral shrink-0 !text-[10px]">{room.status}</span>
              </div>
              {room.guestLabel ? (
                <p className="mt-2 text-[13px] font-medium text-foreground">{room.guestLabel}</p>
              ) : null}
              {room.checkoutLabel ? (
                <p
                  className={[
                    "mt-1 text-[12px]",
                    room.alertLevel === "overdue" ? "font-semibold text-[var(--danger)]" : "text-muted",
                  ].join(" ")}
                >
                  Checkout: {room.checkoutLabel}
                </p>
              ) : null}
              {canHousekeeping ? (
                <div className="mt-3">
                  <label className="block text-[12px] font-medium text-muted">
                    Assigned to
                    <UiSelect
                      className="mt-1 text-[13px]"
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
                <p className="mt-2 text-[12px] text-muted">Assigned: {room.assignedToLabel}</p>
              ) : null}
              {canHousekeeping && room.statusValue !== "OCCUPIED" ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {room.statusValue !== "VACANT_CLEAN" ? (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => setStatus(room.id, "VACANT_CLEAN")}
                      className="rc-btn rc-btn-primary rc-btn-sm"
                    >
                      Mark clean
                    </button>
                  ) : null}
                  {room.statusValue !== "VACANT_DIRTY" ? (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => setStatus(room.id, "VACANT_DIRTY")}
                      className="rc-btn rc-btn-secondary rc-btn-sm"
                    >
                      Mark dirty
                    </button>
                  ) : null}
                  {room.statusValue !== "OUT_OF_ORDER" ? (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => setStatus(room.id, "OUT_OF_ORDER")}
                      className="rc-btn rc-btn-ghost rc-btn-sm"
                    >
                      Out of order
                    </button>
                  ) : null}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "success" | "warn" | "info";
}) {
  const wash =
    tone === "success"
      ? "border-[var(--success-line)] bg-[var(--success-wash)]"
      : tone === "warn"
        ? "border-[var(--warn-line)] bg-[var(--warn-wash)]"
        : tone === "info"
          ? "border-[var(--info-line)] bg-[var(--info-wash)]"
          : "border-[var(--border-subtle)] bg-[var(--elevated)]";
  return (
    <div className={["rounded-xl border p-4 shadow-sm", wash].join(" ")}>
      <p className="rc-metric-label">{label}</p>
      <p className="rc-metric-value" data-zero={value === 0}>
        {value}
      </p>
    </div>
  );
}
