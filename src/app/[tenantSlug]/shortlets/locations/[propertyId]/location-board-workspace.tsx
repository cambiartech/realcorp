"use client";

import Link from "next/link";
import { useTransition } from "react";
import { ArrowLeft, BedDouble, Building2, ConciergeBell } from "lucide-react";
import { useSnackbar } from "@/components/snackbar";
import { UiSelect } from "@/components/ui-select";
import { assignHousekeeperToUnit, updateHousekeepingStatus } from "../../actions";

export type LocationBoardUnit = {
  id: string;
  name: string;
  floor: string;
  status: string;
  statusValue: string;
  guestLabel: string | null;
  checkoutLabel: string | null;
  alertLevel: "normal" | "due-soon" | "overdue" | null;
  assignedToUserId: string | null;
  nightlyRateLabel: string;
};

type Props = {
  tenantSlug: string;
  propertyId: string;
  locationName: string;
  locationCode: string;
  city: string;
  canHousekeeping: boolean;
  units: LocationBoardUnit[];
  summary: { vacantClean: number; vacantDirty: number; occupied: number; outOfOrder: number };
  teamOptions: Array<{ id: string; label: string }>;
};

const STATUS_STYLES: Record<string, string> = {
  VACANT_CLEAN: "border-[var(--success-line)] bg-[var(--success-wash)]",
  VACANT_DIRTY: "border-[var(--warn-line)] bg-[var(--warn-wash)]",
  OCCUPIED: "border-[var(--info-line)] bg-[var(--info-wash)]",
  OUT_OF_ORDER: "border-[var(--border-subtle)] bg-[var(--surface)]",
};

export function LocationBoardWorkspace({
  tenantSlug,
  propertyId,
  locationName,
  locationCode,
  city,
  canHousekeeping,
  units,
  summary,
  teamOptions,
}: Props) {
  const { showSnackbar } = useSnackbar();
  const [isPending, startTransition] = useTransition();
  const base = `/${tenantSlug}/shortlets`;

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
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`${base}/locations`}
            className="inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All locations
          </Link>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-foreground">{locationName}</h2>
          <p className="mt-1 text-sm text-muted">
            {[locationCode, city].filter(Boolean).join(" · ") || "Location board"}
            {" · "}
            {units.length} unit{units.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`${base}/apartments?location=${propertyId}`}
            className="inline-flex items-center gap-1.5 rounded-md border border-foreground/15 px-3 py-1.5 text-xs font-semibold"
          >
            <Building2 className="h-3.5 w-3.5" />
            Apartments
          </Link>
          <Link
            href={`${base}/rooms?location=${propertyId}`}
            className="inline-flex items-center gap-1.5 rounded-md border border-foreground/15 px-3 py-1.5 text-xs font-semibold"
          >
            <BedDouble className="h-3.5 w-3.5" />
            Full room board
          </Link>
          <Link
            href={`${base}/front-desk`}
            className="inline-flex items-center gap-1.5 rounded-md border border-foreground bg-foreground px-3 py-1.5 text-xs font-semibold text-background"
          >
            <ConciergeBell className="h-3.5 w-3.5" />
            Front desk
          </Link>
        </div>
      </div>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MiniStat label="Clean" value={summary.vacantClean} />
        <MiniStat label="Dirty" value={summary.vacantDirty} />
        <MiniStat label="Occupied" value={summary.occupied} />
        <MiniStat label="OOO" value={summary.outOfOrder} />
      </section>

      {units.length === 0 ? (
        <div className="rounded-lg border border-foreground/10 p-8 text-center">
          <p className="font-medium">No apartments at this location</p>
          <p className="mt-1 text-sm text-muted">Add units under Apartments and assign them here.</p>
          <Link
            href={`${base}/apartments?location=${propertyId}`}
            className="mt-4 inline-flex rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background"
          >
            Add apartment
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {units.map((unit) => (
            <article
              key={unit.id}
              className={[
                "rounded-lg border p-3",
                STATUS_STYLES[unit.statusValue] || STATUS_STYLES.OUT_OF_ORDER,
                unit.alertLevel === "overdue"
                  ? "ring-2 ring-[var(--danger-line)]"
                  : unit.alertLevel === "due-soon"
                    ? "ring-2 ring-[var(--warn-line)]"
                    : "",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-1">
                <div className="min-w-0">
                  <h3 className="truncate text-[13px] font-semibold text-foreground">{unit.name}</h3>
                  {unit.floor ? (
                    <p className="truncate text-[11px] text-muted">Floor {unit.floor}</p>
                  ) : null}
                </div>
                <span className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-foreground/70">
                  {unit.status}
                </span>
              </div>
              {unit.guestLabel ? (
                <p className="mt-1.5 truncate text-[12px] font-medium text-foreground">{unit.guestLabel}</p>
              ) : (
                <p className="mt-1.5 text-[11px] text-muted">{unit.nightlyRateLabel}/night</p>
              )}
              {unit.checkoutLabel ? (
                <p
                  className={[
                    "mt-0.5 text-[11px]",
                    unit.alertLevel === "overdue" ? "font-semibold text-[var(--danger)]" : "text-muted",
                  ].join(" ")}
                >
                  Out {unit.checkoutLabel}
                </p>
              ) : null}
              {canHousekeeping ? (
                <div className="mt-2 space-y-1.5">
                  <UiSelect
                    className="!py-1 text-[11px]"
                    value={unit.statusValue === "OCCUPIED" ? "" : unit.statusValue}
                    disabled={isPending || unit.statusValue === "OCCUPIED"}
                    onChange={(e) => {
                      const v = e.target.value as "VACANT_CLEAN" | "VACANT_DIRTY" | "OUT_OF_ORDER";
                      if (v) setStatus(unit.id, v);
                    }}
                  >
                    <option value="" disabled>
                      {unit.statusValue === "OCCUPIED" ? "Occupied" : "Set status"}
                    </option>
                    <option value="VACANT_CLEAN">Clean</option>
                    <option value="VACANT_DIRTY">Dirty</option>
                    <option value="OUT_OF_ORDER">Out of order</option>
                  </UiSelect>
                  <UiSelect
                    className="!py-1 text-[11px]"
                    value={unit.assignedToUserId || ""}
                    disabled={isPending}
                    onChange={(e) => assign(unit.id, e.target.value)}
                  >
                    <option value="">Unassigned</option>
                    {teamOptions.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </UiSelect>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-foreground/10 px-3 py-2">
      <p className="text-[11px] text-muted">{label}</p>
      <p className="text-lg font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}
