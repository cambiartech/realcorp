import prisma from "@/lib/db";

/** Open dataset: all 37 states + 774 LGAs (official local government areas). */
export const NIGERIA_LGAS_SOURCE_URL = "https://temikeezy.github.io/nigeria-geojson-data/data/lgas.json";

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Maps UI / legacy labels to canonical state names in the dataset. */
export function resolveCanonicalStateName(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  const key = raw.toLowerCase();
  const aliases: Record<string, string> = {
    fct: "Federal Capital Territory",
    abuja: "Federal Capital Territory",
    "federal capital territory": "Federal Capital Territory",
    nasarawa: "Nassarawa",
  };
  if (aliases[key]) return aliases[key];
  return raw;
}

/** Friendly label for dropdowns (FCT instead of Federal Capital Territory). */
export function displayStateName(canonical: string): string {
  if (canonical === "Federal Capital Territory") return "FCT";
  if (canonical === "Nassarawa") return "Nasarawa";
  return canonical;
}

export function displayToCanonicalState(input: string): string {
  const resolved = resolveCanonicalStateName(input);
  if (!resolved) return input.trim();
  if (resolved.toLowerCase() === "fct") return "Federal Capital Territory";
  return resolved;
}

type LgasByState = Record<string, string[]>;

export async function syncNigeriaLocationsFromSource(force = false): Promise<{
  states: number;
  lgas: number;
  source: string;
}> {
  const existing = await prisma.nigeriaStateRef.count();
  if (existing > 0 && !force) {
    const lgaCount = await prisma.nigeriaLgaRef.count();
    return { states: existing, lgas: lgaCount, source: NIGERIA_LGAS_SOURCE_URL };
  }

  const res = await fetch(NIGERIA_LGAS_SOURCE_URL, { next: { revalidate: 0 } });
  if (!res.ok) {
    throw new Error(`Failed to fetch Nigeria LGAs (${res.status})`);
  }
  const payload = (await res.json()) as LgasByState;
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid Nigeria LGAs payload");
  }

  let totalLgas = 0;
  const stateNames = Object.keys(payload).sort((a, b) => a.localeCompare(b));

  await prisma.$transaction(async (tx) => {
    if (force) {
      await tx.nigeriaLgaRef.deleteMany();
      await tx.nigeriaStateRef.deleteMany();
    }

    for (const stateName of stateNames) {
      const lgas = [...new Set((payload[stateName] ?? []).map((n) => n.trim()).filter(Boolean))].sort(
        (a, b) => a.localeCompare(b),
      );
      totalLgas += lgas.length;

      const state = await tx.nigeriaStateRef.upsert({
        where: { slug: slugify(stateName) },
        create: {
          name: stateName,
          slug: slugify(stateName),
          lgaCount: lgas.length,
          sourceUrl: NIGERIA_LGAS_SOURCE_URL,
        },
        update: {
          name: stateName,
          lgaCount: lgas.length,
          sourceUrl: NIGERIA_LGAS_SOURCE_URL,
          syncedAt: new Date(),
        },
      });

      for (const lgaName of lgas) {
        await tx.nigeriaLgaRef.upsert({
          where: { stateId_slug: { stateId: state.id, slug: slugify(lgaName) } },
          create: { stateId: state.id, name: lgaName, slug: slugify(lgaName) },
          update: { name: lgaName },
        });
      }
    }
  });

  return { states: stateNames.length, lgas: totalLgas, source: NIGERIA_LGAS_SOURCE_URL };
}

export async function ensureNigeriaLocationsSynced(): Promise<void> {
  const count = await prisma.nigeriaStateRef.count();
  if (count === 0) {
    await syncNigeriaLocationsFromSource(false);
  }
}

export async function listNigeriaStatesFromDb(): Promise<string[]> {
  await ensureNigeriaLocationsSynced();
  const rows = await prisma.nigeriaStateRef.findMany({ orderBy: { name: "asc" } });
  return rows.map((r) => displayStateName(r.name));
}

export async function listNigeriaLgasFromDb(
  stateInput: string,
  query?: string,
): Promise<{
  state: string;
  cities: string[];
  total: number;
}> {
  await ensureNigeriaLocationsSynced();
  const canonical = displayToCanonicalState(stateInput);
  const stateRow = await prisma.nigeriaStateRef.findFirst({
    where: {
      OR: [{ name: { equals: canonical, mode: "insensitive" } }, { slug: slugify(canonical) }],
    },
  });
  if (!stateRow) {
    return { state: stateInput, cities: [], total: 0 };
  }

  const q = query?.trim();
  const lgas = await prisma.nigeriaLgaRef.findMany({
    where: {
      stateId: stateRow.id,
      ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
    },
    orderBy: { name: "asc" },
    take: q ? 50 : 500,
  });

  return {
    state: displayStateName(stateRow.name),
    cities: lgas.map((l) => l.name),
    total: stateRow.lgaCount,
  };
}
