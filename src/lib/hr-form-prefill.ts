import type { EmployeeProfile } from "@/generated/prisma";

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function jsonField(obj: unknown, key: string): string {
  if (!obj || typeof obj !== "object") return "";
  return str((obj as Record<string, unknown>)[key]);
}

export function prefillValuesForForm(profile: EmployeeProfile): Record<string, string> {
  const ec = profile.emergencyContact;
  const edu = profile.education;
  const nok = profile.nextOfKin;
  const bank = profile.bankAccount;
  const guar = profile.guarantorInfo;

  return {
    fullName: profile.fullName || "",
    gender: profile.gender || "",
    dateOfBirth: profile.dateOfBirth ? profile.dateOfBirth.toISOString().slice(0, 10) : "",
    maritalStatus: profile.maritalStatus || "",
    nationality: profile.nationality || "",
    phoneMobile: profile.phoneMobile || "",
    workEmail: profile.workEmail || "",
    addressStreet: profile.addressStreet || "",
    addressCity: profile.addressCity || "",
    addressState: profile.addressState || "",
    emergencyName: jsonField(ec, "name"),
    emergencyRelationship: jsonField(ec, "relationship"),
    emergencyPhone: jsonField(ec, "phone"),
    emergencyEmail: jsonField(ec, "email"),
    position: profile.position || "",
    department: profile.department || "",
    employeeNumber: profile.employeeNumber || "",
    dateOfJoining: profile.dateOfJoining ? profile.dateOfJoining.toISOString().slice(0, 10) : "",
    taxId: profile.taxId || "",
    rsaPin: profile.rsaPin || "",
    pensionAdministrator: profile.pensionAdministrator || "",
    nhfMembershipNumber: profile.nhfMembershipNumber || "",
    educationLevel: jsonField(edu, "level"),
    nextOfKinName: jsonField(nok, "name"),
    nextOfKinRelationship: jsonField(nok, "relationship"),
    nextOfKinPhone: jsonField(nok, "phone"),
    nextOfKinEmail: jsonField(nok, "email"),
    accountHolderName: jsonField(bank, "accountHolderName") || profile.fullName || "",
    bankName: jsonField(bank, "bankName"),
    bankAddress: jsonField(bank, "bankAddress"),
    bankCity: jsonField(bank, "city"),
    bankState: jsonField(bank, "state"),
    accountType: jsonField(bank, "accountType") || "Checking",
    accountNumber: jsonField(bank, "accountNumber"),
    employeeFullName: profile.fullName || jsonField(guar, "employeeFullName"),
    employeeJobTitle: profile.position || jsonField(guar, "employeeJobTitle"),
    guarantorFullName: jsonField(guar, "guarantorFullName"),
    guarantorRelationship: jsonField(guar, "guarantorRelationship"),
    guarantorPhone: jsonField(guar, "guarantorPhone"),
    guarantorEmail: jsonField(guar, "guarantorEmail"),
    knownYears: jsonField(guar, "knownYears"),
  };
}
