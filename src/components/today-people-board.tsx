export type TodayBoardView = {
  birthdays: Array<{ name: string; department: string }>;
  anniversaries: Array<{ name: string; department: string; years: number }>;
  holidays: Array<{ name: string; tentative: boolean }>;
};

function Chip({
  title,
  people,
}: {
  title: string;
  people: string[];
}) {
  return (
    <div className="rc-card px-4 py-3.5">
      <p className="text-[12.5px] font-medium text-muted">{title}</p>
      <p className="mt-1 text-[13.5px] font-semibold tracking-tight text-foreground">{people.join(" · ")}</p>
    </div>
  );
}

export function TodayPeopleBoard({ board }: { board: TodayBoardView }) {
  const hasBirthdays = board.birthdays.length > 0;
  const hasAnniversaries = board.anniversaries.length > 0;
  const hasHolidays = board.holidays.length > 0;
  if (!hasBirthdays && !hasAnniversaries && !hasHolidays) return null;

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {hasBirthdays ? (
        <Chip
          title={board.birthdays.length === 1 ? "Birthday today" : "Birthdays today"}
          people={board.birthdays.map((p) => (p.department ? `${p.name} (${p.department})` : p.name))}
        />
      ) : null}
      {hasAnniversaries ? (
        <Chip
          title={board.anniversaries.length === 1 ? "Work anniversary today" : "Work anniversaries today"}
          people={board.anniversaries.map((p) => {
            const years = p.years === 1 ? "1 year" : `${p.years} years`;
            return p.department ? `${p.name} · ${years} (${p.department})` : `${p.name} · ${years}`;
          })}
        />
      ) : null}
      {hasHolidays ? (
        <Chip
          title="Public holiday"
          people={board.holidays.map((h) => (h.tentative ? `${h.name} (tentative)` : h.name))}
        />
      ) : null}
    </section>
  );
}
