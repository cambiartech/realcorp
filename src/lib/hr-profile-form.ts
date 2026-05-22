import type { Prisma } from "@/generated/prisma";

function str(v: FormDataEntryValue | null): string {
  return String(v ?? "").trim();
}

function parseMoney(value: FormDataEntryValue | null): { ok: true; value?: number } | { ok: false; error: string } {
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
  const gross = parseMoney(fd.get("grossMonthly"));
  if (!gross.ok) throw new Error(gross.error);
  const payee = parseMoney(fd.get("payeeTaxMonthly"));
  if (!payee.ok) throw new Error(payee.error);

  const bankHolder = str(fd.get("bankAccountHolderName"));
  const bankName = str(fd.get("bankName"));
  const bankNumber = str(fd.get("bankAccountNumber"));
  const bankType = str(fd.get("bankAccountType")) || "Checking";

  const emergencyName = str(fd.get("emergencyName"));
  const nextOfKinName = str(fd.get("nextOfKinName"));

  return {
    userId: str(fd.get("userId")),
    fullName: str(fd.get("fullName")),
    employeeNumber: str(fd.get("employeeNumber")),
    gender: str(fd.get("gender")),
    dateOfBirth: str(fd.get("dateOfBirth")),
    maritalStatus: str(fd.get("maritalStatus")),
    nationality: str(fd.get("nationality")),
    phoneMobile: str(fd.get("phoneMobile")),
    workEmail: str(fd.get("workEmail")),
    addressStreet: str(fd.get("addressStreet")),
    addressCity: str(fd.get("addressCity")),
    addressState: str(fd.get("addressState")),
    position: str(fd.get("position")),
    department: str(fd.get("department")),
    dateOfJoining: str(fd.get("dateOfJoining")),
    reportingToLabel: str(fd.get("reportingToLabel")),
    employmentType: str(fd.get("employmentType")),
    workSchedule: str(fd.get("workSchedule")),
    paygroupName: str(fd.get("paygroupName")),
    grossMonthly: gross.value,
    payeeTaxMonthly: payee.value,
    ...(str(fd.get("basicPercent")) ? { basicPercent: Number(str(fd.get("basicPercent"))) } : {}),
    ...(str(fd.get("housingPercent")) ? { housingPercent: Number(str(fd.get("housingPercent"))) } : {}),
    ...(str(fd.get("transportPercent")) ? { transportPercent: Number(str(fd.get("transportPercent"))) } : {}),
    ...(str(fd.get("otherPercent")) ? { otherPercent: Number(str(fd.get("otherPercent"))) } : {}),
    hrNotes: str(fd.get("hrNotes")),
    status: str(fd.get("status")) || "ACTIVE",
    bankAccountJson:
      bankHolder || bankName || bankNumber
        ? {
            accountHolderName: bankHolder,
            bankName,
            accountNumber: bankNumber,
            accountType: bankType,
            receivePayments: str(fd.get("bankReceivePayments")) === "yes",
          }
        : undefined,
    emergencyContactJson:
      emergencyName || str(fd.get("emergencyPhone"))
        ? {
            name: emergencyName,
            relationship: str(fd.get("emergencyRelationship")),
            phone: str(fd.get("emergencyPhone")),
            email: str(fd.get("emergencyEmail")),
          }
        : undefined,
    nextOfKinJson:
      nextOfKinName || str(fd.get("nextOfKinPhone"))
        ? {
            name: nextOfKinName,
            relationship: str(fd.get("nextOfKinRelationship")),
            phone: str(fd.get("nextOfKinPhone")),
            email: str(fd.get("nextOfKinEmail")),
            street: str(fd.get("nextOfKinStreet")),
            city: str(fd.get("nextOfKinCity")),
            state: str(fd.get("nextOfKinState")),
            occupation: str(fd.get("nextOfKinOccupation")),
          }
        : undefined,
    educationJson:
      str(fd.get("educationLevel")) || str(fd.get("educationInstitution"))
        ? {
            level: str(fd.get("educationLevel")),
            institution: str(fd.get("educationInstitution")),
            qualification: str(fd.get("educationQualification")),
            year: str(fd.get("educationYear")),
          }
        : undefined,
  };
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
  position: string;
  department: string;
  dateOfJoining: string;
  reportingToLabel: string;
  employmentType: string;
  workSchedule: string;
  paygroupName: string;
  grossMonthly: string;
  payeeTaxMonthly: string;
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
  position: string | null;
  department: string | null;
  dateOfJoining: Date | null;
  reportingToLabel: string | null;
  employmentType: string | null;
  workSchedule: string | null;
  paygroupName: string | null;
  grossMonthly: { toString(): string } | null;
  payeeTaxMonthly?: { toString(): string } | null;
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
    position: p.position || "",
    department: p.department || "",
    dateOfJoining: p.dateOfJoining ? p.dateOfJoining.toISOString().slice(0, 10) : "",
    reportingToLabel: p.reportingToLabel || "",
    employmentType: p.employmentType || "",
    workSchedule: p.workSchedule || "",
    paygroupName: p.paygroupName || "",
    grossMonthly: p.grossMonthly ? String(Number(p.grossMonthly)) : "",
    payeeTaxMonthly: p.payeeTaxMonthly ? String(Number(p.payeeTaxMonthly)) : "",
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
    nextOfKinOccupation: jsonField(nok, "occupation"),
    educationLevel: jsonField(edu, "level"),
    educationInstitution: jsonField(edu, "institution"),
    educationQualification: jsonField(edu, "qualification"),
    educationYear: jsonField(edu, "year"),
  };
}
