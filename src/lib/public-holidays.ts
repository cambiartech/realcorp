/** Free public holidays by country — Nager.Date, no API key. https://date.nager.at */

export type PublicHolidayEvent = {
  externalId: string;
  name: string;
  date: string;
};

type NagerHoliday = {
  date?: string;
  localName?: string;
  name?: string;
  types?: string[];
};

function holidayName(item: NagerHoliday) {
  return (item.localName || item.name || "").trim();
}

export function publicHolidayExternalId(countryCode: string, date: string, name: string) {
  return `nager:${countryCode}:${date}:${name}`.slice(0, 180);
}

export async function fetchPublicHolidays(input: {
  countryCode: string;
  year: number;
}): Promise<{ ok: true; events: PublicHolidayEvent[] } | { ok: false; error: string }> {
  const countryCode = input.countryCode.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(countryCode)) {
    return { ok: false, error: "Invalid country code." };
  }
  const url = `https://date.nager.at/api/v3/PublicHolidays/${input.year}/${countryCode}`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      if (res.status === 404) {
        return { ok: false, error: `No public-holiday calendar for ${countryCode}.` };
      }
      return { ok: false, error: `Public holiday API ${res.status}` };
    }
    const payload = (await res.json()) as NagerHoliday[];
    const events: PublicHolidayEvent[] = [];
    for (const item of Array.isArray(payload) ? payload : []) {
      const date = (item.date || "").slice(0, 10);
      const name = holidayName(item);
      if (!date || !name) continue;
      events.push({
        externalId: publicHolidayExternalId(countryCode, date, name),
        name: name.slice(0, 160),
        date,
      });
    }
    return { ok: true, events };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not reach the public holiday calendar." };
  }
}

export async function fetchPublicHolidaysForRange(input: {
  countryCode: string;
  fromYear: number;
  toYear: number;
}): Promise<{ ok: true; events: PublicHolidayEvent[] } | { ok: false; error: string }> {
  const years: number[] = [];
  for (let year = input.fromYear; year <= input.toYear; year += 1) years.push(year);
  const batches = await Promise.all(years.map((year) => fetchPublicHolidays({ countryCode: input.countryCode, year })));
  const events: PublicHolidayEvent[] = [];
  for (const batch of batches) {
    if (!batch.ok) return batch;
    events.push(...batch.events);
  }
  return { ok: true, events };
}
