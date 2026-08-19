import prisma from "@/lib/db";
import { nigeriaCityOptions, nigeriaStateOptions } from "@/lib/nigeria-locations";

const CSC_DATA_CDN =
  "https://cdn.jsdelivr.net/npm/@countrystatecity/countries@1.0.9/dist/data";

type CountryRow = { code: string; name: string; emoji?: string };
type StateRow = { code: string; name: string; type?: string | null };
type CityRow = { id: number; name: string };

const MEMORY_TTL_MS = 24 * 60 * 60 * 1000;
const DB_WAIT_MS = 1_200;

const memory = new Map<string, { at: number; value: unknown }>();

function memoryGet<T>(key: string): T | null {
  const hit = memory.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > MEMORY_TTL_MS) {
    memory.delete(key);
    return null;
  }
  return hit.value as T;
}

function memorySet(key: string, value: unknown) {
  memory.set(key, { at: Date.now(), value });
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error("LOCATION_DB_TIMEOUT")), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function fetchCscJson<T>(path: string): Promise<T> {
  const response = await fetch(`${CSC_DATA_CDN}/${path}`, {
    headers: { Accept: "application/json" },
    next: { revalidate: 86400 },
  });
  if (!response.ok) {
    throw new Error(`Location catalog request failed (${response.status}).`);
  }
  return (await response.json()) as T;
}

function nigeriaStates(): StateRow[] {
  return nigeriaStateOptions();
}

function nigeriaCities(stateInput: string): CityRow[] {
  return nigeriaCityOptions(stateInput);
}

const NG_COUNTRY: CountryRow = { code: "NG", name: "Nigeria", emoji: "🇳🇬" };

export async function listCatalogCountries(): Promise<CountryRow[]> {
  const cached = memoryGet<CountryRow[]>("countries");
  if (cached?.length) return cached;

  try {
    const rows = await withTimeout(
      prisma.countryRef.findMany({
        orderBy: { name: "asc" },
        select: { code: true, name: true, emoji: true },
      }),
      DB_WAIT_MS,
    );
    const items = rows.map((row) => ({
      code: row.code,
      name: row.name,
      emoji: row.emoji || undefined,
    }));
    if (items.length) {
      memorySet("countries", items);
      return items;
    }
  } catch {
    // Paused or slow DB — keep the form usable for Nigeria without waiting.
  }

  return [NG_COUNTRY];
}

export async function listLocationStates(countryCode: string): Promise<StateRow[]> {
  if (countryCode === "NG") return nigeriaStates();

  const cacheKey = `states:${countryCode}`;
  const cached = memoryGet<StateRow[]>(cacheKey);
  if (cached) return cached;

  try {
    const rows = await withTimeout(
      prisma.countryStateRef.findMany({
        where: { countryCode },
        orderBy: { name: "asc" },
        select: { code: true, name: true, type: true },
      }),
      DB_WAIT_MS,
    );
    const items = rows.map((row) => ({
      code: row.code,
      name: row.name,
      type: row.type,
    }));
    memorySet(cacheKey, items);
    return items;
  } catch {
    return [];
  }
}

export async function listLocationCities(countryCode: string, stateCode: string): Promise<CityRow[]> {
  if (countryCode === "NG") return nigeriaCities(stateCode);

  try {
    const country = await withTimeout(
      prisma.countryRef.findUnique({
        where: { code: countryCode },
        select: { catalogDir: true },
      }),
      DB_WAIT_MS,
    );
    if (!country?.catalogDir) return [];

    const state = await withTimeout(
      prisma.countryStateRef.findFirst({
        where: {
          countryCode,
          OR: [
            { code: { equals: stateCode, mode: "insensitive" } },
            { name: { equals: stateCode, mode: "insensitive" } },
          ],
        },
        select: { catalogDir: true },
      }),
      DB_WAIT_MS,
    );
    if (!state?.catalogDir) return [];

    const rows = await fetchCscJson<Array<{ id?: number; name?: string }>>(
      `${country.catalogDir}/${state.catalogDir}/cities.json`,
    );
    return rows
      .map((row, index) => ({
        id: typeof row.id === "number" ? row.id : index + 1,
        name: String(row.name || "").trim(),
      }))
      .filter((row) => row.name)
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}
