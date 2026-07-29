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
      return {
        fullName: d.fullName,
        gender: d.gender || null,
        dateOfBirth: d.dateOfBirth ? new Date(d.dateOfBirth) : null,
        maritalStatus: d.maritalStatus || null,
        nationality: d.nationality || null,
        phoneMobile: d.phoneMobile || null,
        workEmail: d.workEmail || null,
        addressStreet: d.addressStreet || null,
        addressCity: d.addressCity || null,
        addressState: d.addressState || null,
        position: d.position || null,
        department: d.department || null,
        dateOfJoining: d.dateOfJoining ? new Date(d.dateOfJoining) : null,
        reportingToLabel: d.reportingToLabel || null,
        employmentType: d.employmentType || null,
        workSchedule: d.workSchedule || null,
        emergencyContact: {
          name: d.emergencyName || "",
          relationship: d.emergencyRelationship || "",
          phone: d.emergencyPhone || "",
          email: d.emergencyEmail || "",
        },
        education: {
          level: d.educationLevel || "",
          institution: d.educationInstitution || "",
          qualification: d.educationQualification || "",
          year: d.educationYear || "",
        },
        nextOfKin: {
          name: d.nextOfKinName || "",
          relationship: d.nextOfKinRelationship || "",
          phone: d.nextOfKinPhone || "",
          email: d.nextOfKinEmail || "",
          street: d.nextOfKinStreet || "",
          city: d.nextOfKinCity || "",
          state: d.nextOfKinState || "",
          occupation: d.nextOfKinOccupation || "",
        },
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
