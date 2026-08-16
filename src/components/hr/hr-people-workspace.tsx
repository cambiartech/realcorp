"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Download, FileSpreadsheet, Send, UserPlus, Users } from "lucide-react";
import { useSnackbar } from "@/components/snackbar";
import { UiSelect } from "@/components/ui-select";
import { ButtonSpinner } from "@/components/button-spinner";
import { ModalOverlay } from "@/components/modal-overlay";
import { PdfDownloadButton } from "@/components/pdf-download-button";
import type { HrFormDeliveryMode, HrFormType } from "@/generated/prisma";
import { formDataToEmployeeProfilePayload, type ProfileDetailRow } from "@/lib/hr-profile-form";
import { OfferLetterEditor } from "@/components/hr/offer-letter-editor";
import { HrOnboardingWizard } from "@/components/hr/hr-onboarding-wizard";
import { inferOnboardingStep, resolveOnboardingStep, type OnboardingStepId } from "@/lib/hr-onboarding-step";
import { ProfileComplianceChecklist } from "@/components/hr/profile-compliance-checklist";
import { PayslipYtdCard } from "@/components/hr/payslip-ytd-card";
import type { ProfileChecklistItem } from "@/lib/hr-profile-checklist";
import type { PayslipYtdSummary } from "@/lib/hr-payslip-ytd";
import type { TenantBranding } from "@/lib/tenant-branding";
import {
  approveHrFormRequest,
  approveHrFormRequestsBatch,
  applyPayTemplate,
  cancelHrFormRequest,
  createPayTemplate,
  createHrFormRequestsBatch,
  upsertEmployeeProfile,
} from "@/app/[tenantSlug]/hr/actions";
import { createHrOnlyEmployee, prefillEmployeeFromUploadedDocs } from "@/app/[tenantSlug]/hr/document-intake-actions";
import { inviteTenantMembersBatch } from "@/app/[tenantSlug]/team/actions";
import { HR_FORM_OPTIONS } from "@/lib/hr-form-types";
import { INVITE_DEPARTMENT_OPTIONS } from "@/lib/team-membership-roles";
import { downloadExcel } from "@/lib/table-export";
import { MODAL_PANEL_FORM, MODAL_PANEL_XS } from "@/lib/modal-panel";
import { GlobalLocationFields } from "@/components/global-location-fields";

type PeopleTab = "directory" | "onboard" | "record" | "send" | "requests";
type RecordTab = "personal" | "job" | "bank" | "emergency" | "family";
type InviteMode = "single" | "bulk" | "excel";
type InviteRow = {
  email: string;
  accessKind: "department";
  department: string;
  isDepartmentLead: boolean;
};

const inputClass =
  "w-full rounded-md border border-foreground/15 bg-field px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/20";

function Field({
  label,
  name,
  type = "text",
  required,
  defaultValue,
  hint,
  className,
  children,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
  hint?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <label className={["block text-sm", className].filter(Boolean).join(" ")}>
      <span className="mb-1 block text-xs font-medium text-foreground">
        {label}
        {required ? <span className="text-[var(--danger)]"> *</span> : null}
      </span>
      {children ?? (
        <input
          name={name}
          type={type}
          required={required}
          defaultValue={defaultValue}
          className={inputClass}
        />
      )}
      {hint ? <span className="mt-0.5 block text-[11px] text-muted">{hint}</span> : null}
    </label>
  );
}

export function HrPeopleWorkspace({
  tenantSlug,
  companyName,
  tenantBrand,
  currency,
  aiEnabled,
  teamMembers,
  profiles,
  payTemplates,
  profileDetails,
  profileOnboarding,
  ytdByUserId,
  initialOnboardUserId,
  offerByUserId,
  formRequests,
}: {
  tenantSlug: string;
  companyName: string;
  tenantBrand: TenantBranding;
  currency: string;
  aiEnabled: boolean;
  teamMembers: Array<{ userId: string; name: string; email: string; role: string; hasProfile: boolean }>;
  profiles: Array<{
    id: string;
    userId: string;
    fullName: string;
    position: string;
    department: string;
    status: string;
    statusValue: string;
    grossMonthly: number | null;
  }>;
  payTemplates: Array<{
    id: string;
    name: string;
    countryCode: string;
    basicPercent: number;
    housingPercent: number;
    transportPercent: number;
    otherPercent: number;
    pensionEnabled: boolean;
    employeePensionRate: number;
    employerPensionRate: number;
    isDefault: boolean;
  }>;
  profileDetails: ProfileDetailRow[];
  profileOnboarding: Array<{
    userId: string;
    profileId: string | null;
    items: ProfileChecklistItem[];
    percent: number;
  }>;
  ytdByUserId: Array<{ userId: string; ytd: PayslipYtdSummary }>;
  initialOnboardUserId?: string;
  offerByUserId?: Record<
    string,
    {
      bodyHtml: string;
      status: "DRAFT" | "AWAITING_SIGNATURE" | "SIGNED";
      signUrl?: string;
      profileId: string;
    }
  >;
  formRequests: Array<{
    id: string;
    employeeName: string;
    formTypeLabel: string;
    deliveryLabel: string;
    status: string;
    statusValue: string;
    expiresLabel: string;
    submittedAtLabel: string;
    hasFileUpload: boolean;
    submittedFileUrl: string | null;
    submittedPayload: Record<string, unknown> | null;
    reviewNote: string | null;
  }>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showSnackbar } = useSnackbar();
  const [onboardInitialStep, setOnboardInitialStep] = useState<OnboardingStepId>("personal");
  const [peopleTab, setPeopleTab] = useState<PeopleTab>(() =>
    searchParams.get("reviewForms") === "1" ? "requests" : "directory",
  );
  const [recordTab, setRecordTab] = useState<RecordTab>("personal");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [createdFormLinks, setCreatedFormLinks] = useState<
    Array<{ formTypeLabel: string; fillUrl: string; printUrl: string }>
  >([]);
  const [createdMasterUrl, setCreatedMasterUrl] = useState<string | undefined>();
  const [createdMasterPrintUrls, setCreatedMasterPrintUrls] = useState<
    Array<{ formTypeLabel: string; printUrl: string }>
  >([]);
  const [createdSendToEmail, setCreatedSendToEmail] = useState<string | undefined>();
  const [selectedFormTypes, setSelectedFormTypes] = useState<HrFormType[]>(["BIODATA"]);
  const [sendMode, setSendMode] = useState<"team" | "newcomer">("team");
  const [showOfferLetter, setShowOfferLetter] = useState(false);
  const [showHrOnlyForm, setShowHrOnlyForm] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteMode, setInviteMode] = useState<InviteMode>("single");
  const [inviteDepartment, setInviteDepartment] = useState("operations");
  const [inviteLead, setInviteLead] = useState(false);
  const [bulkInviteEmails, setBulkInviteEmails] = useState("");
  const [excelInviteRows, setExcelInviteRows] = useState<InviteRow[]>([]);
  const [excelInviteFile, setExcelInviteFile] = useState("");
  const [inviteResult, setInviteResult] = useState<{ invited: number; failed: Array<{ email: string; error: string }> } | null>(
    null,
  );
  const [showBulkApproveModal, setShowBulkApproveModal] = useState(false);
  const [showPayTemplateModal, setShowPayTemplateModal] = useState(false);

  const profileByUserId = useMemo(() => new Map(profileDetails.map((p) => [p.userId, p])), [profileDetails]);
  const onboardingByUserId = useMemo(
    () => new Map(profileOnboarding.map((o) => [o.userId, o])),
    [profileOnboarding],
  );
  const ytdByUser = useMemo(() => new Map(ytdByUserId.map((o) => [o.userId, o.ytd])), [ytdByUserId]);
  const selectedMember = teamMembers.find((m) => m.userId === selectedUserId);
  const selectedOnboarding = selectedUserId ? onboardingByUserId.get(selectedUserId) : undefined;
  const submittedRequests = formRequests.filter((request) => request.statusValue === "SUBMITTED");

  async function runAction(fn: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    setPending(true);
    try {
      const result = await fn();
      if (!result.ok) {
        showSnackbar(result.error || "Something went wrong.", "error");
        return false;
      }
      showSnackbar(success, "success");
      router.refresh();
      return true;
    } catch (error) {
      showSnackbar(error instanceof Error ? error.message : "The request failed. Please try again.", "error");
      return false;
    } finally {
      setPending(false);
    }
  }

  function closeInviteModal() {
    if (pending) return;
    setShowInviteModal(false);
    setInviteResult(null);
    setExcelInviteRows([]);
    setExcelInviteFile("");
  }

  function inviteRowsForEmails(emails: string[]): InviteRow[] {
    return Array.from(new Set(emails.map((email) => email.trim().toLowerCase()).filter(Boolean))).map((email) => ({
      email,
      accessKind: "department" as const,
      department: inviteDepartment,
      isDepartmentLead: inviteLead,
    }));
  }

  async function sendInvites(rows: InviteRow[]) {
    if (!rows.length) {
      showSnackbar("Add at least one email address.", "error");
      return;
    }
    setPending(true);
    setInviteResult(null);
    try {
      const result = await inviteTenantMembersBatch(tenantSlug, rows);
      setInviteResult({ invited: result.invited, failed: result.failed });
      if (result.invited) {
        showSnackbar(
          `${result.invited} invitation${result.invited === 1 ? "" : "s"} created${
            result.failed.length ? `; ${result.failed.length} could not be created` : ""
          }.`,
          result.failed.length ? "info" : "success",
        );
        router.refresh();
      } else {
        showSnackbar(result.failed[0]?.error || "No invitations were created.", "error");
      }
    } catch (error) {
      showSnackbar(error instanceof Error ? error.message : "Could not create invitations.", "error");
    } finally {
      setPending(false);
    }
  }

  async function readInviteWorkbook(file: File) {
    setPending(true);
    setInviteResult(null);
    try {
      const { default: ExcelJS } = await import("exceljs");
      const workbook = new ExcelJS.Workbook();
      const bytes = await file.arrayBuffer();
      await workbook.xlsx.load(bytes as unknown as Parameters<typeof workbook.xlsx.load>[0]);
      const sheet = workbook.worksheets[0];
      if (!sheet) throw new Error("The workbook does not contain a worksheet.");
      const headers = Array.from({ length: sheet.columnCount }, (_, index) =>
        sheet.getRow(1).getCell(index + 1).text.trim().toLowerCase(),
      );
      const emailColumn = headers.findIndex((header) => header === "email" || header === "email address") + 1;
      const departmentColumn = headers.findIndex((header) => header === "department") + 1;
      const leadColumn =
        headers.findIndex((header) => header === "department lead" || header === "lead" || header === "team lead") +
        1;
      if (!emailColumn) throw new Error("Add an Email column to the first row.");

      const rows: InviteRow[] = [];
      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const email = row.getCell(emailColumn).text.trim().toLowerCase();
        if (!email) return;
        const departmentText = departmentColumn ? row.getCell(departmentColumn).text.trim().toLowerCase() : "";
        const department =
          INVITE_DEPARTMENT_OPTIONS.find(
            (option) =>
              option.value.toLowerCase() === departmentText || option.label.toLowerCase() === departmentText,
          )?.value || inviteDepartment;
        const leadText = leadColumn ? row.getCell(leadColumn).text.trim().toLowerCase() : "";
        rows.push({
          email,
          accessKind: "department",
          department,
          isDepartmentLead: ["yes", "true", "1", "lead"].includes(leadText),
        });
      });
      if (!rows.length) throw new Error("No email addresses were found in the workbook.");
      if (rows.length > 100) throw new Error("Invite workbooks can contain up to 100 people at a time.");
      setExcelInviteRows(rows);
      setExcelInviteFile(file.name);
    } catch (error) {
      setExcelInviteRows([]);
      setExcelInviteFile("");
      showSnackbar(error instanceof Error ? error.message : "Could not read this workbook.", "error");
    } finally {
      setPending(false);
    }
  }

  async function downloadInviteTemplate() {
    await downloadExcel(
      "realcorp-team-invite-template",
      "Invites",
      ["Email", "Department", "Department Lead"],
      [
        { email: "employee@company.com", department: "operations", lead: "No" },
        { email: "manager@company.com", department: "hr", lead: "Yes" },
      ],
      ["email", "department", "lead"],
    );
  }

  function openRecord(userId: string, mode: "record" | "onboard" = "record") {
    setSelectedUserId(userId);
    setRecordTab("personal");
    setPeopleTab(mode);
  }

  function startOnboarding(userId: string, resumeStep?: OnboardingStepId) {
    const items = onboardingByUserId.get(userId)?.items ?? [];
    const step = resumeStep ?? resolveOnboardingStep(tenantSlug, userId, items);
    setOnboardInitialStep(step);
    setSelectedUserId(userId);
    setPeopleTab("onboard");
    router.replace(`/${tenantSlug}/hr/people?onboard=${encodeURIComponent(userId)}`, { scroll: false });
  }

  useEffect(() => {
    const onboardId = initialOnboardUserId || searchParams.get("onboard");
    if (!onboardId) return;
    const member = teamMembers.find((m) => m.userId === onboardId);
    if (!member) return;
    const items = onboardingByUserId.get(onboardId)?.items ?? [];
    setOnboardInitialStep(resolveOnboardingStep(tenantSlug, onboardId, items));
    setSelectedUserId(onboardId);
    setPeopleTab("onboard");
  }, [initialOnboardUserId, searchParams, teamMembers, onboardingByUserId, tenantSlug]);

  function openSendForm(formType: HrFormType) {
    const uid = selectedUserId;
    setSelectedFormTypes([formType]);
    setPeopleTab("send");
    setSendMode("team");
    const qs = new URLSearchParams();
    qs.set("send", "1");
    qs.set("forms", formType);
    if (uid) qs.set("forUser", uid);
    router.replace(`/${tenantSlug}/hr/people?${qs.toString()}`, { scroll: false });
  }

  function openSendAllForms() {
    const uid = selectedUserId;
    setSelectedFormTypes(["BIODATA", "BANK_FORM", "GUARANTOR", "HEALTH"]);
    setPeopleTab("send");
    setSendMode("team");
    const qs = new URLSearchParams();
    qs.set("send", "1");
    qs.set("forms", "BIODATA,BANK_FORM,GUARANTOR,HEALTH");
    if (uid) qs.set("forUser", uid);
    router.replace(`/${tenantSlug}/hr/people?${qs.toString()}`, { scroll: false });
  }

  function toggleFormType(ft: HrFormType) {
    setSelectedFormTypes((prev) =>
      prev.includes(ft) ? (prev.length > 1 ? prev.filter((x) => x !== ft) : prev) : [...prev, ft],
    );
  }

  useEffect(() => {
    if (searchParams.get("send") !== "1") return;
    const forUser = searchParams.get("forUser");
    const form = searchParams.get("form");
    const formsParam = searchParams.get("forms");
    setPeopleTab("send");
    setSendMode("team");
    if (forUser) setSelectedUserId(forUser);
    const types: HrFormType[] = [];
    if (formsParam) {
      for (const part of formsParam.split(",")) {
        const t = part.trim();
        if (t === "BIODATA" || t === "BANK_FORM" || t === "GUARANTOR" || t === "HEALTH") types.push(t);
      }
    } else if (form === "BIODATA" || form === "BANK_FORM" || form === "GUARANTOR" || form === "HEALTH") {
      types.push(form);
    }
    if (types.length > 0) setSelectedFormTypes(types);
    else if (form === "BIODATA" || form === "BANK_FORM" || form === "GUARANTOR" || form === "HEALTH") {
      setSelectedFormTypes([form]);
    }
  }, [searchParams]);

  function buildDraftFromTeam(member: { userId: string; name: string; email: string }): ProfileDetailRow {
    const existing = profileByUserId.get(member.userId);
    if (existing) return existing;
    const draft: ProfileDetailRow = {
      id: "",
      userId: member.userId,
      employeeNumber: "",
      status: "DRAFT",
      fullName: member.name,
      gender: "",
      dateOfBirth: "",
      maritalStatus: "",
      nationality: "",
      phoneMobile: "",
      workEmail: member.email,
      addressStreet: "",
      addressCity: "",
      addressState: "",
      addressCountry: "Nigeria",
      position: "",
      department: "",
      dateOfJoining: "",
      reportingToLabel: "",
      employmentType: "",
      workSchedule: "",
      paygroupName: "",
      payTemplateId: "",
      grossMonthly: "",
      payeeTaxMonthly: "",
      payrollCountryCode: "NG",
      payrollRegionCode: "",
      taxId: "",
      taxOverrideReason: "",
      pensionEnabled: "yes",
      employeePensionRate: "8",
      employerPensionRate: "10",
      nhfMonthly: "",
      nhiaMonthly: "",
      annualRent: "",
      annualLifeInsurance: "",
      annualMortgageInterest: "",
      otherPreTaxMonthly: "",
      otherPostTaxMonthly: "",
      basicPercent: "30",
      housingPercent: "20",
      transportPercent: "15",
      otherPercent: "35",
      hrNotes: "",
      bankAccountHolderName: member.name,
      bankName: "",
      bankAccountNumber: "",
      bankAccountType: "Checking",
      bankReceivePayments: "yes",
      emergencyName: "",
      emergencyRelationship: "",
      emergencyPhone: "",
      emergencyEmail: "",
      nextOfKinName: "",
      nextOfKinRelationship: "",
      nextOfKinPhone: "",
      nextOfKinEmail: "",
      nextOfKinStreet: "",
      nextOfKinCity: "",
      nextOfKinState: "",
      nextOfKinCountry: "Nigeria",
      nextOfKinOccupation: "",
      educationLevel: "",
      educationInstitution: "",
      educationQualification: "",
      educationYear: "",
    };
    const defaultTemplate = payTemplates.find((template) => template.isDefault);
    if (!defaultTemplate) return draft;
    return {
      ...draft,
      payTemplateId: defaultTemplate.id,
      payrollCountryCode: defaultTemplate.countryCode,
      basicPercent: String(defaultTemplate.basicPercent),
      housingPercent: String(defaultTemplate.housingPercent),
      transportPercent: String(defaultTemplate.transportPercent),
      otherPercent: String(defaultTemplate.otherPercent),
      pensionEnabled: defaultTemplate.pensionEnabled ? "yes" : "no",
      employeePensionRate: String(defaultTemplate.employeePensionRate),
      employerPensionRate: String(defaultTemplate.employerPensionRate),
    };
  }

  const record = selectedMember ? buildDraftFromTeam(selectedMember) : null;

  const peopleTabs: { id: PeopleTab; label: string }[] = [
    { id: "directory", label: "Team directory" },
    { id: "record", label: "Employee record" },
    { id: "send", label: "Send forms" },
    {
      id: "requests",
      label: `Form requests${
        formRequests.filter((request) => request.statusValue === "SUBMITTED").length
          ? ` (${formRequests.filter((request) => request.statusValue === "SUBMITTED").length})`
          : ""
      }`,
    },
  ];

  const recordTabs: { id: RecordTab; label: string }[] = [
    { id: "personal", label: "Personal" },
    { id: "job", label: "Job & pay" },
    { id: "bank", label: "Bank" },
    { id: "emergency", label: "Emergency" },
    { id: "family", label: "Family & education" },
  ];

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Everyone on <strong className="font-medium text-foreground">Team</strong> appears here. Open their
        record to edit details, or send them a form link to their work email.
      </p>

      <div className="flex flex-wrap gap-1 border-b border-foreground/10 pb-1">
        {peopleTabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setPeopleTab(t.id)}
            className={[
              "rounded-md px-3 py-2 text-sm font-medium transition-colors",
              peopleTab === t.id
                ? "bg-foreground text-background"
                : "text-muted hover:bg-foreground/[0.06] hover:text-foreground",
            ].join(" ")}
          >
            {t.label}
          </button>
        ))}
      </div>

      {peopleTab === "directory" && submittedRequests.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--warn-line)] bg-[var(--warn-wash)] px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-foreground">
              {submittedRequests.length} extracted form record{submittedRequests.length === 1 ? "" : "s"} need HR
              approval
            </p>
            <p className="text-xs text-muted">
              Employee and payroll records remain unchanged until these submissions are approved.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setPeopleTab("requests")}
            className="rounded-md bg-foreground px-3 py-2 text-xs font-semibold text-background"
          >
            Review pending work →
          </button>
        </div>
      ) : null}

      {peopleTab === "directory" ? (
        <div className="overflow-hidden rounded-lg border border-foreground/10">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-foreground/10 bg-foreground/[0.025] px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Employees and team members</p>
              <p className="mt-0.5 text-xs text-muted">Manage payroll records separately from software access.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowHrOnlyForm(true)}
                className="inline-flex items-center gap-1.5 rounded-md border border-foreground/15 bg-background px-3 py-2 text-xs font-semibold text-foreground hover:bg-foreground/[0.05]"
              >
                <UserPlus className="h-3.5 w-3.5" />
                Add HR/payroll member
              </button>
              <button
                type="button"
                onClick={() => {
                  setInviteResult(null);
                  setShowInviteModal(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-3 py-2 text-xs font-semibold text-background hover:opacity-90"
              >
                <Send className="h-3.5 w-3.5" />
                Invite members
              </button>
            </div>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-muted">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Email</th>
                <th className="px-3 py-2">Team role</th>
                <th className="px-3 py-2">HR record</th>
                <th className="px-3 py-2">Onboarding</th>
                <th className="px-3 py-2">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-foreground/10">
              {teamMembers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-muted">
                    No team members yet.{" "}
                    <Link href={`/${tenantSlug}/team`} className="font-semibold underline">
                      Invite on Team
                    </Link>
                  </td>
                </tr>
              ) : (
                teamMembers.map((m) => {
                  const prof = profiles.find((p) => p.userId === m.userId);
                  const onboard = onboardingByUserId.get(m.userId);
                  return (
                    <tr key={m.userId}>
                      <td className="px-3 py-2 font-medium">{m.name}</td>
                      <td className="px-3 py-2 text-xs text-muted">{m.email || "—"}</td>
                      <td className="px-3 py-2 text-xs">{m.role}</td>
                      <td className="px-3 py-2">
                        {prof ? (
                          <span className="rounded-full bg-[var(--success-wash)] px-2 py-0.5 text-xs font-medium text-[var(--success)]">
                            {prof.statusValue === "ACTIVE" ? "Active" : prof.status}
                          </span>
                        ) : (
                          <span className="rounded-full bg-[var(--warn-wash)] px-2 py-0.5 text-xs font-medium text-[var(--warn)]">
                            Not set up
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-foreground/10">
                            <div
                              className="h-full bg-[var(--success)]"
                              style={{ width: `${onboard?.percent ?? 0}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-muted">{onboard?.percent ?? 0}%</span>
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <button
                            type="button"
                            onClick={() =>
                              prof?.statusValue === "ACTIVE"
                                ? openRecord(m.userId)
                                : startOnboarding(
                                    m.userId,
                                    prof ? inferOnboardingStep(onboard?.items ?? []) : undefined,
                                  )
                            }
                            className="text-xs font-semibold underline"
                          >
                            {prof?.statusValue === "ACTIVE"
                              ? "Open record"
                              : prof
                                ? "Continue onboarding"
                                : "Start onboarding"}
                          </button>
                          {prof ? (
                            <Link
                              href={`/${tenantSlug}/hr/dashboard?employeeUserId=${encodeURIComponent(m.userId)}`}
                              className="text-[10px] text-muted underline"
                            >
                              Dashboard
                            </Link>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : null}

      {peopleTab === "onboard" && selectedMember && record ? (
        <HrOnboardingWizard
          tenantSlug={tenantSlug}
          currency={currency}
          memberName={selectedMember.name}
          memberEmail={selectedMember.email}
          record={record}
          payTemplates={payTemplates}
          checklist={selectedOnboarding?.items ?? []}
          checklistPercent={selectedOnboarding?.percent ?? 0}
          initialStep={onboardInitialStep}
          onCancel={() => {
            setPeopleTab("directory");
            router.replace(`/${tenantSlug}/hr/people`, { scroll: false });
          }}
          onComplete={() => {
            showSnackbar("Employee activated.", "success");
            router.replace(`/${tenantSlug}/hr/people`, { scroll: false });
            router.refresh();
            setPeopleTab("record");
          }}
          onGenerateOffer={() => setShowOfferLetter(true)}
          onSendForm={(ft) => openSendForm(ft)}
          onSendAllForms={openSendAllForms}
        />
      ) : null}

      {peopleTab === "record" ? (
        !selectedMember || !record ? (
          <div className="rounded-lg border border-dashed border-foreground/20 p-8 text-center text-sm text-muted">
            Pick someone from{" "}
            <button
              type="button"
              className="font-semibold underline"
              onClick={() => setPeopleTab("directory")}
            >
              Team directory
            </button>{" "}
            to view or edit their HR record.
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[1fr_minmax(240px,280px)]">
            <form
              className="rounded-lg border border-foreground/10 p-4 sm:p-5"
              onSubmit={(e) => {
                e.preventDefault();
                try {
                  const formData = new FormData(e.currentTarget);
                  if (!formData.has("fullName")) formData.set("fullName", record.fullName);
                  const payload = formDataToEmployeeProfilePayload(formData);
                  void runAction(() => upsertEmployeeProfile(tenantSlug, payload), "Employee record saved.");
                } catch (err) {
                  showSnackbar(err instanceof Error ? err.message : "Invalid form data.", "error");
                }
              }}
            >
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-foreground/10 pb-3">
                <div>
                  <p className="font-semibold text-foreground">{record.fullName || selectedMember.name}</p>
                  <p className="text-xs text-muted">{selectedMember.email}</p>
                </div>
                <button
                  type="button"
                  className="text-xs text-muted underline"
                  onClick={() => setPeopleTab("directory")}
                >
                  ← Back to directory
                </button>
              </div>

              <input type="hidden" name="userId" value={record.userId} />

              <div className="mb-4 flex flex-wrap gap-1">
                {recordTabs.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setRecordTab(t.id)}
                    className={[
                      "rounded-md px-2.5 py-1.5 text-xs font-medium",
                      recordTab === t.id
                        ? "bg-foreground/10 text-foreground"
                        : "text-muted hover:text-foreground",
                    ].join(" ")}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {recordTab === "personal" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    label="Full name"
                    name="fullName"
                    required
                    defaultValue={record.fullName || selectedMember.name}
                  />
                  <Field
                    label="Employee ID"
                    name="employeeNumber"
                    defaultValue={record.employeeNumber}
                    hint="Leave blank to auto-generate (e.g. BOPR-2026-0001)."
                  />
                  <Field label="Gender" name="gender" defaultValue={record.gender}>
                    <UiSelect name="gender" defaultValue={record.gender}>
                      <option value="">—</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </UiSelect>
                  </Field>
                  <Field
                    label="Date of birth"
                    name="dateOfBirth"
                    type="date"
                    defaultValue={record.dateOfBirth}
                  />
                  <Field label="Marital status" name="maritalStatus" defaultValue={record.maritalStatus} />
                  <Field label="Nationality" name="nationality" defaultValue={record.nationality} />
                  <Field
                    label="Mobile phone"
                    name="phoneMobile"
                    type="tel"
                    defaultValue={record.phoneMobile}
                  />
                  <Field
                    label="Work email"
                    name="workEmail"
                    type="email"
                    defaultValue={record.workEmail || selectedMember.email}
                    hint="From Team — used when you send forms."
                  />
                  <Field
                    label="Street address"
                    name="addressStreet"
                    defaultValue={record.addressStreet}
                    className="sm:col-span-2"
                  />
                  <GlobalLocationFields
                    countryName="addressCountry"
                    stateName="addressState"
                    cityName="addressCity"
                    defaultCountry={record.addressCountry || "Nigeria"}
                    defaultState={record.addressState}
                    defaultCity={record.addressCity}
                    className="grid gap-3 sm:col-span-2 sm:grid-cols-3"
                  />
                </div>
              ) : null}

              {recordTab === "job" ? (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Job title" name="position" defaultValue={record.position} />
                    <Field label="Department" name="department" defaultValue={record.department} />
                    <Field
                      label="Date of joining"
                      name="dateOfJoining"
                      type="date"
                      defaultValue={record.dateOfJoining}
                    />
                    <Field
                      label="Reports to"
                      name="reportingToLabel"
                      defaultValue={record.reportingToLabel}
                    />
                    <Field
                      label="Employment type"
                      name="employmentType"
                      defaultValue={record.employmentType}
                      hint="e.g. Full-Time, Contract"
                    />
                    <Field label="Work schedule" name="workSchedule" defaultValue={record.workSchedule} />
                    <Field
                      label="Pay group"
                      name="paygroupName"
                      defaultValue={record.paygroupName}
                      hint="Used to filter payroll runs (e.g. Lagos, Abuja)."
                    />
                    <div className="sm:col-span-2 rounded-lg border border-foreground/10 bg-foreground/[0.02] p-3">
                      <div className="flex flex-wrap items-end gap-2">
                        <label className="min-w-[220px] flex-1 text-sm">
                          <span className="mb-1 block text-xs font-medium text-foreground">Pay template</span>
                          <UiSelect
                            defaultValue={record.payTemplateId}
                            disabled={pending}
                            onChange={(event) => {
                              if (!event.target.value) return;
                              void runAction(
                                () =>
                                  applyPayTemplate(tenantSlug, {
                                    employeeProfileId: record.id,
                                    templateId: event.target.value,
                                  }),
                                "Pay template applied.",
                              );
                            }}
                          >
                            <option value="">Custom allocation</option>
                            {payTemplates.map((template) => (
                              <option key={template.id} value={template.id}>
                                {template.name} · {template.countryCode}
                                {template.isDefault ? " · Default" : ""}
                              </option>
                            ))}
                          </UiSelect>
                        </label>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => setShowPayTemplateModal(true)}
                          className="rounded-md border border-foreground/15 px-3 py-2 text-xs font-semibold hover:bg-foreground/[0.05] disabled:opacity-50"
                        >
                          Create template
                        </button>
                      </div>
                      <p className="mt-2 text-[11px] text-muted">
                        Applying a template copies its current allocation to this employee. You can still override the
                        percentages below.
                      </p>
                    </div>
                    <Field
                      label={`Monthly gross pay (${currency})`}
                      name="grossMonthly"
                      defaultValue={record.grossMonthly}
                      hint="Numbers only — used for payslips."
                    >
                      <input
                        name="grossMonthly"
                        type="number"
                        min={0}
                        step={0.01}
                        inputMode="decimal"
                        defaultValue={record.grossMonthly}
                        className={inputClass}
                        onKeyDown={(e) => {
                          if (["e", "E", "+", "-"].includes(e.key)) e.preventDefault();
                        }}
                      />
                    </Field>
                    <Field
                      label="Basic salary (%)"
                      name="basicPercent"
                      type="number"
                      defaultValue={record.basicPercent}
                    />
                    <Field
                      label="Housing allowance (%)"
                      name="housingPercent"
                      type="number"
                      defaultValue={record.housingPercent}
                    />
                    <Field
                      label="Transport allowance (%)"
                      name="transportPercent"
                      type="number"
                      defaultValue={record.transportPercent}
                    />
                    <Field
                      label="Other earnings (%)"
                      name="otherPercent"
                      type="number"
                      defaultValue={record.otherPercent}
                      hint="The four salary allocation percentages must total 100%."
                    />
                    <Field
                      label={`PAYE tax override (${currency})`}
                      name="payeeTaxMonthly"
                      defaultValue={record.payeeTaxMonthly}
                      hint="Leave blank for the reviewed country tax engine. Overrides are audited."
                    >
                      <input
                        name="payeeTaxMonthly"
                        type="number"
                        min={0}
                        step={0.01}
                        inputMode="decimal"
                        defaultValue={record.payeeTaxMonthly}
                        className={inputClass}
                        onKeyDown={(e) => {
                          if (["e", "E", "+", "-"].includes(e.key)) e.preventDefault();
                        }}
                      />
                    </Field>
                    <Field
                      label="Payroll country (ISO code)"
                      name="payrollCountryCode"
                      defaultValue={record.payrollCountryCode}
                      hint="NG is available now. Other countries require a reviewed rule pack before payroll can run."
                    />
                    <Field
                      label="Tax region / state code"
                      name="payrollRegionCode"
                      defaultValue={record.payrollRegionCode}
                    />
                    <Field label="Tax identification number" name="taxId" defaultValue={record.taxId} />
                    <Field
                      label="Tax override reason"
                      name="taxOverrideReason"
                      defaultValue={record.taxOverrideReason}
                      hint="Required operational evidence whenever a manual PAYE amount is used."
                    />
                  </div>
                  <details className="rounded-lg border border-foreground/10 bg-foreground/[0.02] p-4">
                    <summary className="cursor-pointer text-sm font-semibold text-foreground">
                      Statutory deductions and verified reliefs
                    </summary>
                    <p className="mt-1 text-xs text-muted">
                      Enter only amounts supported by employee evidence. Annual reliefs are apportioned and included in
                      the calculation snapshot.
                    </p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <Field label="Pension participation" name="pensionEnabled" defaultValue={record.pensionEnabled}>
                        <UiSelect name="pensionEnabled" defaultValue={record.pensionEnabled}>
                          <option value="yes">Enabled</option>
                          <option value="no">Not applicable</option>
                        </UiSelect>
                      </Field>
                      <div />
                      <Field
                        label="Employee pension rate (%)"
                        name="employeePensionRate"
                        type="number"
                        defaultValue={record.employeePensionRate}
                      />
                      <Field
                        label="Employer pension rate (%)"
                        name="employerPensionRate"
                        type="number"
                        defaultValue={record.employerPensionRate}
                      />
                      <Field label={`NHF monthly (${currency})`} name="nhfMonthly" type="number" defaultValue={record.nhfMonthly} />
                      <Field label={`NHIA monthly (${currency})`} name="nhiaMonthly" type="number" defaultValue={record.nhiaMonthly} />
                      <Field label={`Annual rent paid (${currency})`} name="annualRent" type="number" defaultValue={record.annualRent} />
                      <Field
                        label={`Annual life insurance (${currency})`}
                        name="annualLifeInsurance"
                        type="number"
                        defaultValue={record.annualLifeInsurance}
                      />
                      <Field
                        label={`Annual mortgage interest (${currency})`}
                        name="annualMortgageInterest"
                        type="number"
                        defaultValue={record.annualMortgageInterest}
                      />
                      <Field
                        label={`Other pre-tax monthly (${currency})`}
                        name="otherPreTaxMonthly"
                        type="number"
                        defaultValue={record.otherPreTaxMonthly}
                      />
                      <Field
                        label={`Other post-tax monthly (${currency})`}
                        name="otherPostTaxMonthly"
                        type="number"
                        defaultValue={record.otherPostTaxMonthly}
                      />
                    </div>
                  </details>
                  <PayslipYtdCard
                    ytd={selectedUserId ? (ytdByUser.get(selectedUserId) ?? null) : null}
                    currency={currency}
                  />
                </div>
              ) : null}

              {recordTab === "bank" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    label="Account holder name"
                    name="bankAccountHolderName"
                    defaultValue={record.bankAccountHolderName}
                  />
                  <Field label="Bank name" name="bankName" defaultValue={record.bankName} />
                  <Field
                    label="Account number"
                    name="bankAccountNumber"
                    defaultValue={record.bankAccountNumber}
                  />
                  <Field label="Account type" name="bankAccountType" defaultValue={record.bankAccountType}>
                    <UiSelect name="bankAccountType" defaultValue={record.bankAccountType || "Checking"}>
                      <option value="Checking">Checking</option>
                      <option value="Savings">Savings</option>
                      <option value="Other">Other</option>
                    </UiSelect>
                  </Field>
                  <Field
                    label="Use for salary payments?"
                    name="bankReceivePayments"
                    defaultValue={record.bankReceivePayments}
                  >
                    <UiSelect name="bankReceivePayments" defaultValue={record.bankReceivePayments}>
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </UiSelect>
                  </Field>
                </div>
              ) : null}

              {recordTab === "emergency" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Contact name" name="emergencyName" defaultValue={record.emergencyName} />
                  <Field
                    label="Relationship"
                    name="emergencyRelationship"
                    defaultValue={record.emergencyRelationship}
                  />
                  <Field
                    label="Phone"
                    name="emergencyPhone"
                    type="tel"
                    defaultValue={record.emergencyPhone}
                  />
                  <Field
                    label="Email"
                    name="emergencyEmail"
                    type="email"
                    defaultValue={record.emergencyEmail}
                  />
                </div>
              ) : null}

              {recordTab === "family" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <p className="sm:col-span-2 text-xs font-semibold uppercase tracking-wide text-muted">
                    Next of kin
                  </p>
                  <Field label="Full name" name="nextOfKinName" defaultValue={record.nextOfKinName} />
                  <Field
                    label="Relationship"
                    name="nextOfKinRelationship"
                    defaultValue={record.nextOfKinRelationship}
                  />
                  <Field
                    label="Phone"
                    name="nextOfKinPhone"
                    type="tel"
                    defaultValue={record.nextOfKinPhone}
                  />
                  <Field
                    label="Email"
                    name="nextOfKinEmail"
                    type="email"
                    defaultValue={record.nextOfKinEmail}
                  />
                  <Field label="Street" name="nextOfKinStreet" defaultValue={record.nextOfKinStreet} />
                  <GlobalLocationFields
                    countryName="nextOfKinCountry"
                    stateName="nextOfKinState"
                    cityName="nextOfKinCity"
                    defaultCountry={record.nextOfKinCountry || record.addressCountry || "Nigeria"}
                    defaultState={record.nextOfKinState}
                    defaultCity={record.nextOfKinCity}
                    className="grid gap-3 sm:col-span-2 sm:grid-cols-3"
                  />
                  <Field
                    label="Occupation"
                    name="nextOfKinOccupation"
                    defaultValue={record.nextOfKinOccupation}
                  />
                  <p className="sm:col-span-2 mt-2 text-xs font-semibold uppercase tracking-wide text-muted">
                    Education
                  </p>
                  <Field label="Highest level" name="educationLevel" defaultValue={record.educationLevel} />
                  <Field
                    label="Institution"
                    name="educationInstitution"
                    defaultValue={record.educationInstitution}
                  />
                  <Field
                    label="Qualification"
                    name="educationQualification"
                    defaultValue={record.educationQualification}
                  />
                  <Field label="Year" name="educationYear" defaultValue={record.educationYear} />
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2 border-t border-foreground/10 pt-4">
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-50"
                >
                  {pending ? "Saving…" : "Save record"}
                </button>
                <button
                  type="button"
                  className="rounded-md border border-foreground/20 px-4 py-2 text-sm font-semibold"
                  onClick={() => openSendForm("BIODATA")}
                >
                  Send form to this person
                </button>
                <button
                  type="button"
                  className="rounded-md border border-foreground/20 px-4 py-2 text-sm font-semibold"
                  onClick={() => setShowOfferLetter(true)}
                >
                  Offer letter
                </button>
                {profiles.find((p) => p.userId === selectedMember.userId)?.statusValue !== "ACTIVE" ? (
                  <button
                    type="button"
                    className="text-sm font-semibold text-[var(--accent)] underline"
                    onClick={() => startOnboarding(selectedMember.userId)}
                  >
                    Open onboarding wizard
                  </button>
                ) : null}
              </div>
            </form>
            <ProfileComplianceChecklist
              items={selectedOnboarding?.items ?? []}
              percent={selectedOnboarding?.percent ?? 0}
              tenantSlug={tenantSlug}
              onGenerateOffer={() => setShowOfferLetter(true)}
              onSendForm={(ft) => openSendForm(ft)}
              onSendAllForms={openSendAllForms}
              onPrefillFromDocs={() => {
                void (async () => {
                  setPending(true);
                  const result = await prefillEmployeeFromUploadedDocs(
                    tenantSlug,
                    selectedMember.userId,
                  );
                  setPending(false);
                  if (!result.ok) {
                    showSnackbar(result.error, "error");
                    return;
                  }
                  if (!result.applied) {
                    showSnackbar(
                      result.failed[0]?.error ||
                        "Uploaded files were found, but no employee fields could be read.",
                      "error",
                    );
                    return;
                  }
                  showSnackbar(
                    `Filled ${result.filled.join(", ") || "employee fields"} from uploaded documents.`,
                    "success",
                  );
                  router.refresh();
                })();
              }}
              prefillPending={pending}
            />
          </div>
        )
      ) : null}

      {peopleTab === "send" ? (
        <form
          className="overflow-hidden rounded-xl border border-foreground/10 bg-background shadow-sm"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            void (async () => {
              setPending(true);
              setCreatedFormLinks([]);
              setCreatedMasterUrl(undefined);
              setCreatedMasterPrintUrls([]);
              setCreatedSendToEmail(undefined);
              const mode = String(fd.get("sendMode") || "team");
              const formTypes = selectedFormTypes;
              if (formTypes.length === 0) {
                setPending(false);
                showSnackbar("Select at least one form.", "error");
                return;
              }
              const result = await createHrFormRequestsBatch(tenantSlug, {
                userId: mode === "team" ? String(fd.get("userId") || "") : undefined,
                recipientName: mode === "newcomer" ? String(fd.get("recipientName") || "") : undefined,
                recipientEmail: mode === "newcomer" ? String(fd.get("recipientEmail") || "") : undefined,
                formTypes,
                deliveryMode: String(fd.get("deliveryMode") || "BOTH") as HrFormDeliveryMode,
                expiresInDays: Number(fd.get("expiresInDays") || 14),
                hrNote: String(fd.get("hrNote") || ""),
              });
              setPending(false);
              if (!result.ok) {
                showSnackbar(result.error || "Failed", "error");
                return;
              }
              if (result.links?.length) {
                setCreatedSendToEmail(result.sendToEmail);
                setCreatedMasterUrl(result.masterUrl);
                setCreatedMasterPrintUrls(result.masterPrintUrls ?? []);
                setCreatedFormLinks(
                  result.links.map((l) => ({
                    formTypeLabel: l.formTypeLabel,
                    fillUrl: l.fillUrl,
                    printUrl: l.printUrl,
                  })),
                );
              }
              const emailHint = result.sendToEmail ? ` Send to: ${result.sendToEmail}` : "";
              const isBundle = (result.links?.length ?? 0) > 1;
              showSnackbar(
                isBundle ? `Master onboarding link ready.${emailHint}` : `Form link ready.${emailHint}`,
                "success",
              );
              router.refresh();
            })();
          }}
        >
          <div className="border-b border-foreground/10 bg-foreground/[0.025] px-5 py-4">
            <p className="text-base font-semibold text-foreground">Create onboarding link</p>
            <p className="mt-0.5 text-xs text-muted">
              Choose the recipient and forms. Multiple forms are combined into one guided link.
            </p>
          </div>

          <div className="p-5">
            <div className="flex gap-1 rounded-lg border border-foreground/10 bg-foreground/[0.035] p-1">
            <label className="flex flex-1 cursor-pointer items-center justify-center rounded-md px-3 py-2.5 text-sm transition has-[:checked]:bg-background has-[:checked]:font-semibold has-[:checked]:shadow-sm">
              <input
                type="radio"
                name="sendMode"
                value="team"
                checked={sendMode === "team"}
                onChange={() => setSendMode("team")}
                className="sr-only"
              />
              Team member
            </label>
            <label className="flex flex-1 cursor-pointer items-center justify-center rounded-md px-3 py-2.5 text-sm transition has-[:checked]:bg-background has-[:checked]:font-semibold has-[:checked]:shadow-sm">
              <input
                type="radio"
                name="sendMode"
                value="newcomer"
                checked={sendMode === "newcomer"}
                onChange={() => setSendMode("newcomer")}
                className="sr-only"
              />
              New joiner
            </label>
          </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
              <div className="space-y-5">
                <section>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">Recipient</p>
                    {sendMode === "team" && selectedMember ? (
                      <Link
                        href={`/${tenantSlug}/hr/dashboard?employeeUserId=${selectedMember.userId}`}
                        className="text-xs font-semibold text-foreground underline"
                      >
                        Preview dashboard
                      </Link>
                    ) : null}
                  </div>
                  <div className="rounded-lg border border-foreground/10 bg-foreground/[0.02] p-3">
                    {sendMode === "team" ? (
                      <Field label="Employee" name="userId" required>
                        <UiSelect
                          name="userId"
                          defaultValue={selectedUserId ?? ""}
                          key={`send-user-${selectedUserId ?? "none"}`}
                          onChange={(event) => setSelectedUserId(event.target.value || null)}
                        >
                          <option value="">Select employee…</option>
                          {teamMembers.map((m) => (
                            <option key={m.userId} value={m.userId}>
                              {m.name} — {m.email}
                            </option>
                          ))}
                        </UiSelect>
                      </Field>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Full name" name="recipientName" required />
                        <Field label="Email address" name="recipientEmail" type="email" required />
                      </div>
                    )}
                    {sendMode === "team" && selectedMember ? (
                      <div className="mt-3 flex items-center gap-3 rounded-md bg-[var(--success-wash)] px-3 py-2">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--success)] text-xs font-bold text-white">
                          {selectedMember.name.slice(0, 1).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">{selectedMember.name}</p>
                          <p className="truncate text-xs text-muted">{selectedMember.email}</p>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </section>

                <section>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">Forms</p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {HR_FORM_OPTIONS.map((opt) => {
                      const on = selectedFormTypes.includes(opt.value);
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => toggleFormType(opt.value)}
                          className={[
                            "flex items-center justify-between rounded-lg border px-3 py-3 text-left text-sm font-medium transition-all",
                            on
                              ? "border-foreground bg-foreground text-background shadow-sm"
                              : "border-foreground/10 bg-background text-foreground hover:border-foreground/25 hover:bg-foreground/[0.025]",
                          ].join(" ")}
                        >
                          <span>{opt.label}</span>
                          <span
                            className={[
                              "flex h-5 w-5 items-center justify-center rounded-full border text-[11px]",
                              on ? "border-background/30 bg-background/15" : "border-foreground/15",
                            ].join(" ")}
                          >
                            {on ? "✓" : ""}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              </div>

              <aside className="rounded-xl border border-foreground/10 bg-foreground/[0.025] p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Delivery</p>
                <div className="mt-3 space-y-3">
                  <Field label="Completion method" name="deliveryMode">
                    <UiSelect name="deliveryMode" defaultValue="BOTH">
                      <option value="ONLINE_FILL">Fill online</option>
                      <option value="PRINT_UPLOAD">Print and upload</option>
                      <option value="BOTH">Online or print and upload</option>
                    </UiSelect>
                  </Field>
                  <Field label="Link expires after" name="expiresInDays">
                    <div className="relative">
                      <input
                        name="expiresInDays"
                        type="number"
                        min={1}
                        max={90}
                        defaultValue={14}
                        className={`${inputClass} pr-14`}
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">
                        days
                      </span>
                    </div>
                  </Field>
                  <Field label="Message" name="hrNote" hint="Optional note shown to the recipient." />
                </div>

                <div className="mt-4 rounded-lg border border-foreground/10 bg-background p-3">
                  <p className="text-xs text-muted">Request summary</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {selectedFormTypes.length} form{selectedFormTypes.length === 1 ? "" : "s"}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    {selectedFormTypes.length > 1 ? "One master onboarding link" : "One secure form link"}
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={pending || selectedFormTypes.length === 0}
                  className="mt-4 inline-flex w-full items-center justify-center rounded-md border border-foreground bg-foreground px-4 py-2.5 text-sm font-semibold text-background transition hover:opacity-90 disabled:opacity-50"
                >
                  {pending
                    ? "Creating link…"
                    : selectedFormTypes.length > 1
                      ? "Create onboarding link"
                      : "Create form link"}
                </button>
              </aside>
            </div>
          </div>

          {createdMasterUrl || createdFormLinks.length > 0 ? (
            <div className="mx-5 mb-5 space-y-3 rounded-lg border border-[var(--success-line)] bg-[var(--success-wash)] p-4 text-xs">
              {createdSendToEmail ? (
                <p className="font-semibold text-foreground">Send to: {createdSendToEmail}</p>
              ) : null}
              {createdMasterUrl && createdFormLinks.length > 1 ? (
                <>
                  <p className="font-medium text-foreground">
                    Master onboarding link — one URL for all {createdFormLinks.length} sections
                  </p>
                  <input
                    readOnly
                    value={createdMasterUrl}
                    className="w-full border border-foreground/15 bg-field px-2 py-1.5 font-mono text-[11px]"
                    onFocus={(ev) => ev.target.select()}
                  />
                  {createdMasterPrintUrls.length > 0 ? (
                    <details className="mt-2">
                      <summary className="cursor-pointer font-medium text-muted">
                        Print blank forms (per section)
                      </summary>
                      <ul className="mt-2 space-y-2">
                        {createdMasterPrintUrls.map((p) => (
                          <li key={p.formTypeLabel}>
                            <p className="font-semibold text-foreground">{p.formTypeLabel}</p>
                            <input
                              readOnly
                              value={p.printUrl}
                              className="w-full border border-foreground/15 bg-field px-2 py-1 font-mono text-[11px]"
                              onFocus={(ev) => ev.target.select()}
                            />
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
                </>
              ) : createdFormLinks.length === 1 ? (
                <>
                  <p className="font-medium text-foreground">{createdFormLinks[0]!.formTypeLabel}</p>
                  <p className="text-muted">Online</p>
                  <input
                    readOnly
                    value={createdFormLinks[0]!.fillUrl}
                    className="mt-0.5 w-full border border-foreground/15 bg-field px-2 py-1 font-mono text-[11px]"
                    onFocus={(ev) => ev.target.select()}
                  />
                  <p className="mt-1 text-muted">Print blank</p>
                  <input
                    readOnly
                    value={createdFormLinks[0]!.printUrl}
                    className="w-full border border-foreground/15 bg-field px-2 py-1 font-mono text-[11px]"
                    onFocus={(ev) => ev.target.select()}
                  />
                </>
              ) : null}
            </div>
          ) : null}
        </form>
      ) : null}

      {peopleTab === "requests" ? (
        formRequests.length === 0 ? (
          <p className="text-sm text-muted">No form requests yet. Send a form from the Send forms tab.</p>
        ) : (
          <div className="space-y-3">
            {submittedRequests.length > 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--warn-line)] bg-[var(--warn-wash)] px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {submittedRequests.length} record{submittedRequests.length === 1 ? "" : "s"} ready for review
                  </p>
                  <p className="text-xs text-muted">
                    Bulk approval applies all extracted fields to their matched employees.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setShowBulkApproveModal(true)}
                  className="rounded-md bg-foreground px-3 py-2 text-xs font-semibold text-background disabled:opacity-50"
                >
                  {pending ? "Approving…" : `Approve all ${submittedRequests.length}`}
                </button>
              </div>
            ) : null}
            <div className="overflow-hidden rounded-lg border border-foreground/10">
              <table className="w-full text-left text-sm">
              <thead className="bg-foreground/[0.03] text-xs uppercase text-muted">
                <tr>
                  <th className="px-3 py-2">Person</th>
                  <th className="px-3 py-2">Form</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Expires</th>
                  <th className="px-3 py-2">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-foreground/10">
                {formRequests.map((r) => (
                  <tr key={r.id}>
                    <td className="px-3 py-2">{r.employeeName}</td>
                    <td className="px-3 py-2">
                      {r.formTypeLabel}
                      {r.submittedPayload ? (
                        <details className="mt-1 max-w-sm text-xs">
                          <summary className="cursor-pointer font-semibold text-[var(--accent)]">
                            Review extracted data
                          </summary>
                          {r.reviewNote ? <p className="mt-1 text-[10px] text-muted">{r.reviewNote}</p> : null}
                          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 rounded-md bg-foreground/[0.04] p-2">
                            {Object.entries(r.submittedPayload)
                              .filter(([, value]) => value !== "" && value != null)
                              .map(([key, value]) => (
                                <div key={key} className="contents">
                                  <dt className="font-medium text-muted">{key.replace(/([A-Z])/g, " $1")}</dt>
                                  <dd className="break-words text-foreground">{String(value)}</dd>
                                </div>
                              ))}
                          </dl>
                          {r.submittedFileUrl ? (
                            <a
                              href={r.submittedFileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-2 inline-block font-semibold underline"
                            >
                              Open source document
                            </a>
                          ) : null}
                        </details>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      {r.status}
                      {r.submittedAtLabel !== "—" ? (
                        <span className="block text-[10px] text-muted">{r.submittedAtLabel}</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-xs">{r.expiresLabel}</td>
                    <td className="px-3 py-2 space-x-2">
                      {r.statusValue === "SUBMITTED" ? (
                        <button
                          type="button"
                          className="text-xs font-semibold text-[var(--success)] underline"
                          onClick={() =>
                            void runAction(() => approveHrFormRequest(tenantSlug, r.id), "Approved.")
                          }
                        >
                          Approve
                        </button>
                      ) : null}
                      {r.statusValue === "PENDING" || r.statusValue === "SUBMITTED" ? (
                        <button
                          type="button"
                          className="text-xs text-muted underline"
                          onClick={() =>
                            void runAction(() => cancelHrFormRequest(tenantSlug, r.id), "Cancelled.")
                          }
                        >
                          Cancel
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
          </div>
        )
      ) : null}

      <ModalOverlay
        open={showPayTemplateModal}
        onClose={() => {
          if (!pending) setShowPayTemplateModal(false);
        }}
        panelClassName={MODAL_PANEL_FORM}
        aria-labelledby="pay-template-title"
      >
        <div>
          <h2 id="pay-template-title" className="text-xl font-semibold text-foreground">
            Create pay template
          </h2>
          <p className="mt-1 text-sm text-muted">
            Reuse one salary allocation across employees, then override individual records when needed.
          </p>
        </div>
        <form
          className="mt-5 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            const data = {
              name: String(formData.get("name") || ""),
              countryCode: String(formData.get("countryCode") || "NG"),
              basicPercent: Number(formData.get("basicPercent")),
              housingPercent: Number(formData.get("housingPercent")),
              transportPercent: Number(formData.get("transportPercent")),
              otherPercent: Number(formData.get("otherPercent")),
              pensionEnabled: formData.get("pensionEnabled") === "on",
              employeePensionRate: Number(formData.get("employeePensionRate")),
              employerPensionRate: Number(formData.get("employerPensionRate")),
              isDefault: formData.get("isDefault") === "on",
            };
            void runAction(() => createPayTemplate(tenantSlug, data), "Pay template created.").then((ok) => {
              if (ok) setShowPayTemplateModal(false);
            });
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Template name" name="name" required />
            <Field
              label="Payroll country code"
              name="countryCode"
              defaultValue={record?.payrollCountryCode || "NG"}
              required
            />
            <Field
              label="Basic (%)"
              name="basicPercent"
              type="number"
              defaultValue={record?.basicPercent || "30"}
              required
            />
            <Field
              label="Housing (%)"
              name="housingPercent"
              type="number"
              defaultValue={record?.housingPercent || "20"}
              required
            />
            <Field
              label="Transport (%)"
              name="transportPercent"
              type="number"
              defaultValue={record?.transportPercent || "15"}
              required
            />
            <Field
              label="Other earnings (%)"
              name="otherPercent"
              type="number"
              defaultValue={record?.otherPercent || "35"}
              required
            />
            <Field
              label="Employee pension (%)"
              name="employeePensionRate"
              type="number"
              defaultValue={record?.employeePensionRate || "8"}
              required
            />
            <Field
              label="Employer pension (%)"
              name="employerPensionRate"
              type="number"
              defaultValue={record?.employerPensionRate || "10"}
              required
            />
          </div>
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <label className="flex items-center gap-2">
              <input name="pensionEnabled" type="checkbox" defaultChecked={record?.pensionEnabled !== "no"} />
              Pension applies
            </label>
            <label className="flex items-center gap-2">
              <input name="isDefault" type="checkbox" />
              Default for this country
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => setShowPayTemplateModal(false)}
              className="rounded-md border border-foreground/15 px-4 py-2 text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-50"
            >
              {pending ? "Creating…" : "Create template"}
            </button>
          </div>
        </form>
      </ModalOverlay>

      <ModalOverlay
        open={showHrOnlyForm}
        onClose={() => {
          if (!pending) setShowHrOnlyForm(false);
        }}
        panelClassName={MODAL_PANEL_FORM}
        aria-labelledby="add-hr-member-title"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="add-hr-member-title" className="text-xl font-semibold text-foreground">
              Add HR/payroll member
            </h2>
            <p className="mt-1 text-sm text-muted">
              Create an employee record for payroll, headcount and documents without giving software access.
            </p>
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={() => setShowHrOnlyForm(false)}
            className="text-sm font-medium text-muted underline disabled:opacity-50"
          >
            Close
          </button>
        </div>
        <form
          className="mt-6"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const data = Object.fromEntries(new FormData(form));
            void runAction(() => createHrOnlyEmployee(tenantSlug, data), "HR/payroll member added.").then((ok) => {
              if (ok) {
                form.reset();
                setShowHrOnlyForm(false);
              }
            });
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" name="fullName" required />
            <Field label="Work email (optional)" name="workEmail" type="email" />
            <Field label="Phone" name="phoneMobile" />
            <Field label="Job title" name="position" />
            <Field label="Department" name="department" />
            <Field label="Pay group" name="paygroupName" />
            <Field label={`Gross monthly pay (${currency})`} name="grossMonthly" type="number" />
          </div>
          <div className="mt-5 rounded-lg border border-[var(--info-line)] bg-[var(--info-wash)] px-4 py-3 text-xs text-foreground">
            This person will not receive an invitation and cannot sign in. You can invite them separately later.
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => setShowHrOnlyForm(false)}
              className="rounded-md border border-foreground/15 px-4 py-2 text-sm font-medium hover:bg-foreground/[0.05] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex items-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background hover:opacity-90 disabled:opacity-50"
            >
              {pending ? <ButtonSpinner /> : <UserPlus className="h-4 w-4" />}
              {pending ? "Adding member…" : "Add HR/payroll member"}
            </button>
          </div>
        </form>
      </ModalOverlay>

      <ModalOverlay
        open={showInviteModal}
        onClose={closeInviteModal}
        panelClassName={MODAL_PANEL_FORM}
        aria-labelledby="invite-members-title"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="invite-members-title" className="text-xl font-semibold text-foreground">
              Invite members
            </h2>
            <p className="mt-1 text-sm text-muted">
              Send {companyName} software access to one person or a whole team.
            </p>
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={closeInviteModal}
            className="text-sm font-medium text-muted underline disabled:opacity-50"
          >
            Close
          </button>
        </div>

        <form
          className="mt-6"
          onSubmit={(event) => {
            event.preventDefault();
            if (inviteMode === "single") {
              const email = String(new FormData(event.currentTarget).get("inviteEmail") || "");
              void sendInvites(inviteRowsForEmails([email]));
            } else if (inviteMode === "bulk") {
              void sendInvites(inviteRowsForEmails(bulkInviteEmails.split(/[\s,;]+/)));
            } else {
              void sendInvites(excelInviteRows);
            }
          }}
        >
          <div className="grid gap-3 sm:grid-cols-3">
            {(
              [
                { id: "single", label: "One person", hint: "Send one invitation", icon: UserPlus },
                { id: "bulk", label: "Bulk invite", hint: "Paste multiple emails", icon: Users },
                { id: "excel", label: "Excel upload", hint: "Import a prepared list", icon: FileSpreadsheet },
              ] as const
            ).map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    setInviteMode(option.id);
                    setInviteResult(null);
                  }}
                  className={[
                    "rounded-lg border p-3 text-left transition",
                    inviteMode === option.id
                      ? "border-foreground bg-foreground text-background"
                      : "border-foreground/10 bg-background hover:border-foreground/25",
                  ].join(" ")}
                >
                  <Icon className="h-4 w-4" />
                  <span className="mt-2 block text-sm font-semibold">{option.label}</span>
                  <span className={inviteMode === option.id ? "text-xs text-background/70" : "text-xs text-muted"}>
                    {option.hint}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-5 rounded-xl border border-foreground/10 bg-foreground/[0.02] p-4">
            {inviteMode === "single" ? (
              <Field label="Work email" name="inviteEmail" type="email" required />
            ) : null}
            {inviteMode === "bulk" ? (
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-foreground">Email addresses</span>
                <textarea
                  value={bulkInviteEmails}
                  onChange={(event) => setBulkInviteEmails(event.target.value)}
                  rows={6}
                  placeholder={"ada@company.com\nchidi@company.com\nfatima@company.com"}
                  className={`${inputClass} resize-y font-mono text-xs`}
                />
                <span className="mt-1 block text-[11px] text-muted">
                  Separate addresses with new lines, commas or spaces.
                </span>
              </label>
            ) : null}
            {inviteMode === "excel" ? (
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Upload invite workbook</p>
                    <p className="mt-0.5 text-xs text-muted">Columns: Email, Department, Department Lead.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void downloadInviteTemplate()}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold underline"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download template
                  </button>
                </div>
                <label className="mt-4 flex cursor-pointer flex-col items-center rounded-lg border border-dashed border-foreground/20 bg-background px-4 py-7 text-center hover:border-foreground/40">
                  <FileSpreadsheet className="h-7 w-7 text-muted" />
                  <span className="mt-2 text-sm font-semibold text-foreground">
                    {excelInviteFile || "Choose Excel file"}
                  </span>
                  <span className="mt-1 text-xs text-muted">.xlsx files up to 100 invitations</span>
                  <input
                    type="file"
                    accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    className="sr-only"
                    disabled={pending}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void readInviteWorkbook(file);
                    }}
                  />
                </label>
                {excelInviteRows.length ? (
                  <div className="mt-3 rounded-md border border-[var(--success-line)] bg-[var(--success-wash)] px-3 py-2 text-xs text-foreground">
                    {excelInviteRows.length} valid invitation{excelInviteRows.length === 1 ? "" : "s"} ready to send.
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block text-xs font-medium text-foreground">
                {inviteMode === "excel" ? "Fallback department" : "Department"}
              </span>
              <UiSelect value={inviteDepartment} onChange={(event) => setInviteDepartment(event.target.value)}>
                {INVITE_DEPARTMENT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </UiSelect>
            </label>
            <label className="flex items-center gap-3 rounded-md border border-foreground/10 bg-field px-3 py-2.5 text-sm">
              <input
                type="checkbox"
                checked={inviteLead}
                onChange={(event) => setInviteLead(event.target.checked)}
                className="h-4 w-4"
              />
              <span>
                <span className="block font-medium text-foreground">Department lead</span>
                <span className="block text-[11px] text-muted">Applied to single and pasted invitations.</span>
              </span>
            </label>
          </div>

          {inviteResult ? (
            <div
              className={[
                "mt-4 rounded-lg border px-4 py-3 text-sm",
                inviteResult.failed.length
                  ? "border-[var(--warn-line)] bg-[var(--warn-wash)]"
                  : "border-[var(--success-line)] bg-[var(--success-wash)]",
              ].join(" ")}
            >
              <p className="font-semibold text-foreground">
                {inviteResult.invited} invitation{inviteResult.invited === 1 ? "" : "s"} created
              </p>
              {inviteResult.failed.length ? (
                <ul className="mt-2 max-h-28 space-y-1 overflow-y-auto text-xs text-muted">
                  {inviteResult.failed.map((failure) => (
                    <li key={`${failure.email}-${failure.error}`}>
                      <strong className="text-foreground">{failure.email || "Row"}:</strong> {failure.error}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={closeInviteModal}
              className="rounded-md border border-foreground/15 px-4 py-2 text-sm font-medium hover:bg-foreground/[0.05] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending || (inviteMode === "excel" && !excelInviteRows.length)}
              className="inline-flex items-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background hover:opacity-90 disabled:opacity-50"
            >
              {pending ? <ButtonSpinner /> : <Send className="h-4 w-4" />}
              {pending
                ? "Sending invitations…"
                : inviteMode === "single"
                  ? "Send invitation"
                  : inviteMode === "bulk"
                    ? "Send bulk invitations"
                    : `Send ${excelInviteRows.length || ""} invitations`}
            </button>
          </div>
        </form>
      </ModalOverlay>

      <ModalOverlay
        open={showBulkApproveModal}
        onClose={() => {
          if (!pending) setShowBulkApproveModal(false);
        }}
        panelClassName={MODAL_PANEL_XS}
        aria-labelledby="bulk-approve-title"
      >
        <h2 id="bulk-approve-title" className="text-lg font-semibold text-foreground">
          Approve all submitted records?
        </h2>
        <p className="mt-2 text-sm text-muted">
          This will apply data from{" "}
          <strong className="font-semibold text-foreground">
            {submittedRequests.length} extracted record{submittedRequests.length === 1 ? "" : "s"}
          </strong>{" "}
          to their matched employee profiles.
        </p>
        <div className="mt-3 rounded-md border border-[var(--warn-line)] bg-[var(--warn-wash)] px-3 py-2 text-xs text-foreground">
          Review any uncertain extraction before continuing. Approved employment and payroll fields immediately
          become part of the employee record.
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => setShowBulkApproveModal(false)}
            className="rounded-md border border-foreground/15 px-4 py-2 text-sm text-foreground hover:bg-foreground/[0.06] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={pending || submittedRequests.length === 0}
            aria-busy={pending}
            onClick={() => {
              void runAction(
                () =>
                  approveHrFormRequestsBatch(
                    tenantSlug,
                    submittedRequests.map((request) => request.id),
                  ),
                `${submittedRequests.length} records approved.`,
              ).then((ok) => {
                if (ok) setShowBulkApproveModal(false);
              });
            }}
            className="inline-flex items-center gap-2 rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background hover:opacity-90 disabled:opacity-50"
          >
            {pending ? <ButtonSpinner /> : null}
            {pending ? "Approving…" : `Approve all ${submittedRequests.length}`}
          </button>
        </div>
      </ModalOverlay>

      {showOfferLetter && record && selectedUserId ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4 print:bg-white print:p-0">
          <div className="mx-auto max-w-3xl rounded-xl bg-background p-4 print:max-w-none print:p-0">
            <div className="mb-4 flex flex-wrap justify-between gap-2 print:hidden">
              <button type="button" className="text-sm underline" onClick={() => setShowOfferLetter(false)}>
                Close
              </button>
              <PdfDownloadButton filename={`offer-letter-${record.fullName || "employee"}`}>
                Download PDF
              </PdfDownloadButton>
            </div>
            <OfferLetterEditor
              tenantSlug={tenantSlug}
              aiEnabled={aiEnabled}
              brand={tenantBrand}
              userId={selectedUserId}
              employeeProfileId={offerByUserId?.[selectedUserId]?.profileId || record.id || undefined}
              initialHtml={offerByUserId?.[selectedUserId]?.bodyHtml}
              initialStatus={offerByUserId?.[selectedUserId]?.status}
              initialSignUrl={offerByUserId?.[selectedUserId]?.signUrl}
              fields={{
                employeeName: record.fullName || selectedMember?.name || "",
                position: record.position,
                department: record.department,
                dateOfJoining: record.dateOfJoining
                  ? new Intl.DateTimeFormat("en-NG", { dateStyle: "long" }).format(
                      new Date(record.dateOfJoining),
                    )
                  : "to be confirmed",
                employmentType: record.employmentType || "full-time",
                grossMonthly: record.grossMonthly
                  ? Number(record.grossMonthly).toLocaleString("en-NG", { minimumFractionDigits: 2 })
                  : "",
                currency,
                reportingTo: record.reportingToLabel,
                employeeNumber: record.employeeNumber,
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
