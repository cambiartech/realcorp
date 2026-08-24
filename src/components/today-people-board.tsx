export type TodayBoardView = {
  birthdays: Array<{ name: string; department: string }>;
  anniversaries: Array<{ name: string; department: string; years: number }>;
  holidays: Array<{ name: string; tentative: boolean }>;
};

function Chip({
  emoji,
  title,
  people,
  tone,
}: {
  emoji: string;
  title: string;
  people: string[];
  tone: "rose" | "teal" | "amber";
}) {
  const wash =
    tone === "rose"
      ? "border-rose-200/80 bg-gradient-to-br from-rose-50 to-amber-50 dark:from-rose-950/40 dark:to-amber-950/20"
      : tone === "teal"
        ? "border-teal-200/80 bg-gradient-to-br from-teal-50 to-indigo-50 dark:from-teal-950/40 dark:to-indigo-950/20"
        : "border-amber-200/80 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/20";
  return (
    <div className={`rounded-xl border px-4 py-3 ${wash}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
        {emoji} {title}
      </p>
      <p className="mt-1 text-sm font-semibold text-foreground">{people.join(" · ")}</p>
    </div>
  );
}

export function TodayPeopleBoard({ board }: { board: TodayBoardView }) {
  const hasBirthdays = board.birthdays.length > 0;
  const hasAnniversaries = board.anniversaries.length > 0;
  const hasHolidays = board.holidays.length > 0;
  if (!hasBirthdays && !hasAnniversaries && !hasHolidays) return null;

  return (
    <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {hasBirthdays ? (
        <Chip
          emoji="🎂"
          title={board.birthdays.length === 1 ? "Birthday today" : "Birthdays today"}
          people={board.birthdays.map((p) => (p.department ? `${p.name} (${p.department})` : p.name))}
          tone="rose"
        />
      ) : null}
      {hasAnniversaries ? (
        <Chip
          emoji="✨"
          title={board.anniversaries.length === 1 ? "Work anniversary today" : "Work anniversaries today"}
          people={board.anniversaries.map((p) => {
            const years = p.years === 1 ? "1 year" : `${p.years} years`;
            return p.department ? `${p.name} · ${years} (${p.department})` : `${p.name} · ${years}`;
          })}
          tone="teal"
        />
      ) : null}
      {hasHolidays ? (
        <Chip
          emoji="📅"
          title="Public holiday"
          people={board.holidays.map((h) => (h.tentative ? `${h.name} (tentative)` : h.name))}
          tone="amber"
        />
      ) : null}
    </section>
  );
}
