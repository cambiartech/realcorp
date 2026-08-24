export function isLeapYear(year: number) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function utcMonthDay(date: Date) {
  return { month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

/** Birthday / anniversary match in UTC date parts. Feb 29 observes on 28 Feb in non-leap years. */
export function celebratesOn(eventDate: Date, today: Date) {
  const event = utcMonthDay(eventDate);
  const now = utcMonthDay(today);
  if (event.month === now.month && event.day === now.day) return true;
  if (
    event.month === 2 &&
    event.day === 29 &&
    now.month === 2 &&
    now.day === 28 &&
    !isLeapYear(today.getUTCFullYear())
  ) {
    return true;
  }
  return false;
}

export function completedYears(start: Date, today: Date) {
  let years = today.getUTCFullYear() - start.getUTCFullYear();
  const monthNotReached = today.getUTCMonth() < start.getUTCMonth();
  const sameMonthEarlierDay = today.getUTCMonth() === start.getUTCMonth() && today.getUTCDate() < start.getUTCDate();
  if (monthNotReached || sameMonthEarlierDay) years -= 1;
  return Math.max(0, years);
}

export function sentOnKey(today: Date) {
  return today.toISOString().slice(0, 10);
}
