"use client";

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, (m || 1) - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export type CalendarEvent = {
  id: string;
  guestName: string;
  unitName: string;
  checkIn: string;
  checkOut: string;
  status: string;
};

type Props = {
  month: string;
  events: CalendarEvent[];
  onMonthChange?: (month: string) => void;
  onSelectReservation?: (reservationId: string) => void;
  onSelectDay?: (date: string) => void;
};

export function ReservationsCalendar({
  month,
  events,
  onMonthChange,
  onSelectReservation,
  onSelectDay,
}: Props) {
  const [y, m] = month.split("-").map(Number);
  const firstDay = new Date(y, (m || 1) - 1, 1);
  const totalDays = daysInMonth(y, (m || 1) - 1);
  const startOffset = firstDay.getDay();
  const monthLabel = new Intl.DateTimeFormat("en-NG", { month: "long", year: "numeric" }).format(firstDay);

  const cells: Array<{
    day: number | null;
    dateStr: string | null;
    events: CalendarEvent[];
  }> = [];
  for (let i = 0; i < startOffset; i += 1) cells.push({ day: null, dateStr: null, events: [] });
  for (let d = 1; d <= totalDays; d += 1) {
    const dayStr = `${month}-${String(d).padStart(2, "0")}`;
    const dayEvents = events.filter((e) => e.checkIn <= dayStr && e.checkOut >= dayStr);
    cells.push({ day: d, dateStr: dayStr, events: dayEvents });
  }

  return (
    <div className="rounded-lg border border-foreground/10 p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold">{monthLabel}</h3>
        {onMonthChange ? (
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => onMonthChange(shiftMonth(month, -1))}
              className="rounded border border-foreground/15 px-2 py-1 text-xs hover:bg-foreground/[0.06]"
            >
              ← Prev
            </button>
            <button
              type="button"
              onClick={() => onMonthChange(shiftMonth(month, 1))}
              className="rounded border border-foreground/15 px-2 py-1 text-xs hover:bg-foreground/[0.06]"
            >
              Next →
            </button>
          </div>
        ) : null}
      </div>
      <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs text-muted">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="py-1 font-medium">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, idx) => (
          <div
            key={idx}
            role={cell.dateStr && onSelectDay ? "button" : undefined}
            tabIndex={cell.dateStr && onSelectDay ? 0 : undefined}
            onClick={cell.dateStr && onSelectDay ? () => onSelectDay(cell.dateStr!) : undefined}
            onKeyDown={
              cell.dateStr && onSelectDay
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") onSelectDay(cell.dateStr!);
                  }
                : undefined
            }
            className={[
              "min-h-[80px] rounded border p-1 text-left text-[10px]",
              cell.day ? "border-foreground/10 bg-background" : "border-transparent",
              cell.dateStr && onSelectDay
                ? "cursor-pointer hover:border-foreground/25 hover:bg-foreground/[0.03]"
                : "",
            ].join(" ")}
          >
            {cell.day ? <div className="font-semibold text-foreground">{cell.day}</div> : null}
            {cell.events.slice(0, 3).map((e) => (
              <button
                key={`${e.id}-${cell.dateStr}`}
                type="button"
                onClick={(ev) => {
                  ev.stopPropagation();
                  onSelectReservation?.(e.id);
                }}
                className="mt-0.5 block w-full truncate rounded bg-foreground/10 px-1 py-0.5 text-left transition-colors hover:bg-foreground hover:text-background"
                title={`${e.guestName} · ${e.unitName} · ${e.status}`}
              >
                {e.unitName}
              </button>
            ))}
            {cell.events.length > 3 ? (
              <button
                type="button"
                onClick={(ev) => {
                  ev.stopPropagation();
                  if (cell.events[3]) onSelectReservation?.(cell.events[3].id);
                }}
                className="mt-0.5 text-muted underline hover:text-foreground"
              >
                +{cell.events.length - 3} more
              </button>
            ) : null}
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted">
        Click a booking to open the guest bill. Click an empty day to start a new reservation. Short-lets run
        every day — this calendar is occupancy only.
      </p>
    </div>
  );
}
