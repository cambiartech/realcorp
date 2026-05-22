import type { ProfileDetailRow } from "@/lib/hr-profile-form";

function field(fd: FormData, name: string): string {
  return String(fd.get(name) ?? "").trim();
}

/** Merge submitted form values into the in-memory draft (keeps fields not in the form). */
export function mergeProfileDraftFromForm(draft: ProfileDetailRow, form: HTMLFormElement): ProfileDetailRow {
  const fd = new FormData(form);
  const gross = field(fd, "grossMonthly");
  const payee = field(fd, "payeeTaxMonthly");

  return {
    ...draft,
    fullName: field(fd, "fullName") || draft.fullName,
    employeeNumber: field(fd, "employeeNumber") || draft.employeeNumber,
    gender: field(fd, "gender") || draft.gender,
    dateOfBirth: field(fd, "dateOfBirth") || draft.dateOfBirth,
    maritalStatus: field(fd, "maritalStatus") || draft.maritalStatus,
    nationality: field(fd, "nationality") || draft.nationality,
    phoneMobile: field(fd, "phoneMobile") || draft.phoneMobile,
    workEmail: field(fd, "workEmail") || draft.workEmail,
    addressStreet: field(fd, "addressStreet") || draft.addressStreet,
    addressCity: field(fd, "addressCity") || draft.addressCity,
    addressState: field(fd, "addressState") || draft.addressState,
    position: field(fd, "position") || draft.position,
    department: field(fd, "department") || draft.department,
    dateOfJoining: field(fd, "dateOfJoining") || draft.dateOfJoining,
    reportingToLabel: field(fd, "reportingToLabel") || draft.reportingToLabel,
    employmentType: field(fd, "employmentType") || draft.employmentType,
    workSchedule: field(fd, "workSchedule") || draft.workSchedule,
    paygroupName: field(fd, "paygroupName") || draft.paygroupName,
    grossMonthly: gross || draft.grossMonthly,
    payeeTaxMonthly: payee || draft.payeeTaxMonthly,
    bankAccountHolderName: field(fd, "bankAccountHolderName") || draft.bankAccountHolderName,
    bankName: field(fd, "bankName") || draft.bankName,
    bankAccountNumber: field(fd, "bankAccountNumber") || draft.bankAccountNumber,
    bankAccountType: field(fd, "bankAccountType") || draft.bankAccountType,
    bankReceivePayments: field(fd, "bankReceivePayments") || draft.bankReceivePayments,
    emergencyName: field(fd, "emergencyName") || draft.emergencyName,
    emergencyRelationship: field(fd, "emergencyRelationship") || draft.emergencyRelationship,
    emergencyPhone: field(fd, "emergencyPhone") || draft.emergencyPhone,
    emergencyEmail: field(fd, "emergencyEmail") || draft.emergencyEmail,
    status: field(fd, "status") || draft.status,
  };
}

export function profileDraftFingerprint(draft: ProfileDetailRow): string {
  return [
    draft.id,
    draft.position,
    draft.department,
    draft.grossMonthly,
    draft.phoneMobile,
    draft.bankName,
  ].join("|");
}
