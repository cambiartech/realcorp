import prisma from "@/lib/db";
import { NIGERIA_CITIES_BY_STATE, NIGERIA_STATES } from "@/lib/nigeria-locations";
import { listNigeriaLgasFromDb, listNigeriaStatesFromDb } from "@/lib/nigeria-locations-sync";

const CSC_DATA_CDN =
  "https://cdn.jsdelivr.net/npm/@countrystatecity/countries@1.0.9/dist/data";

type CountryRow = { code: string; name: string; emoji?: string };
type StateRow = { code: string; name: string; type?: string | null };
type CityRow = { id: number; name: string };

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

function nigeriaStateFallback(): StateRow[] {
  return NIGERIA_STATES.map((name) => ({ code: name, name, type: "state" }));
}

export async function listCatalogCountries(): Promise<CountryRow[]> {
  const rows = await prisma.countryRef.findMany({
    orderBy: { name: "asc" },
    select: { code: true, name: true, emoji: true },
  });
  return rows.map((row) => ({
    code: row.code,
    name: row.name,
    emoji: row.emoji || undefined,
  }));
}

export async function listLocationStates(countryCode: string): Promise<StateRow[]> {
  if (countryCode === "NG") {
    try {
      const names = await listNigeriaStatesFromDb();
      if (names.length > 0) {
        return names.map((name) => ({ code: name, name, type: "state" }));
      }
    } catch {
      // Use the static Nigerian state list — never a world country catalog.
    }
    return nigeriaStateFallback();
  }

  const rows = await prisma.countryStateRef.findMany({
    where: { countryCode },
    orderBy: { name: "asc" },
    select: { code: true, name: true, type: true },
  });
  return rows.map((row) => ({
    code: row.code,
    name: row.name,
    type: row.type,
  }));
}

export async function listLocationCities(countryCode: string, stateCode: string): Promise<CityRow[]> {
  if (countryCode === "NG") {
    try {
      const fromDb = await listNigeriaLgasFromDb(stateCode);
      if (fromDb.cities.length > 0) {
        return fromDb.cities.map((name, index) => ({ id: index + 1, name }));
      }
    } catch {
      // Fall through to the static city list for that state.
    }
    const fallback = NIGERIA_CITIES_BY_STATE[stateCode] || [];
    return fallback
      .filter((name) => name && name !== "Other")
      .map((name, index) => ({ id: index + 1, name }));
  }

  const country = await prisma.countryRef.findUnique({
    where: { code: countryCode },
    select: { catalogDir: true },
  });
  if (!country?.catalogDir) return [];

  const state = await prisma.countryStateRef.findFirst({
    where: {
      countryCode,
      OR: [
        { code: { equals: stateCode, mode: "insensitive" } },
        { name: { equals: stateCode, mode: "insensitive" } },
      ],
    },
    select: { catalogDir: true },
  });
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
}
