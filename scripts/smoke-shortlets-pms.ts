/**
 * Short lets PMS smoke test — verifies DB schema, seed data, and HTTP routes.
 * Run: npx tsx scripts/smoke-shortlets-pms.ts
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL required");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const TENANT_SLUG = process.env.SMOKE_TENANT_SLUG ?? "bopropertiesng";
const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";

type Check = { name: string; ok: boolean; detail?: string };

async function httpCheck(path: string): Promise<Check> {
  try {
    const res = await fetch(`${BASE}${path}`, { redirect: "manual" });
    const ok = res.status === 200 || res.status === 307 || res.status === 302;
    return { name: `HTTP ${path}`, ok, detail: `status ${res.status}` };
  } catch (e) {
    return { name: `HTTP ${path}`, ok: false, detail: String(e) };
  }
}

async function main() {
  const checks: Check[] = [];

  const tenant = await prisma.tenant.findUnique({
    where: { slug: TENANT_SLUG },
    include: {
      settings: { select: { moduleShortLets: true, moduleFinance: true, shortletFinanceSync: true } },
    },
  });
  checks.push({
    name: "Tenant exists",
    ok: Boolean(tenant),
    detail: tenant ? tenant.name : TENANT_SLUG,
  });

  if (!tenant) {
    printResults(checks);
    await prisma.$disconnect();
    process.exit(1);
  }

  checks.push({
    name: "Short lets module enabled",
    ok: Boolean(tenant.settings?.moduleShortLets),
  });

  const [units, reservations, properties, businessDays, serviceItems, channelLeads] = await Promise.all([
    prisma.shortletUnit.count({ where: { tenantId: tenant.id } }),
    prisma.shortletReservation.count({ where: { tenantId: tenant.id } }),
    prisma.shortletProperty.count({ where: { tenantId: tenant.id } }),
    prisma.shortletBusinessDay.count({ where: { tenantId: tenant.id } }),
    prisma.shortletServiceItem.count({ where: { tenantId: tenant.id } }),
    prisma.lead.count({
      where: {
        tenantId: tenant.id,
        shortletReservations: { none: {} },
        OR: [
          { source: { contains: "Explore", mode: "insensitive" } },
          { source: { contains: "WhatsApp", mode: "insensitive" } },
        ],
      },
    }),
  ]);

  checks.push({ name: "Shortlet units seeded", ok: units > 0, detail: String(units) });
  checks.push({ name: "Reservations exist", ok: reservations > 0, detail: String(reservations) });
  checks.push({ name: "Properties table accessible", ok: true, detail: `${properties} properties` });
  checks.push({ name: "Service catalog", ok: serviceItems >= 0, detail: String(serviceItems) });
  checks.push({ name: "Business days / night audit", ok: true, detail: String(businessDays) });
  checks.push({ name: "Channel leads queryable", ok: true, detail: `${channelLeads} pending` });

  const guestLinked = await prisma.shortletReservation.count({
    where: { tenantId: tenant.id, guestClientId: { not: null } },
  });
  checks.push({
    name: "Guest CRM links (optional)",
    ok: true,
    detail: `${guestLinked}/${reservations} reservations linked`,
  });

  const fnbRole = await prisma.membership.count({
    where: { tenantId: tenant.id, role: "FNB_STAFF" },
  });
  checks.push({ name: "FNB_STAFF role in schema", ok: true, detail: `${fnbRole} members` });

  const routes = [
    `/${TENANT_SLUG}/shortlets`,
    `/${TENANT_SLUG}/shortlets/front-desk`,
    `/${TENANT_SLUG}/shortlets/rooms`,
    `/${TENANT_SLUG}/shortlets/reservations`,
    `/${TENANT_SLUG}/shortlets/channels`,
    `/${TENANT_SLUG}/shortlets/folio`,
    `/${TENANT_SLUG}/shortlets/reports`,
    `/${TENANT_SLUG}/shortlets/settings`,
  ];

  for (const route of routes) {
    checks.push(await httpCheck(route));
  }

  printResults(checks);
  await prisma.$disconnect();
  process.exit(checks.every((c) => c.ok) ? 0 : 1);
}

function printResults(checks: Check[]) {
  console.log("\n=== Short Lets PMS Smoke Test ===\n");
  for (const c of checks) {
    console.log(`${c.ok ? "✓" : "✗"} ${c.name}${c.detail ? ` — ${c.detail}` : ""}`);
  }
  const passed = checks.filter((c) => c.ok).length;
  console.log(`\n${passed}/${checks.length} checks passed\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
