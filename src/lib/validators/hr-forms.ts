import { z } from "zod";

const yesNo = z.enum(["yes", "no"]);

export const biodataFormSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  gender: z.string().trim().max(40).optional(),
  dateOfBirth: z.string().trim().optional(),
  maritalStatus: z.string().trim().max(40).optional(),
  nationality: z.string().trim().max(80).optional(),
  phoneMobile: z.string().trim().max(40).optional(),
  workEmail: z.string().trim().email().optional().or(z.literal("")),
  addressStreet: z.string().trim().max(200).optional(),
  addressCity: z.string().trim().max(80).optional(),
  addressState: z.string().trim().max(80).optional(),
  emergencyName: z.string().trim().max(120).optional(),
  emergencyRelationship: z.string().trim().max(80).optional(),
  emergencyPhone: z.string().trim().max(40).optional(),
  emergencyEmail: z.string().trim().email().optional().or(z.literal("")),
  position: z.string().trim().max(120).optional(),
  department: z.string().trim().max(80).optional(),
  employeeNumber: z.string().trim().max(40).optional(),
  dateOfJoining: z.string().trim().optional(),
  reportingToLabel: z.string().trim().max(120).optional(),
  employmentType: z.string().trim().max(40).optional(),
  workSchedule: z.string().trim().max(120).optional(),
  educationLevel: z.string().trim().max(80).optional(),
  educationInstitution: z.string().trim().max(160).optional(),
  educationQualification: z.string().trim().max(160).optional(),
  educationYear: z.string().trim().max(20).optional(),
  nextOfKinName: z.string().trim().max(120).optional(),
  nextOfKinRelationship: z.string().trim().max(80).optional(),
  nextOfKinPhone: z.string().trim().max(40).optional(),
  nextOfKinEmail: z.string().trim().email().optional().or(z.literal("")),
  nextOfKinStreet: z.string().trim().max(200).optional(),
  nextOfKinCity: z.string().trim().max(80).optional(),
  nextOfKinState: z.string().trim().max(80).optional(),
  nextOfKinOccupation: z.string().trim().max(120).optional(),
  nextOfKinSameAsEmergency: z.enum(["yes"]).optional(),
});

export const bankFormSchema = z.object({
  accountHolderName: z.string().trim().min(2).max(120),
  bankName: z.string().trim().min(2).max(120),
  bankAddress: z.string().trim().max(200).optional(),
  bankCity: z.string().trim().max(80).optional(),
  bankState: z.string().trim().max(80).optional(),
  bankCountry: z.string().trim().max(80).optional(),
  accountType: z.enum(["Checking", "Savings", "Other"]),
  accountTypeOther: z.string().trim().max(80).optional(),
  accountNumber: z.string().trim().min(6).max(40),
  receivePayments: yesNo,
});

export const guarantorFormSchema = z.object({
  employeeFullName: z.string().trim().min(2).max(120),
  employeeJobTitle: z.string().trim().max(120).optional(),
  employeeDepartment: z.string().trim().max(80).optional(),
  employeeAddress: z.string().trim().max(300).optional(),
  employeePhone: z.string().trim().max(40).optional(),
  guarantorFullName: z.string().trim().min(2).max(120),
  guarantorRelationship: z.string().trim().max(80).optional(),
  guarantorAddress: z.string().trim().max(300).optional(),
  guarantorPhone: z.string().trim().max(40).optional(),
  guarantorEmail: z.string().trim().email().optional().or(z.literal("")),
  guarantorOccupation: z.string().trim().max(120).optional(),
  guarantorEmployerName: z.string().trim().max(120).optional(),
  guarantorEmployerAddress: z.string().trim().max(300).optional(),
  knownYears: z.string().trim().max(20).optional(),
  declarationAccepted: z.literal("yes"),
});

export const healthFormSchema = z
  .object({
    hasMedicalConditions: yesNo,
    medicalDetails: z.string().trim().max(2000).optional(),
    emergencyMedicalName: z.string().trim().max(120).optional(),
    emergencyMedicalRelationship: z.string().trim().max(80).optional(),
    emergencyMedicalPhone: z.string().trim().max(40).optional(),
    hasCertifications: yesNo,
    certificationsList: z.string().trim().max(2000).optional(),
    trainingWilling: yesNo,
    declarationAccepted: z.literal("yes"),
  })
  .superRefine((data, ctx) => {
    if (data.hasMedicalConditions === "yes" && !data.medicalDetails?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please describe your medical conditions or allergies.",
        path: ["medicalDetails"],
      });
    }
    if (data.hasCertifications === "yes" && !data.certificationsList?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Add at least one skill or certification (use Enter after each).",
        path: ["certificationsList"],
      });
    }
  });

export const printUploadSchema = z.object({
  fileUrl: z.string().url(),
  fileName: z.string().trim().max(200).optional(),
});
