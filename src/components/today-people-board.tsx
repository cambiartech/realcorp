export type TodayBoardView = {
  birthdays: Array<{ name: string; department: string }>;
  anniversaries: Array<{ name: string; department: string; years: number }>;
  holidays: Array<{ name: string; tentative: boolean }>;
};

const SERIF = "'Iowan Old Style', Palatino, 'Palatino Linotype', Georgia, serif";

function titleCaseToken(token: string) {
  if (token !== token.toUpperCase()) return token;
  return token.charAt(0) + token.slice(1).toLowerCase();
}

function displayName(raw: string) {
  return raw
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(titleCaseToken)
    .join(" ");
}

/** Surname-first records are stored in capitals: ESENWA IFEOMA PAULINE → Ifeoma. */
function greetingName(raw: string) {
  const parts = raw.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return raw;
  const shouting = raw.trim() === raw.trim().toUpperCase();
  const token = shouting && parts.length >= 2 ? parts[1] : parts[0];
  return titleCaseToken(token);
}

function Balloons() {
  return (
    <svg
      width="148"
      height="84"
      viewBox="0 0 240 128"
      aria-hidden="true"
      className="shrink-0"
    >
      <g fill="none" stroke="#c9c2b6" strokeWidth="1.15" strokeLinecap="round">
        <path d="M78 96c6 8 22 18 42 24" />
        <path d="M120 104v18" />
        <path d="M162 96c-6 8-22 18-42 24" />
      </g>
      <g transform="translate(46 14) rotate(-16 32 42)">
        <path fill="#c4a484" d="M32 2C14 4 2 26 6 52c3 18 14 28 26 36 12-8 24-18 28-36C66 24 50 0 32 2z" />
        <ellipse fill="#ffffff" opacity="0.34" cx="18" cy="24" rx="7" ry="11" transform="rotate(-18 18 24)" />
        <path fill="#a8663c" d="M27 86h10l-5 7z" />
      </g>
      <g transform="translate(146 16) rotate(14 32 42)">
        <path
          fill="#16150f"
          stroke="#efe8df"
          strokeWidth="2.2"
          d="M32 0C14 2 2 24 6 50c3 18 14 28 26 36 12-8 24-18 28-36C66 22 50-2 32 0z"
        />
        <ellipse fill="#ffffff" opacity="0.16" cx="18" cy="22" rx="6" ry="10" transform="rotate(-16 18 22)" />
        <path fill="#16150f" stroke="#efe8df" strokeWidth="1.2" d="M27 84h10l-5 7z" />
      </g>
      <g transform="translate(88 0)">
        <path fill="#a8663c" d="M32 0C12 2-2 28 4 58c4 20 16 30 28 40 12-10 26-20 30-40C70 26 52-2 32 0z" />
        <ellipse fill="#ffffff" opacity="0.26" cx="18" cy="26" rx="8" ry="13" transform="rotate(-20 18 26)" />
        <path fill="#7a4a2c" d="M26 96h12l-6 8z" />
      </g>
    </svg>
  );
}

function CelebrationCard({
  kicker,
  heading,
  lines,
}: {
  kicker: string;
  heading: string;
  lines: string[];
}) {
  return (
    <article className="rc-card overflow-hidden sm:col-span-2">
      <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:px-6">
        <Balloons />
        <div className="min-w-0">
          <p className="text-[12.5px] font-semibold tracking-[0.04em] text-[var(--accent)]">{kicker}</p>
          <h2
            className="mt-1 text-[28px] leading-[1.15] font-medium tracking-[-0.02em] text-foreground"
            style={{ fontFamily: SERIF }}
          >
            {heading}
          </h2>
          {lines.map((line) => (
            <p key={line} className="mt-2 text-[14.5px] leading-relaxed text-muted">
              {line}
            </p>
          ))}
        </div>
      </div>
    </article>
  );
}

function QuietChip({ title, people }: { title: string; people: string[] }) {
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

  const birthdayHeading =
    board.birthdays.length === 1
      ? `Happy birthday, ${greetingName(board.birthdays[0].name)}`
      : "Happy birthday";
  const birthdayLines =
    board.birthdays.length === 1
      ? [
          board.birthdays[0].department
            ? `Thank you for the care you give ${board.birthdays[0].department}. It is the kind of work the rest of us rely on.`
            : "Thank you for the care you give this place. It is the kind of work the rest of us rely on.",
          displayName(board.birthdays[0].name),
        ]
      : board.birthdays.map((person) =>
          person.department ? `${displayName(person.name)} · ${person.department}` : displayName(person.name),
        );

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {hasBirthdays ? (
        <CelebrationCard kicker="Birthday" heading={birthdayHeading} lines={birthdayLines} />
      ) : null}
      {board.anniversaries.map((person) => {
        const years = person.years === 1 ? "one year" : `${person.years} years`;
        return (
          <CelebrationCard
            key={`${person.name}-${person.years}`}
            kicker="Anniversary"
            heading={`Happy anniversary, ${greetingName(person.name)}`}
            lines={[
              `${years.charAt(0).toUpperCase()}${years.slice(1)} with us. That is worth celebrating.`,
              displayName(person.name),
            ]}
          />
        );
      })}
      {hasHolidays ? (
        <QuietChip
          title="Public holiday"
          people={board.holidays.map((holiday) => (holiday.tentative ? `${holiday.name} (tentative)` : holiday.name))}
        />
      ) : null}
    </section>
  );
}
