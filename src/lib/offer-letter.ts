export type OfferLetterFields = {
  employeeName: string;
  position: string;
  department: string;
  dateOfJoining: string;
  employmentType: string;
  grossMonthly: string;
  currency: string;
  reportingTo: string;
  employeeNumber: string;
};

export function formatOfferDate(d = new Date()) {
  return new Intl.DateTimeFormat("en-NG", { dateStyle: "long" }).format(d);
}

export function offerLetterBody(fields: OfferLetterFields, companyName: string) {
  const salaryLine = fields.grossMonthly
    ? `a monthly gross remuneration of ${fields.currency} ${fields.grossMonthly}`
    : "remuneration as agreed in your employment contract";

  return [
    `Dear ${fields.employeeName},`,
    "",
    `We are pleased to offer you employment with ${companyName} in the position of ${fields.position || "the role discussed"}${fields.department ? `, ${fields.department} department` : ""}, effective ${fields.dateOfJoining || "on a date to be confirmed"}.`,
    "",
    `This offer is made on a ${fields.employmentType || "full-time"} basis${fields.reportingTo ? `, reporting to ${fields.reportingTo}` : ""}. You will receive ${salaryLine}, subject to statutory deductions and company payroll policies.`,
    "",
    `Your employee reference, once assigned, is ${fields.employeeNumber || "to be confirmed"}.`,
    "",
    "This letter is subject to:",
    "• Successful completion of onboarding forms (biodata, bank details, guarantor, and health declarations as applicable)",
    "• Execution of the company Non-Disclosure Agreement and any other policies issued by HR",
    "• Satisfactory verification of documents provided",
    "",
    "Please sign and return a copy of this letter to indicate your acceptance. We look forward to welcoming you to the team.",
    "",
    "Yours sincerely,",
    "",
    "Human Resources",
    companyName,
  ].join("\n");
}
