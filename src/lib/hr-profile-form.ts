function str(v: FormDataEntryValue | null): string {
  return String(v ?? "").trim();
}

function parseMoney(
  value: FormDataEntryValue | null,
): { ok: true; value?: number } | { ok: false; error: string } {
  const raw = str(value);
  if (!raw) return { ok: true, value: undefined };
  const normalized = raw.replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return { ok: false, error: "Monthly gross pay must be a number (e.g. 235800)." };
  }
  return { ok: true, value: Number(normalized) };
}

/** Turns HR-friendly form fields into upsert payload (no JSON for HR staff). */
export function formDataToEmployeeProfilePayload(fd: FormData): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    userId: str(fd.get("userId")),
    fullName: str(fd.get("fullName")),
  };
  const stringFields = [
    "employeeNumber",
    "gender",
    "dateOfBirth",
    "maritalStatus",
    "nationality",
    "phoneMobile",
    "workEmail",
    "addressStreet",
    "addressCity",
    "addressState",
    "addressCountry",
    "position",
    "department",
    "dateOfJoining",
    "reportingToLabel",
    "employmentType",
    "workSchedule",
    "paygroupName",
    "payTemplateId",
    "payrollCountryCode",
    "payrollRegionCode",
    "taxId",
    "taxOverrideReason",
    "rsaPin",
    "pensionAdministrator",
    "nhfMembershipNumber",
    "hrNotes",
    "status",
  ] as const;
  for (const key of stringFields) {
    if (fd.has(key)) payload[key] = str(fd.get(key));
  }

  const moneyFields = [
    "grossMonthly",
    "payeeTaxMonthly",
    "nhfMonthly",
    "nhiaMonthly",
    "annualRent",
    "annualLifeInsurance",
    "annualMortgageInterest",
    "otherPreTaxMonthly",
    "otherPostTaxMonthly",
  ] as const;
  for (const key of moneyFields) {
    if (fd.has(key)) {
      const parsed = parseMoney(fd.get(key));
      if (!parsed.ok) throw new Error(`${key}: ${parsed.error}`);
      payload[key] = parsed.value;
    }
  }
  if (str(fd.get("payeCalculationMode")) !== "MANUAL") {
    payload.payeeTaxMonthly = undefined;
    payload.taxOverrideReason = "";
  }

  for (const key of [
    "basicPercent",
    "housingPercent",
    "transportPercent",
    "otherPercent",
    "employeePensionRate",
    "employerPensionRate",
  ] as const) {
    if (fd.has(key) && str(fd.get(key))) payload[key] = Number(str(fd.get(key)));
  }
  if (fd.has("pensionEnabled")) payload.pensionEnabled = str(fd.get("pensionEnabled")) !== "no";

  const bankHolder = str(fd.get("bankAccountHolderName"));
  const bankName = str(fd.get("bankName"));
  const bankNumber = str(fd.get("bankAccountNumber"));
  const bankType = str(fd.get("bankAccountType")) || "Checking";

  const emergencyName = str(fd.get("emergencyName"));
  const nextOfKinName = str(fd.get("nextOfKinName"));

  if (fd.has("bankAccountHolderName") || fd.has("bankName") || fd.has("bankAccountNumber")) {
    payload.bankAccountJson = {
      accountHolderName: bankHolder,
      bankName,
      accountNumber: bankNumber,
      accountType: bankType,
      receivePayments: str(fd.get("bankReceivePayments")) === "yes",
    };
  }
  if (fd.has("emergencyName") || fd.has("emergencyPhone")) {
    payload.emergencyContactJson = {
      name: emergencyName,
      relationship: str(fd.get("emergencyRelationship")),
      phone: str(fd.get("emergencyPhone")),
      email: str(fd.get("emergencyEmail")),
    };
  }
  if (fd.has("nextOfKinName") || fd.has("nextOfKinPhone")) {
    payload.nextOfKinJson = {
      name: nextOfKinName,
      relationship: str(fd.get("nextOfKinRelationship")),
      phone: str(fd.get("nextOfKinPhone")),
      email: str(fd.get("nextOfKinEmail")),
      street: str(fd.get("nextOfKinStreet")),
      city: str(fd.get("nextOfKinCity")),
      state: str(fd.get("nextOfKinState")),
      country: str(fd.get("nextOfKinCountry")),
      occupation: str(fd.get("nextOfKinOccupation")),
    };
  }
  if (fd.has("educationLevel") || fd.has("educationInstitution")) {
    payload.educationJson = {
      level: str(fd.get("educationLevel")),
      institution: str(fd.get("educationInstitution")),
      qualification: str(fd.get("educationQualification")),
      year: str(fd.get("educationYear")),
    };
  }
  return payload;
}

export function jsonField(obj: unknown, key: string): string {
  if (!obj || typeof obj !== "object") return "";
  const v = (obj as Record<string, unknown>)[key];
  return typeof v === "string" ? v : typeof v === "number" ? String(v) : "";
}

export type ProfileDetailRow = {
  id: string;
  userId: string;
  employeeNumber: string;
  status: string;
  fullName: string;
  gender: string;
  dateOfBirth: string;
  maritalStatus: string;
  nationality: string;
  phoneMobile: string;
  workEmail: string;
  addressStreet: string;
  addressCity: string;
  addressState: string;
  addressCountry: string;
  position: string;
  department: string;
  dateOfJoining: string;
  reportingToLabel: string;
  employmentType: string;
  workSchedule: string;
  paygroupName: string;
  payTemplateId: string;
  grossMonthly: string;
  payeeTaxMonthly: string;
  payrollCountryCode: string;
  payrollRegionCode: string;
  taxId: string;
  taxOverrideReason: string;
  rsaPin: string;
  pensionAdministrator: string;
  nhfMembershipNumber: string;
  pensionEnabled: string;
  employeePensionRate: string;
  employerPensionRate: string;
  nhfMonthly: string;
  nhiaMonthly: string;
  annualRent: string;
  annualLifeInsurance: string;
  annualMortgageInterest: string;
  otherPreTaxMonthly: string;
  otherPostTaxMonthly: string;
  basicPercent: string;
  housingPercent: string;
  transportPercent: string;
  otherPercent: string;
  hrNotes: string;
  bankAccountHolderName: string;
  bankName: string;
  bankAccountNumber: string;
  bankAccountType: string;
  bankReceivePayments: string;
  emergencyName: string;
  emergencyRelationship: string;
  emergencyPhone: string;
  emergencyEmail: string;
  nextOfKinName: string;
  nextOfKinRelationship: string;
  nextOfKinPhone: string;
  nextOfKinEmail: string;
  nextOfKinStreet: string;
  nextOfKinCity: string;
  nextOfKinState: string;
  nextOfKinCountry: string;
  nextOfKinOccupation: string;
  educationLevel: string;
  educationInstitution: string;
  educationQualification: string;
  educationYear: string;
};

export function profileToDetailRow(p: {
  id: string;
  userId: string;
  employeeNumber: string | null;
  status: string;
  fullName: string | null;
  gender: string | null;
  dateOfBirth: Date | null;
  maritalStatus: string | null;
  nationality: string | null;
  phoneMobile: string | null;
  workEmail: string | null;
  addressStreet: string | null;
  addressCity: string | null;
  addressState: string | null;
  addressCountry?: string | null;
  position: string | null;
  department: string | null;
  dateOfJoining: Date | null;
  reportingToLabel: string | null;
  employmentType: string | null;
  workSchedule: string | null;
  paygroupName: string | null;
  payTemplateId?: string | null;
  grossMonthly: { toString(): string } | null;
  payeeTaxMonthly?: { toString(): string } | null;
  payrollCountryCode?: string;
  payrollRegionCode?: string | null;
  taxId?: string | null;
  taxOverrideReason?: string | null;
  rsaPin?: string | null;
  pensionAdministrator?: string | null;
  nhfMembershipNumber?: string | null;
  pensionEnabled?: boolean;
  employeePensionRate?: { toString(): string };
  employerPensionRate?: { toString(): string };
  nhfMonthly?: { toString(): string };
  nhiaMonthly?: { toString(): string };
  annualRent?: { toString(): string };
  annualLifeInsurance?: { toString(): string };
  annualMortgageInterest?: { toString(): string };
  otherPreTaxMonthly?: { toString(): string };
  otherPostTaxMonthly?: { toString(): string };
  basicPercent: { toString(): string };
  housingPercent: { toString(): string };
  transportPercent: { toString(): string };
  otherPercent: { toString(): string };
  hrNotes: string | null;
  bankAccount: unknown;
  emergencyContact: unknown;
  nextOfKin: unknown;
  education: unknown;
}): ProfileDetailRow {
  const bank = p.bankAccount;
  const ec = p.emergencyContact;
  const nok = p.nextOfKin;
  const edu = p.education;
  const receive = jsonField(bank, "receivePayments");

  return {
    id: p.id,
    userId: p.userId,
    employeeNumber: p.employeeNumber || "",
    status: p.status,
    fullName: p.fullName || "",
    gender: p.gender || "",
    dateOfBirth: p.dateOfBirth ? p.dateOfBirth.toISOString().slice(0, 10) : "",
    maritalStatus: p.maritalStatus || "",
    nationality: p.nationality || "",
    phoneMobile: p.phoneMobile || "",
    workEmail: p.workEmail || "",
    addressStreet: p.addressStreet || "",
    addressCity: p.addressCity || "",
    addressState: p.addressState || "",
    addressCountry: p.addressCountry || "",
    position: p.position || "",
    department: p.department || "",
    dateOfJoining: p.dateOfJoining ? p.dateOfJoining.toISOString().slice(0, 10) : "",
    reportingToLabel: p.reportingToLabel || "",
    employmentType: p.employmentType || "",
    workSchedule: p.workSchedule || "",
    paygroupName: p.paygroupName || "",
    payTemplateId: p.payTemplateId || "",
    grossMonthly: p.grossMonthly ? String(Number(p.grossMonthly)) : "",
    payeeTaxMonthly: p.payeeTaxMonthly ? String(Number(p.payeeTaxMonthly)) : "",
    payrollCountryCode: p.payrollCountryCode || "NG",
    payrollRegionCode: p.payrollRegionCode || "",
    taxId: p.taxId || "",
    taxOverrideReason: p.taxOverrideReason || "",
    rsaPin: p.rsaPin || "",
    pensionAdministrator: p.pensionAdministrator || "",
    nhfMembershipNumber: p.nhfMembershipNumber || "",
    pensionEnabled: p.pensionEnabled === false ? "no" : "yes",
    employeePensionRate: p.employeePensionRate ? String(Number(p.employeePensionRate)) : "8",
    employerPensionRate: p.employerPensionRate ? String(Number(p.employerPensionRate)) : "10",
    nhfMonthly: p.nhfMonthly ? String(Number(p.nhfMonthly)) : "",
    nhiaMonthly: p.nhiaMonthly ? String(Number(p.nhiaMonthly)) : "",
    annualRent: p.annualRent ? String(Number(p.annualRent)) : "",
    annualLifeInsurance: p.annualLifeInsurance ? String(Number(p.annualLifeInsurance)) : "",
    annualMortgageInterest: p.annualMortgageInterest ? String(Number(p.annualMortgageInterest)) : "",
    otherPreTaxMonthly: p.otherPreTaxMonthly ? String(Number(p.otherPreTaxMonthly)) : "",
    otherPostTaxMonthly: p.otherPostTaxMonthly ? String(Number(p.otherPostTaxMonthly)) : "",
    basicPercent: String(Number(p.basicPercent)),
    housingPercent: String(Number(p.housingPercent)),
    transportPercent: String(Number(p.transportPercent)),
    otherPercent: String(Number(p.otherPercent)),
    hrNotes: p.hrNotes || "",
    bankAccountHolderName: jsonField(bank, "accountHolderName"),
    bankName: jsonField(bank, "bankName"),
    bankAccountNumber: jsonField(bank, "accountNumber"),
    bankAccountType: jsonField(bank, "accountType") || "Checking",
    bankReceivePayments: receive === "true" || receive === "yes" ? "yes" : "no",
    emergencyName: jsonField(ec, "name"),
    emergencyRelationship: jsonField(ec, "relationship"),
    emergencyPhone: jsonField(ec, "phone"),
    emergencyEmail: jsonField(ec, "email"),
    nextOfKinName: jsonField(nok, "name"),
    nextOfKinRelationship: jsonField(nok, "relationship"),
    nextOfKinPhone: jsonField(nok, "phone"),
    nextOfKinEmail: jsonField(nok, "email"),
    nextOfKinStreet: jsonField(nok, "street"),
    nextOfKinCity: jsonField(nok, "city"),
    nextOfKinState: jsonField(nok, "state"),
    nextOfKinCountry: jsonField(nok, "country"),
    nextOfKinOccupation: jsonField(nok, "occupation"),
    educationLevel: jsonField(edu, "level"),
    educationInstitution: jsonField(edu, "institution"),
    educationQualification: jsonField(edu, "qualification"),
    educationYear: jsonField(edu, "year"),
  };
}
