export type PayslipEarningLine = {
  code: string;
  label: string;
  percent: number;
  amount: number;
};

export type PayslipDeductionLine = {
  code: string;
  label: string;
  amount: number;
};

export type PayslipCalculation = {
  grossPay: number;
  earnings: PayslipEarningLine[];
  deductions: PayslipDeductionLine[];
  payeeTax: number;
  pensionDeduction: number;
  otherDeductions: number;
  netPay: number;
};

/** Bo Properties-style split: Basic / Housing / Transport / Other allowance. */
export function calculateNigeriaPayslip(input: {
  grossMonthly: number;
  basicPercent?: number;
  housingPercent?: number;
  transportPercent?: number;
  otherPercent?: number;
  payeeTax?: number;
  pensionRate?: number;
  otherDeductions?: number;
}): PayslipCalculation {
  const gross = round2(Math.max(0, input.grossMonthly));
  const basicPct = input.basicPercent ?? 30;
  const housingPct = input.housingPercent ?? 20;
  const transportPct = input.transportPercent ?? 15;
  const otherPct = input.otherPercent ?? 35;
  const pensionRate = input.pensionRate ?? 0.08;

  const basic = round2((gross * basicPct) / 100);
  const housing = round2((gross * housingPct) / 100);
  const transport = round2((gross * transportPct) / 100);
  const other = round2((gross * otherPct) / 100);
  const bht = round2(basic + housing + transport);

  const pensionDeduction = round2(bht * pensionRate);
  const payeeTax =
    input.payeeTax !== undefined && input.payeeTax >= 0 ? round2(input.payeeTax) : round2(gross * 0.0998);
  const otherDeductions = round2(Math.max(0, input.otherDeductions ?? 0));
  const netPay = round2(gross - payeeTax - pensionDeduction - otherDeductions);

  return {
    grossPay: gross,
    earnings: [
      { code: "B", label: `Basic (${basicPct}%)`, percent: basicPct, amount: basic },
      { code: "H", label: `Housing (${housingPct}%)`, percent: housingPct, amount: housing },
      { code: "T", label: `Transport (${transportPct}%)`, percent: transportPct, amount: transport },
      { code: "O", label: `Other allowance (${otherPct}%)`, percent: otherPct, amount: other },
    ],
    deductions: [
      { code: "PAYEE", label: "Payee (tax)", amount: payeeTax },
      {
        code: "PENSION",
        label: `Pension (${(pensionRate * 100).toFixed(0)}% of Basic+Housing+Transport)`,
        amount: pensionDeduction,
      },
      ...(otherDeductions > 0 ? [{ code: "OTHER", label: "Other deductions", amount: otherDeductions }] : []),
    ],
    payeeTax,
    pensionDeduction,
    otherDeductions,
    netPay,
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
