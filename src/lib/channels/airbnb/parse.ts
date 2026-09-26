export type AirbnbListingDraft = {
  id: string;
  name: string;
  description?: string;
  city?: string;
  country?: string;
  address?: string;
  neighbourhood?: string;
  currency?: string;
  nightlyPrice?: number;
  bedrooms?: number;
  bathrooms?: number;
  maxGuests?: number;
  amenities: string[];
  photoUrls: string[];
  active: boolean;
};

export type AirbnbBusyRange = { uid: string; start: string; end: string; summary?: string };

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function text(row: Record<string, unknown> | null, keys: string[]): string | undefined {
  if (!row) return undefined;
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

function numberOf(row: Record<string, unknown> | null, keys: string[]): number | undefined {
  if (!row) return undefined;
  for (const key of keys) {
    const value = row[key];
    const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return undefined;
}

function httpsList(value: unknown): string[] {
  const rows = Array.isArray(value) ? value : [];
  const urls: string[] = [];
  for (const item of rows) {
    const row = asRecord(item);
    const candidate = row
      ? text(row, ["url", "large_url", "extra_medium_url", "thumbnail_url", "picture_url", "src"])
      : typeof item === "string"
        ? item
        : undefined;
    if (candidate?.startsWith("https://")) urls.push(candidate);
  }
  return urls;
}

function amenityList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      if (typeof item === "string") return [item.toLowerCase()];
      const row = asRecord(item);
      const name = text(row, ["name", "type", "key"]);
      return name ? [name.toLowerCase()] : [];
    });
  }
  const row = asRecord(value);
  if (!row) return [];
  return Object.entries(row)
    .filter(([, present]) => present === true || asRecord(present)?.is_present === true)
    .map(([name]) => name.toLowerCase());
}

export function listingDraftsFrom(json: unknown): AirbnbListingDraft[] {
  const root = asRecord(json);
  const lists = [
    root?.listings,
    root?.listing,
    asRecord(root?.data)?.listings,
    Array.isArray(json) ? json : null,
  ];
  const rows = lists.find((list) => Array.isArray(list)) as unknown[] | undefined;
  const singles = root?.listing && !Array.isArray(root.listing) ? [root.listing] : [];
  const source = rows || (singles.length ? singles : root?.id || root?.listing_id ? [root] : []);
  return source.flatMap((item) => {
    const row = asRecord(item);
    if (!row) return [];
    const id = text(row, ["id", "listing_id", "listingId"]);
    const name = text(row, ["name", "listing_name", "title", "listing_nickname"]);
    if (!id || !name) return [];
    const pricing = asRecord(row.pricing_settings) || asRecord(row.pricing) || row;
    const address = asRecord(row.address) || asRecord(row.location) || row;
    const status = (text(row, ["status", "listing_status"]) || "active").toLowerCase();
    return [
      {
        id,
        name: name.slice(0, 160),
        description: text(row, ["description", "summary", "space", "notes"])?.slice(0, 8000),
        city: text(address, ["city", "locality"]),
        country: text(address, ["country", "country_code"]),
        address: text(address, ["street", "address", "address_line", "formatted_address"])?.slice(0, 200),
        neighbourhood: text(address, ["neighborhood", "neighbourhood", "area"]),
        currency: text(pricing, ["currency", "listing_currency"])?.toUpperCase(),
        nightlyPrice: numberOf(pricing, ["default_daily_price", "nightly_price", "price", "base_price", "daily_price"]),
        bedrooms: numberOf(row, ["bedrooms", "bedroom_count"]),
        bathrooms: numberOf(row, ["bathrooms", "bathroom_count"]),
        maxGuests: numberOf(row, ["person_capacity", "max_guests", "guests_included", "accommodates"]),
        amenities: amenityList(row.amenities),
        photoUrls: [
          ...httpsList(row.photos),
          ...httpsList(row.listing_photos),
          ...httpsList(row.images),
          ...httpsList(row.picture_urls),
        ].slice(0, 40),
        active: status !== "inactive" && status !== "unlisted" && status !== "deleted",
      },
    ];
  });
}

function day(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1];
}

function addDay(iso: string): string {
  const date = new Date(`${iso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

/** Busy nights from a calendar or reservation payload. Checkout day is exclusive. */
export function busyRangesFrom(json: unknown): AirbnbBusyRange[] {
  const root = asRecord(json);
  const days = [root?.calendar, root?.days, root?.calendars, asRecord(root?.data)?.days].find((list) =>
    Array.isArray(list),
  ) as unknown[] | undefined;
  const reserved = new Set<string>();
  if (days) {
    for (const item of days) {
      const row = asRecord(item);
      const date = day(text(row, ["date", "day"]));
      if (!date || !row) continue;
      const available = row.available ?? row.availability;
      const closed = available === false || available === "unavailable" || row.closed === true;
      if (closed) reserved.add(date);
    }
  }
  const ranges: AirbnbBusyRange[] = [];
  const sorted = [...reserved].sort();
  let start = "";
  let previous = "";
  for (const date of sorted) {
    if (!start) {
      start = date;
      previous = date;
      continue;
    }
    if (addDay(previous) === date) {
      previous = date;
      continue;
    }
    ranges.push({ uid: `cal:${start}:${addDay(previous)}`, start, end: addDay(previous) });
    start = date;
    previous = date;
  }
  if (start) ranges.push({ uid: `cal:${start}:${addDay(previous)}`, start, end: addDay(previous) });

  const reservations = [root?.reservations, asRecord(root?.data)?.reservations].find((list) =>
    Array.isArray(list),
  ) as unknown[] | undefined;
  if (reservations) {
    for (const item of reservations) {
      const row = asRecord(item);
      const id = text(row, ["confirmation_code", "id", "reservation_id"]);
      const startDate = day(text(row, ["start_date", "check_in", "checkin"]));
      const endDate = day(text(row, ["end_date", "check_out", "checkout"]));
      const status = (text(row, ["status"]) || "").toLowerCase();
      if (!id || !startDate || !endDate) continue;
      if (status.includes("cancel") || status.includes("deny")) continue;
      const guest = text(row, ["guest_first_name", "guest_name"]);
      ranges.push({
        uid: `res:${id}`,
        start: startDate,
        end: endDate,
        summary: guest ? `Airbnb · ${guest}` : "Airbnb",
      });
    }
  }
  return ranges;
}

export function tokenFieldsFrom(json: unknown): {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
  userId?: string;
} {
  const root = asRecord(json);
  const accessToken = text(root, ["access_token", "accessToken"]);
  const refreshToken = text(root, ["refresh_token", "refreshToken"]);
  const userId = text(root, ["user_id", "user_id_str", "userId"]);
  const expires = root?.expires_at ?? root?.expires_in;
  let expiresAt: Date | undefined;
  if (typeof expires === "number") {
    expiresAt = expires > 10_000_000_000 ? new Date(expires) : expires > 10_000_000 ? new Date(expires * 1000) : new Date(Date.now() + expires * 1000);
  } else if (typeof expires === "string" && expires.trim()) {
    const parsed = new Date(expires);
    if (!Number.isNaN(parsed.getTime())) expiresAt = parsed;
  }
  return { accessToken, refreshToken, expiresAt, userId };
}

export function listingIdFromWebhook(json: unknown): string | undefined {
  const root = asRecord(json);
  const nested = asRecord(root?.listing) || asRecord(root?.reservation) || asRecord(root?.payload) || root;
  return text(nested, ["listing_id", "listingId", "id"]);
}
