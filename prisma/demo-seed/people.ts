import {
  EmployeeProfileStatus,
  HrAppraisalCycleStatus,
  HrAppraisalCycleType,
  HrAppraisalStatus,
  HrOfferLetterStatus,
  HrPayslipPaymentStatus,
  HrPayslipRunStatus,
} from "../../src/generated/prisma";
import { DEFAULT_APPRAISAL_CRITERIA } from "../../src/lib/appraisal-competencies";
import { daysAgo, daysFromNow } from "./helpers";
import type { DemoSeedContext } from "./types";

const EMPLOYEES = [
  { key: "amaka", name: "Amaka Okonkwo", email: "dev+1@bopropertiesng.com", dept: "Sales", position: "Sales Executive", gross: "450000", status: EmployeeProfileStatus.ACTIVE },
  { key: "finance-lead", name: "Finance Lead", email: "finance@bopropertiesng.com", dept: "Finance", position: "Finance Manager", gross: "650000", status: EmployeeProfileStatus.ACTIVE },
  { key: "hr-lead", name: "Chioma Nwachukwu", email: "hr@bopropertiesng.com", dept: "HR", position: "HR Manager", gross: "580000", status: EmployeeProfileStatus.ACTIVE },
  { key: "ops", name: "Ibrahim Musa", email: "ibrahim.musa@demo.boproperties.ng", dept: "Operations", position: "Site Supervisor", gross: "380000", status: EmployeeProfileStatus.ACTIVE },
  { key: "mkt", name: "Kemi Adeyemi", email: "kemi.adeyemi@demo.boproperties.ng", dept: "Marketing", position: "Marketing Lead", gross: "520000", status: EmployeeProfileStatus.ACTIVE },
  { key: "legal", name: "David Okafor", email: "david.okafor@demo.boproperties.ng", dept: "Legal", position: "Legal Counsel", gross: "720000", status: EmployeeProfileStatus.ACTIVE },
  { key: "community", name: "Blessing Eze", email: "blessing.eze@demo.boproperties.ng", dept: "Community", position: "Community Manager", gross: "410000", status: EmployeeProfileStatus.ACTIVE },
  { key: "newhire", name: "Tolu Adebanjo", email: "tolu.adebanjo@demo.boproperties.ng", dept: "Sales", position: "Sales Associate", gross: "320000", status: EmployeeProfileStatus.DRAFT },
  { key: "exit", name: "Former Staff", email: "former.staff@demo.boproperties.ng", dept: "Operations", position: "Admin Assistant", gross: "280000", status: EmployeeProfileStatus.EXITED },
] as const;

export async function seedPeople(ctx: DemoSeedContext) {
  const { prisma, tenantId, users } = ctx;
  console.log("  [people] employee profiles, payslips, appraisals, goals…");

  await prisma.tenantSettings.update({
    where: { tenantId },
    data: { moduleHr: true },
  });

  const emailToUserId: Record<string, string> = {
    [users.salesUser.email]: users.salesUser.id,
    [users.financeUser.email]: users.financeUser.id,
    [users.hrUser.email]: users.hrUser.id,
    [users.orgAdmin.email]: users.orgAdmin.id,
  };

  const profiles = [];
  for (let ei = 0; ei < EMPLOYEES.length; ei += 1) {
    const row = EMPLOYEES[ei];
    let userId = emailToUserId[row.email];
    if (!userId) {
      const user = await prisma.user.upsert({
        where: { email: row.email },
        create: {
          email: row.email,
          name: row.name,
          emailVerified: new Date(),
        },
        update: { name: row.name },
      });
      userId = user.id;
    }

    const profileId = `${tenantId}-emp-${row.key}`;
    const profile = await prisma.employeeProfile.upsert({
      where: { tenantId_userId: { tenantId, userId } },
      create: {
        id: profileId,
        tenantId,
        userId,
        employeeNumber: `EMP-${row.key.toUpperCase().slice(0, 4)}`,
        status: row.status,
        fullName: row.name,
        workEmail: row.email,
        department: row.dept,
        position: row.position,
        dateOfJoining: daysAgo(200 + ei * 30),
        employmentType: "Full-time",
        grossMonthly: row.gross,
        payeeTaxMonthly: String(Math.round(Number(row.gross) * 0.08)),
        phoneMobile: "+234 803 000 0000",
        addressCity: "Lagos",
        addressState: "Lagos",
      },
      update: { status: row.status, department: row.dept, position: row.position },
    });
    profiles.push(profile);
  }

  const newHire = profiles.find((p) => p.id.includes("newhire"));
  if (newHire) {
    await prisma.hrOfferLetter.upsert({
      where: { employeeProfileId: newHire.id },
      create: {
        tenantId,
        employeeProfileId: newHire.id,
        bodyHtml: `<p>Dear Tolu,</p><p>We are pleased to offer you the position of Sales Associate at Bo Properties Nigeria.</p><p>Start date: ${daysFromNow(14).toDateString()}</p>`,
        status: HrOfferLetterStatus.AWAITING_SIGNATURE,
        token: `${tenantId}-offer-tolu-demo`,
        tokenExpiresAt: daysFromNow(30),
      },
      update: { status: HrOfferLetterStatus.AWAITING_SIGNATURE },
    });
  }

  const criteriaCount = await prisma.hrAppraisalAction.count({ where: { tenantId } });
  if (criteriaCount === 0) {
    await prisma.hrAppraisalAction.createMany({
      data: DEFAULT_APPRAISAL_CRITERIA.map((c) => ({
        tenantId,
        title: c.title,
        description: c.description,
        cycleType: c.cycleType,
        sortOrder: c.sortOrder,
        isActive: true,
      })),
    });
  }

  const yearlyActions = await prisma.hrAppraisalAction.findMany({
    where: { tenantId, cycleType: HrAppraisalCycleType.YEARLY, isActive: true },
    orderBy: { sortOrder: "asc" },
    take: 4,
  });

  const cycle = await prisma.hrAppraisalCycle.upsert({
    where: {
      tenantId_cycleType_periodLabel: {
        tenantId,
        cycleType: HrAppraisalCycleType.YEARLY,
        periodLabel: "2026 Annual Review",
      },
    },
    create: {
      tenantId,
      cycleType: HrAppraisalCycleType.YEARLY,
      periodLabel: "2026 Annual Review",
      status: HrAppraisalCycleStatus.OPEN,
      dueDate: daysFromNow(30),
    },
    update: {},
  });

  for (const profile of profiles.filter((p) => p.status === EmployeeProfileStatus.ACTIVE).slice(0, 5)) {
    const isFinanceLead = profile.fullName === "Finance Lead";
    const demoScores =
      yearlyActions.length > 0
        ? Object.fromEntries(
            yearlyActions.map((action, actionIdx) => [
              action.id,
              {
                selfRating: [4, 3, 4, 3][actionIdx] ?? 3,
                selfNotes:
                  actionIdx === 0
                    ? "<p>Closed month-end reconciliations on time and improved reporting accuracy.</p>"
                    : undefined,
              },
            ]),
          )
        : undefined;

    await prisma.hrAppraisal.upsert({
      where: { cycleId_employeeProfileId: { cycleId: cycle.id, employeeProfileId: profile.id } },
      create: {
        tenantId,
        cycleId: cycle.id,
        employeeProfileId: profile.id,
        status: isFinanceLead ? HrAppraisalStatus.SELF_SUBMITTED : HrAppraisalStatus.DRAFT,
        selfNotes: isFinanceLead
          ? "<p>Demo self-assessment submitted — awaiting line manager confirmation.</p>"
          : "<p>Demo self-assessment in progress.</p>",
        actionScores: isFinanceLead ? demoScores : undefined,
      },
      update: isFinanceLead
        ? {
            status: HrAppraisalStatus.SELF_SUBMITTED,
            selfNotes: "<p>Demo self-assessment submitted — awaiting line manager confirmation.</p>",
            actionScores: demoScores,
          }
        : {},
    });

    await prisma.hrPerformanceGoal.upsert({
      where: { id: `${tenantId}-goal-${profile.id}` },
      create: {
        id: `${tenantId}-goal-${profile.id}`,
        tenantId,
        employeeProfileId: profile.id,
        title: "Close 3 unit sales this quarter",
        targetValue: "3 units",
        progressPercent: 33,
        dueDate: daysFromNow(60),
        createdByLabel: users.hrUser.name,
      },
      update: { progressPercent: 33 },
    });
  }

  const monthlyLabel = new Intl.DateTimeFormat("en-NG", { month: "long", year: "numeric" }).format(new Date());
  const monthlyCycle = await prisma.hrAppraisalCycle.upsert({
    where: {
      tenantId_cycleType_periodLabel: {
        tenantId,
        cycleType: HrAppraisalCycleType.MONTHLY,
        periodLabel: monthlyLabel,
      },
    },
    create: {
      tenantId,
      cycleType: HrAppraisalCycleType.MONTHLY,
      periodLabel: monthlyLabel,
      status: HrAppraisalCycleStatus.OPEN,
      dueDate: daysFromNow(10),
    },
    update: { status: HrAppraisalCycleStatus.OPEN },
  });

  const monthlyRatings = [5, 4, 4, 3, 4];
  for (const [idx, profile] of profiles
    .filter((p) => p.status === EmployeeProfileStatus.ACTIVE)
    .slice(0, 5)
    .entries()) {
    await prisma.hrAppraisal.upsert({
      where: { cycleId_employeeProfileId: { cycleId: monthlyCycle.id, employeeProfileId: profile.id } },
      create: {
        tenantId,
        cycleId: monthlyCycle.id,
        employeeProfileId: profile.id,
        status: HrAppraisalStatus.REVIEWED,
        overallRating: monthlyRatings[idx] ?? 4,
        managerNotes: "Strong month — demo review.",
        reviewedAt: daysAgo(2),
        reviewerLabel: users.hrUser.name,
      },
      update: {
        status: HrAppraisalStatus.REVIEWED,
        overallRating: monthlyRatings[idx] ?? 4,
        reviewedAt: daysAgo(2),
      },
    });
  }

  for (const { year, month, label } of [
    { year: 2026, month: 3, label: "March 2026" },
    { year: 2026, month: 4, label: "April 2026" },
    { year: 2026, month: 5, label: "May 2026" },
  ]) {
    const run = await prisma.hrPayslipRun.upsert({
      where: { tenantId_year_month: { tenantId, year, month } },
      create: {
        tenantId,
        year,
        month,
        label,
        status: month < 5 ? HrPayslipRunStatus.FINALIZED : HrPayslipRunStatus.DRAFT,
      },
      update: {},
    });

    for (const profile of profiles.filter((p) => p.status === EmployeeProfileStatus.ACTIVE)) {
      const gross = Number(profile.grossMonthly ?? 0);
      const tax = Number(profile.payeeTaxMonthly ?? 0);
      const pension = Math.round(gross * 0.08);
      const net = gross - tax - pension;
      await prisma.hrPayslip.upsert({
        where: { runId_employeeProfileId: { runId: run.id, employeeProfileId: profile.id } },
        create: {
          tenantId,
          runId: run.id,
          employeeProfileId: profile.id,
          grossPay: String(gross),
          payeeTax: String(tax),
          pensionDeduction: String(pension),
          netPay: String(net),
          earningsBreakdown: { basic: gross * 0.3, housing: gross * 0.2, transport: gross * 0.15, other: gross * 0.35 },
          deductionsBreakdown: { tax, pension },
          paymentStatus: month < 5 ? HrPayslipPaymentStatus.PAID : HrPayslipPaymentStatus.PENDING,
          paidAt: month < 5 ? daysAgo(5) : null,
        },
        update: {},
      });
    }
  }
}
