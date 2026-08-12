import type { HrFormType, Prisma } from "@/generated/prisma";
import { biodataPayloadForMerge } from "@/lib/hr-biodata-normalize";
import type {
  bankFormSchema,
  biodataFormSchema,
  guarantorFormSchema,
  healthFormSchema,
} from "@/lib/validators/hr-forms";
import type { z } from "zod";

type Biodata = z.infer<typeof biodataFormSchema>;
type Bank = z.infer<typeof bankFormSchema>;
type Guarantor = z.infer<typeof guarantorFormSchema>;
type Health = z.infer<typeof healthFormSchema>;

export function mergeHrFormIntoProfile(
  formType: HrFormType,
  payload: unknown,
): Prisma.EmployeeProfileUpdateInput {
  switch (formType) {
    case "BIODATA": {
      const d = biodataPayloadForMerge(payload as Biodata);
      const emergencyContact = {
        name: d.emergencyName || "",
        relationship: d.emergencyRelationship || "",
        phone: d.emergencyPhone || "",
        email: d.emergencyEmail || "",
      };
      const education = {
        level: d.educationLevel || "",
        institution: d.educationInstitution || "",
        qualification: d.educationQualification || "",
        year: d.educationYear || "",
      };
      const nextOfKin = {
        name: d.nextOfKinName || "",
        relationship: d.nextOfKinRelationship || "",
        phone: d.nextOfKinPhone || "",
        email: d.nextOfKinEmail || "",
        street: d.nextOfKinStreet || "",
        city: d.nextOfKinCity || "",
        state: d.nextOfKinState || "",
        occupation: d.nextOfKinOccupation || "",
      };
      const hasValue = (obj: Record<string, string>) => Object.values(obj).some(Boolean);
      const money = (value?: string) =>
        value && /^\d+(\.\d{1,2})?$/.test(value.trim()) ? Number(value.trim()) : undefined;
      const grossMonthly = money(d.grossMonthly);
      const payeeTaxMonthly = money(d.payeeTaxMonthly);
      return {
        ...(d.fullName ? { fullName: d.fullName } : {}),
        ...(d.gender ? { gender: d.gender } : {}),
        ...(d.dateOfBirth ? { dateOfBirth: new Date(d.dateOfBirth) } : {}),
        ...(d.maritalStatus ? { maritalStatus: d.maritalStatus } : {}),
        ...(d.nationality ? { nationality: d.nationality } : {}),
        ...(d.phoneMobile ? { phoneMobile: d.phoneMobile } : {}),
        ...(d.workEmail ? { workEmail: d.workEmail } : {}),
        ...(d.addressStreet ? { addressStreet: d.addressStreet } : {}),
        ...(d.addressCity ? { addressCity: d.addressCity } : {}),
        ...(d.addressState ? { addressState: d.addressState } : {}),
        ...(d.addressCountry ? { addressCountry: d.addressCountry } : {}),
        ...(d.position ? { position: d.position } : {}),
        ...(d.department ? { department: d.department } : {}),
        ...(d.dateOfJoining ? { dateOfJoining: new Date(d.dateOfJoining) } : {}),
        ...(d.reportingToLabel ? { reportingToLabel: d.reportingToLabel } : {}),
        ...(d.employmentType ? { employmentType: d.employmentType } : {}),
        ...(d.workSchedule ? { workSchedule: d.workSchedule } : {}),
        ...(d.paygroupName ? { paygroupName: d.paygroupName } : {}),
        ...(grossMonthly != null ? { grossMonthly } : {}),
        ...(payeeTaxMonthly != null ? { payeeTaxMonthly } : {}),
        ...(hasValue(emergencyContact) ? { emergencyContact } : {}),
        ...(hasValue(education) ? { education } : {}),
        ...(hasValue(nextOfKin) ? { nextOfKin } : {}),
      };
    }
    case "BANK_FORM": {
      const d = payload as Bank;
      return {
        bankAccount: {
          accountHolderName: d.accountHolderName,
          bankName: d.bankName,
          bankAddress: d.bankAddress || "",
          city: d.bankCity || "",
          state: d.bankState || "",
          country: d.bankCountry || "",
          accountType: d.accountType === "Other" ? d.accountTypeOther || "Other" : d.accountType,
          accountNumber: d.accountNumber,
          receivePayments: d.receivePayments === "yes",
        },
      };
    }
    case "GUARANTOR": {
      const d = payload as Guarantor;
      return {
        guarantorInfo: {
          employeeFullName: d.employeeFullName,
          employeeJobTitle: d.employeeJobTitle || "",
          employeeDepartment: d.employeeDepartment || "",
          employeeAddress: d.employeeAddress || "",
          employeePhone: d.employeePhone || "",
          guarantorFullName: d.guarantorFullName,
          guarantorRelationship: d.guarantorRelationship || "",
          guarantorAddress: d.guarantorAddress || "",
          guarantorPhone: d.guarantorPhone || "",
          guarantorEmail: d.guarantorEmail || "",
          guarantorOccupation: d.guarantorOccupation || "",
          guarantorEmployerName: d.guarantorEmployerName || "",
          guarantorEmployerAddress: d.guarantorEmployerAddress || "",
          knownYears: d.knownYears || "",
          declarationAccepted: true,
        },
      };
    }
    case "HEALTH": {
      const d = payload as Health;
      return {
        healthInfo: {
          hasMedicalConditions: d.hasMedicalConditions === "yes",
          medicalDetails: d.medicalDetails || "",
          emergencyMedicalName: d.emergencyMedicalName || "",
          emergencyMedicalRelationship: d.emergencyMedicalRelationship || "",
          emergencyMedicalPhone: d.emergencyMedicalPhone || "",
        },
        additionalInfo: {
          hasCertifications: d.hasCertifications === "yes",
          certificationsList: d.certificationsList || "",
          trainingWilling: d.trainingWilling === "yes",
          declarationAccepted: true,
        },
      };
    }
    default:
      return {};
  }
}
