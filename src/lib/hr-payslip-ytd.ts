export type PayslipYtdSummary = {
  year: number;
  monthsPaid: number;
  grossYtd: number;
  payeeYtd: number;
  pensionYtd: number;
  otherDeductionsYtd: number;
  netYtd: number;
};

export function aggregatePayslipYtd(
  slips: Array<{
    grossPay: number;
    payeeTax: number;
    pensionDeduction: number;
    otherDeductions: number;
    netPay: number;
    year: number;
    month: number;
  }>,
  year: number,
): PayslipYtdSummary {
  const inYear = slips.filter((s) => s.year === year);
  const months = new Set(inYear.map((s) => s.month));

  return {
    year,
    monthsPaid: months.size,
    grossYtd: round2(inYear.reduce((sum, s) => sum + s.grossPay, 0)),
    payeeYtd: round2(inYear.reduce((sum, s) => sum + s.payeeTax, 0)),
    pensionYtd: round2(inYear.reduce((sum, s) => sum + s.pensionDeduction, 0)),
    otherDeductionsYtd: round2(inYear.reduce((sum, s) => sum + s.otherDeductions, 0)),
    netYtd: round2(inYear.reduce((sum, s) => sum + s.netPay, 0)),
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
