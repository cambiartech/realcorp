import type { PayslipCalculation } from "@/lib/hr-payslip";

export type RemittanceKind = "PAYE" | "PENSION" | "NHF" | "NSITF";

export type RemittanceIdentity = {
  employeeName: string;
  department: string;
  taxId: string;
  rsaPin: string;
  pensionAdministrator: string;
  nhfMembershipNumber: string;
};

export type RemittanceLine = RemittanceIdentity & {
  employeeAmount: number;
  employerAmount: number;
  total: number;
};

export type RemittanceSchedule = {
  kind: RemittanceKind;
  title: string;
  agency: string;
  rows: RemittanceLine[];
  employeeTotal: number;
  employerTotal: number;
  total: number;
  missingIdentity: number;
};

export type PayslipRemittanceSource = RemittanceIdentity & {
  calc: PayslipCalculation;
};

function money(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function lineAmount(calc: PayslipCalculation, code: string) {
  return money(calc.deductions.find((row) => row.code === code)?.amount ?? 0);
}

function contributionAmount(calc: PayslipCalculation, code: string) {
  return money(calc.employerContributions?.find((row) => row.code === code)?.amount ?? 0);
}

function identity(row: RemittanceIdentity): RemittanceIdentity {
  return {
    employeeName: row.employeeName,
    department: row.department,
    taxId: row.taxId.trim(),
    rsaPin: row.rsaPin.trim(),
    pensionAdministrator: row.pensionAdministrator.trim(),
    nhfMembershipNumber: row.nhfMembershipNumber.trim(),
  };
}

function pack(
  kind: RemittanceKind,
  title: string,
  agency: string,
  rows: RemittanceLine[],
  missing: (row: RemittanceLine) => boolean,
): RemittanceSchedule {
  const employeeTotal = money(rows.reduce((sum, row) => sum + row.employeeAmount, 0));
  const employerTotal = money(rows.reduce((sum, row) => sum + row.employerAmount, 0));
  return {
    kind,
    title,
    agency,
    rows,
    employeeTotal,
    employerTotal,
    total: money(employeeTotal + employerTotal),
    missingIdentity: rows.filter(missing).length,
  };
}

export function buildRemittanceSchedules(payslips: PayslipRemittanceSource[]): {
  paye: RemittanceSchedule;
  pension: RemittanceSchedule;
  nhf: RemittanceSchedule;
  nsitf: RemittanceSchedule;
} {
  const payeRows: RemittanceLine[] = [];
  const pensionRows: RemittanceLine[] = [];
  const nhfRows: RemittanceLine[] = [];
  const nsitfRows: RemittanceLine[] = [];

  for (const slip of payslips) {
    const who = identity(slip);
    const paye = money(slip.calc.payeeTax);
    const employeePension = money(slip.calc.pensionDeduction);
    const employerPension = contributionAmount(slip.calc, "PENSION_EMPLOYER");
    const nhf = lineAmount(slip.calc, "NHF");
    const nsitf = contributionAmount(slip.calc, "NSITF");

    if (paye > 0) {
      payeRows.push({ ...who, employeeAmount: paye, employerAmount: 0, total: paye });
    }
    if (employeePension > 0 || employerPension > 0) {
      pensionRows.push({
        ...who,
        employeeAmount: employeePension,
        employerAmount: employerPension,
        total: money(employeePension + employerPension),
      });
    }
    if (nhf > 0) {
      nhfRows.push({ ...who, employeeAmount: nhf, employerAmount: 0, total: nhf });
    }
    if (nsitf > 0) {
      nsitfRows.push({ ...who, employeeAmount: 0, employerAmount: nsitf, total: nsitf });
    }
  }

  const byName = (a: RemittanceLine, b: RemittanceLine) => a.employeeName.localeCompare(b.employeeName);

  return {
    paye: pack("PAYE", "PAYE income tax", "FIRS / state tax authority", payeRows.sort(byName), (row) => !row.taxId),
    pension: pack(
      "PENSION",
      "Employee pension",
      "PenCom / PFA",
      pensionRows.sort(byName),
      (row) => !row.rsaPin || !row.pensionAdministrator,
    ),
    nhf: pack("NHF", "National Housing Fund", "Federal Mortgage Bank", nhfRows.sort(byName), (row) => !row.nhfMembershipNumber),
    nsitf: pack("NSITF", "Employee Compensation (NSITF)", "NSITF", nsitfRows.sort(byName), () => false),
  };
}

export function remittanceGrandTotal(schedules: ReturnType<typeof buildRemittanceSchedules>) {
  return money(
    schedules.paye.total + schedules.pension.total + schedules.nhf.total + schedules.nsitf.total,
  );
}
