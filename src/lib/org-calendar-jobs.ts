import { EmployeeProfileStatus } from "@/generated/prisma";
import prisma from "@/lib/db";
import { celebratesOn, completedYears, sentOnKey } from "@/lib/celebration-dates";
import { anniversaryCampaignHtml, birthdayCampaignHtml } from "@/lib/celebration-email-templates";
import { sendCelebrationEmail } from "@/lib/email";
import { parseLeaveDate } from "@/lib/hr-leave";
import { fetchPublicHolidaysForRange } from "@/lib/public-holidays";

export type TodayPerson = {
  name: string;
  department: string;
};

export type TodayAnniversary = TodayPerson & { years: number };

export type TodayHoliday = {
  name: string;
  tentative: boolean;
};

export type TodayBoard = {
  birthdays: TodayPerson[];
  anniversaries: TodayAnniversary[];
  holidays: TodayHoliday[];
};

function firstName(fullName: string) {
  const part = fullName.trim().split(/\s+/)[0];
  return part || fullName;
}

function profileName(fullName: string | null, fallback: string | null) {
  return (fullName || fallback || "Teammate").trim();
}

export async function loadTodayBoard(tenantId: string, today = new Date()): Promise<TodayBoard> {
  const dayStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const dayEnd = new Date(dayStart);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  const [profiles, holidays] = await Promise.all([
    prisma.employeeProfile.findMany({
      where: {
        tenantId,
        status: EmployeeProfileStatus.ACTIVE,
        OR: [{ dateOfBirth: { not: null } }, { dateOfJoining: { not: null } }],
      },
      select: {
        fullName: true,
        department: true,
        dateOfBirth: true,
        dateOfJoining: true,
        userId: true,
      },
      take: 800,
    }),
    prisma.hrHoliday.findMany({
      where: { tenantId, date: { gte: dayStart, lt: dayEnd } },
      select: { name: true, tentative: true },
      orderBy: { name: "asc" },
      take: 20,
    }),
  ]);

  const userIds = [...new Set(profiles.map((p) => p.userId))];
  const users =
    userIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true },
        })
      : [];
  const userName = new Map(users.map((u) => [u.id, u.name]));

  const birthdays: TodayPerson[] = [];
  const anniversaries: TodayAnniversary[] = [];
  for (const profile of profiles) {
    const name = profileName(profile.fullName, userName.get(profile.userId) ?? null);
    const department = profile.department || "";
    if (profile.dateOfBirth && celebratesOn(profile.dateOfBirth, today)) {
      birthdays.push({ name, department });
    }
    if (profile.dateOfJoining && celebratesOn(profile.dateOfJoining, today)) {
      const years = completedYears(profile.dateOfJoining, today);
      if (years >= 1) anniversaries.push({ name, department, years });
    }
  }

  return {
    birthdays,
    anniversaries,
    holidays: holidays.map((h) => ({ name: h.name, tentative: h.tentative })),
  };
}

export async function sendTodayCelebrationEmails(tenantId: string, companyName: string, today = new Date()) {
  const sentOn = sentOnKey(today);
  const profiles = await prisma.employeeProfile.findMany({
    where: {
      tenantId,
      status: EmployeeProfileStatus.ACTIVE,
      OR: [{ dateOfBirth: { not: null } }, { dateOfJoining: { not: null } }],
    },
    select: {
      id: true,
      userId: true,
      fullName: true,
      workEmail: true,
      dateOfBirth: true,
      dateOfJoining: true,
    },
    take: 800,
  });
  const userIds = [...new Set(profiles.map((p) => p.userId))];
  const users =
    userIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, email: true, name: true },
        })
      : [];
  const userById = new Map(users.map((u) => [u.id, u]));

  let sent = 0;
  let skipped = 0;
  for (const profile of profiles) {
    const user = userById.get(profile.userId);
    const email = (profile.workEmail || user?.email || "").trim();
    const name = profileName(profile.fullName, user?.name ?? null);
    const kinds: Array<{ kind: "BIRTHDAY" | "ANNIVERSARY"; years?: number }> = [];
    if (profile.dateOfBirth && celebratesOn(profile.dateOfBirth, today)) kinds.push({ kind: "BIRTHDAY" });
    if (profile.dateOfJoining && celebratesOn(profile.dateOfJoining, today)) {
      const years = completedYears(profile.dateOfJoining, today);
      if (years >= 1) kinds.push({ kind: "ANNIVERSARY", years });
    }
    for (const item of kinds) {
      if (!email) {
        skipped += 1;
        continue;
      }
      const already = await prisma.celebrationSendLog.findUnique({
        where: {
          tenantId_employeeProfileId_kind_sentOn: {
            tenantId,
            employeeProfileId: profile.id,
            kind: item.kind,
            sentOn,
          },
        },
        select: { id: true },
      });
      if (already) {
        skipped += 1;
        continue;
      }
      const html =
        item.kind === "BIRTHDAY"
          ? birthdayCampaignHtml({ companyName, firstName: firstName(name) })
          : anniversaryCampaignHtml({
              companyName,
              firstName: firstName(name),
              years: item.years || 1,
            });
      const subject =
        item.kind === "BIRTHDAY"
          ? `Happy Birthday from ${companyName}`
          : `Happy ${item.years}-year anniversary from ${companyName}`;
      const result = await sendCelebrationEmail({
        to: email,
        subject,
        html,
        fromName: companyName,
      });
      if (!result.ok) {
        skipped += 1;
        continue;
      }
      await prisma.celebrationSendLog.create({
        data: {
          tenantId,
          employeeProfileId: profile.id,
          kind: item.kind,
          sentOn,
        },
      });
      sent += 1;
    }
  }
  return { sent, skipped };
}

export async function syncPublicHolidaysForTenant(input: {
  tenantId: string;
  countryCode: string;
  today?: Date;
}) {
  const today = input.today || new Date();
  const fromYear = today.getUTCFullYear();
  const fetched = await fetchPublicHolidaysForRange({
    countryCode: input.countryCode,
    fromYear,
    toYear: fromYear + 1,
  });
  if (!fetched.ok) return { ok: false as const, error: fetched.error, upserted: 0 };

  let upserted = 0;
  const countryCode = input.countryCode.trim().toUpperCase();
  for (const event of fetched.events) {
    let date: Date;
    try {
      date = parseLeaveDate(event.date);
    } catch {
      continue;
    }
    const existingSynced = await prisma.hrHoliday.findFirst({
      where: { tenantId: input.tenantId, googleEventId: event.externalId },
      select: { id: true },
    });
    if (existingSynced) {
      await prisma.hrHoliday.update({
        where: { id: existingSynced.id },
        data: { name: event.name, date, countryCode, tentative: true, source: "PUBLIC" },
      });
      upserted += 1;
      continue;
    }
    const clash = await prisma.hrHoliday.findFirst({
      where: { tenantId: input.tenantId, date, countryCode, regionCode: null },
      select: { id: true, source: true },
    });
    if (clash) {
      if (clash.source === "MANUAL") continue;
      await prisma.hrHoliday.update({
        where: { id: clash.id },
        data: { name: event.name, googleEventId: event.externalId, tentative: true, source: "PUBLIC" },
      });
      upserted += 1;
      continue;
    }
    try {
      await prisma.hrHoliday.create({
        data: {
          tenantId: input.tenantId,
          date,
          name: event.name,
          countryCode,
          regionCode: null,
          source: "PUBLIC",
          tentative: true,
          googleEventId: event.externalId,
        },
      });
      upserted += 1;
    } catch {
      // Unique clash under concurrent sync — skip.
    }
  }
  return { ok: true as const, upserted };
}

/** @deprecated Use syncPublicHolidaysForTenant */
export const syncGoogleHolidaysForTenant = syncPublicHolidaysForTenant;

export async function runOrgCalendarJobs(today = new Date()) {
  const tenants = await prisma.tenant.findMany({
    select: {
      id: true,
      name: true,
      settings: { select: { payrollCountryCode: true, moduleHr: true } },
    },
    take: 200,
  });
  const summary = { tenants: tenants.length, emailsSent: 0, holidaysUpserted: 0, errors: [] as string[] };
  for (const tenant of tenants) {
    try {
      const mail = await sendTodayCelebrationEmails(tenant.id, tenant.name, today);
      summary.emailsSent += mail.sent;
    } catch (error) {
      summary.errors.push(`${tenant.name}: ${error instanceof Error ? error.message : "email job failed"}`);
    }
    const country = tenant.settings?.payrollCountryCode || "NG";
    try {
      const holidays = await syncPublicHolidaysForTenant({
        tenantId: tenant.id,
        countryCode: country,
        today,
      });
      if (holidays.ok) summary.holidaysUpserted += holidays.upserted;
      else if (holidays.error) {
        summary.errors.push(`${tenant.name}: ${holidays.error}`);
      }
    } catch (error) {
      summary.errors.push(`${tenant.name}: ${error instanceof Error ? error.message : "holiday sync failed"}`);
    }
  }
  return summary;
}
