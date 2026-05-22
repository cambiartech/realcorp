export type EmployeeRegisterRow = {
  employeeNumber: string;
  fullName: string;
  workEmail: string;
  department: string;
  position: string;
  status: string;
  dateOfJoining: string;
  paygroup: string;
  grossMonthly: string;
  phone: string;
};

export function employeeRegisterToCsv(rows: EmployeeRegisterRow[]): string {
  const headers = [
    "employeeNumber",
    "fullName",
    "workEmail",
    "department",
    "position",
    "status",
    "dateOfJoining",
    "paygroup",
    "grossMonthly",
    "phone",
  ] as const;
  const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  if (rows.length === 0) {
    return `${headers.map(esc).join(",")}\n`;
  }
  return [
    headers.map(esc).join(","),
    ...rows.map((row) => headers.map((h) => esc(row[h] ?? "")).join(",")),
  ].join("\n");
}
