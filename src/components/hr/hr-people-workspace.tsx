"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSnackbar } from "@/components/snackbar";
import { UiSelect } from "@/components/ui-select";
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
  cancelHrFormRequest,
  createHrFormRequestsBatch,
  upsertEmployeeProfile,
} from "@/app/[tenantSlug]/hr/actions";
import { HR_FORM_OPTIONS } from "@/lib/hr-form-types";

type PeopleTab = "directory" | "onboard" | "record" | "send" | "requests";
type RecordTab = "personal" | "job" | "bank" | "emergency" | "family";

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
        {required ? <span className="text-red-600"> *</span> : null}
      </span>
      {children ?? <input name={name} type={type} required={required} defaultValue={defaultValue} className={inputClass} />}
      {hint ? <span className="mt-0.5 block text-[11px] text-muted">{hint}</span> : null}
    </label>
  );
}

export function HrPeopleWorkspace({
  tenantSlug,
  companyName,
  tenantBrand,
  currency,
  teamMembers,
  profiles,
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
    { bodyHtml: string; status: "DRAFT" | "AWAITING_SIGNATURE" | "SIGNED"; signUrl?: string; profileId: string }
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
  }>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showSnackbar } = useSnackbar();
  const [onboardInitialStep, setOnboardInitialStep] = useState<OnboardingStepId>("personal");
  const [peopleTab, setPeopleTab] = useState<PeopleTab>("directory");
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

  const profileByUserId = useMemo(() => new Map(profileDetails.map((p) => [p.userId, p])), [profileDetails]);
  const onboardingByUserId = useMemo(() => new Map(profileOnboarding.map((o) => [o.userId, o])), [profileOnboarding]);
  const ytdByUser = useMemo(() => new Map(ytdByUserId.map((o) => [o.userId, o.ytd])), [ytdByUserId]);
  const selectedMember = teamMembers.find((m) => m.userId === selectedUserId);
  const selectedProfile = selectedUserId ? profileByUserId.get(selectedUserId) : undefined;
  const selectedOnboarding = selectedUserId ? onboardingByUserId.get(selectedUserId) : undefined;

  async function runAction(fn: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    setPending(true);
    const result = await fn();
    setPending(false);
    if (!result.ok) {
      showSnackbar(result.error || "Something went wrong.", "error");
      return;
    }
    showSnackbar(success, "success");
    router.refresh();
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
    return {
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
      position: "",
      department: "",
      dateOfJoining: "",
      reportingToLabel: "",
      employmentType: "",
      workSchedule: "",
      paygroupName: "",
      grossMonthly: "",
      payeeTaxMonthly: "",
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
      nextOfKinOccupation: "",
      educationLevel: "",
      educationInstitution: "",
      educationQualification: "",
      educationYear: "",
    };
  }

  const record = selectedMember ? buildDraftFromTeam(selectedMember) : null;

  const peopleTabs: { id: PeopleTab; label: string }[] = [
    { id: "directory", label: "Team directory" },
    { id: "record", label: "Employee record" },
    { id: "send", label: "Send forms" },
    { id: "requests", label: "Form requests" },
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
        Everyone on <strong className="font-medium text-foreground">Team</strong> appears here. Open their record to edit details, or send them a form link to their work email.
      </p>

      <div className="flex flex-wrap gap-1 border-b border-foreground/10 pb-1">
        {peopleTabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setPeopleTab(t.id)}
            className={[
              "rounded-md px-3 py-2 text-sm font-medium transition-colors",
              peopleTab === t.id ? "bg-foreground text-background" : "text-muted hover:bg-foreground/[0.06] hover:text-foreground",
            ].join(" ")}
          >
            {t.label}
          </button>
        ))}
      </div>

      {peopleTab === "directory" ? (
        <div className="overflow-hidden rounded-lg border border-foreground/10">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-foreground/10 bg-foreground/[0.03] px-3 py-2">
            <p className="text-sm font-semibold text-foreground">Team members</p>
            <Link href={`/${tenantSlug}/team`} className="text-xs font-semibold text-foreground underline">
              Add someone on Team →
            </Link>
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
                          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:text-emerald-300">
                            {prof.statusValue === "ACTIVE" ? "Active" : prof.status}
                          </span>
                        ) : (
                          <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-900 dark:text-amber-200">
                            Not set up
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-foreground/10">
                            <div
                              className="h-full bg-emerald-600"
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
                                : startOnboarding(m.userId, prof ? inferOnboardingStep(onboard?.items ?? []) : undefined)
                            }
                            className="text-xs font-semibold underline"
                          >
                            {prof?.statusValue === "ACTIVE" ? "Open record" : prof ? "Continue onboarding" : "Start onboarding"}
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
            Pick someone from <button type="button" className="font-semibold underline" onClick={() => setPeopleTab("directory")}>Team directory</button> to view or edit their HR record.
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[1fr_minmax(240px,280px)]">
          <form
            className="rounded-lg border border-foreground/10 p-4 sm:p-5"
            onSubmit={(e) => {
              e.preventDefault();
              try {
                const payload = formDataToEmployeeProfilePayload(new FormData(e.currentTarget));
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
              <button type="button" className="text-xs text-muted underline" onClick={() => setPeopleTab("directory")}>
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
                    recordTab === t.id ? "bg-foreground/10 text-foreground" : "text-muted hover:text-foreground",
                  ].join(" ")}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {recordTab === "personal" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Full name" name="fullName" required defaultValue={record.fullName || selectedMember.name} />
                <Field label="Employee ID" name="employeeNumber" defaultValue={record.employeeNumber} hint="Leave blank to auto-generate (e.g. BOPR-2026-0001)." />
                <Field label="Gender" name="gender" defaultValue={record.gender}>
                  <UiSelect name="gender" defaultValue={record.gender}>
                    <option value="">—</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </UiSelect>
                </Field>
                <Field label="Date of birth" name="dateOfBirth" type="date" defaultValue={record.dateOfBirth} />
                <Field label="Marital status" name="maritalStatus" defaultValue={record.maritalStatus} />
                <Field label="Nationality" name="nationality" defaultValue={record.nationality} />
                <Field label="Mobile phone" name="phoneMobile" type="tel" defaultValue={record.phoneMobile} />
                <Field label="Work email" name="workEmail" type="email" defaultValue={record.workEmail || selectedMember.email} hint="From Team — used when you send forms." />
                <Field label="Street address" name="addressStreet" defaultValue={record.addressStreet} className="sm:col-span-2" />
                <Field label="City" name="addressCity" defaultValue={record.addressCity} />
                <Field label="State" name="addressState" defaultValue={record.addressState} />
              </div>
            ) : null}

            {recordTab === "job" ? (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Job title" name="position" defaultValue={record.position} />
                  <Field label="Department" name="department" defaultValue={record.department} />
                  <Field label="Date of joining" name="dateOfJoining" type="date" defaultValue={record.dateOfJoining} />
                  <Field label="Reports to" name="reportingToLabel" defaultValue={record.reportingToLabel} />
                  <Field label="Employment type" name="employmentType" defaultValue={record.employmentType} hint="e.g. Full-Time, Contract" />
                  <Field label="Work schedule" name="workSchedule" defaultValue={record.workSchedule} />
                  <Field label="Pay group" name="paygroupName" defaultValue={record.paygroupName} hint="Used to filter payroll runs (e.g. Lagos, Abuja)." />
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
                    label={`Payee tax override (${currency})`}
                    name="payeeTaxMonthly"
                    defaultValue={record.payeeTaxMonthly}
                    hint="Leave blank to auto-calculate (~9.98% of gross)."
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
                </div>
                <PayslipYtdCard ytd={selectedUserId ? ytdByUser.get(selectedUserId) ?? null : null} currency={currency} />
              </div>
            ) : null}

            {recordTab === "bank" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Account holder name" name="bankAccountHolderName" defaultValue={record.bankAccountHolderName} />
                <Field label="Bank name" name="bankName" defaultValue={record.bankName} />
                <Field label="Account number" name="bankAccountNumber" defaultValue={record.bankAccountNumber} />
                <Field label="Account type" name="bankAccountType" defaultValue={record.bankAccountType}>
                  <UiSelect name="bankAccountType" defaultValue={record.bankAccountType || "Checking"}>
                    <option value="Checking">Checking</option>
                    <option value="Savings">Savings</option>
                    <option value="Other">Other</option>
                  </UiSelect>
                </Field>
                <Field label="Use for salary payments?" name="bankReceivePayments" defaultValue={record.bankReceivePayments}>
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
                <Field label="Relationship" name="emergencyRelationship" defaultValue={record.emergencyRelationship} />
                <Field label="Phone" name="emergencyPhone" type="tel" defaultValue={record.emergencyPhone} />
                <Field label="Email" name="emergencyEmail" type="email" defaultValue={record.emergencyEmail} />
              </div>
            ) : null}

            {recordTab === "family" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <p className="sm:col-span-2 text-xs font-semibold uppercase tracking-wide text-muted">Next of kin</p>
                <Field label="Full name" name="nextOfKinName" defaultValue={record.nextOfKinName} />
                <Field label="Relationship" name="nextOfKinRelationship" defaultValue={record.nextOfKinRelationship} />
                <Field label="Phone" name="nextOfKinPhone" type="tel" defaultValue={record.nextOfKinPhone} />
                <Field label="Email" name="nextOfKinEmail" type="email" defaultValue={record.nextOfKinEmail} />
                <Field label="Street" name="nextOfKinStreet" defaultValue={record.nextOfKinStreet} />
                <Field label="City" name="nextOfKinCity" defaultValue={record.nextOfKinCity} />
                <Field label="State" name="nextOfKinState" defaultValue={record.nextOfKinState} />
                <Field label="Occupation" name="nextOfKinOccupation" defaultValue={record.nextOfKinOccupation} />
                <p className="sm:col-span-2 mt-2 text-xs font-semibold uppercase tracking-wide text-muted">Education</p>
                <Field label="Highest level" name="educationLevel" defaultValue={record.educationLevel} />
                <Field label="Institution" name="educationInstitution" defaultValue={record.educationInstitution} />
                <Field label="Qualification" name="educationQualification" defaultValue={record.educationQualification} />
                <Field label="Year" name="educationYear" defaultValue={record.educationYear} />
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2 border-t border-foreground/10 pt-4">
              <button type="submit" disabled={pending} className="rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-50">
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
                <button type="button" className="text-sm font-semibold text-violet-700 underline" onClick={() => startOnboarding(selectedMember.userId)}>
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
          />
          </div>
        )
      ) : null}

      {peopleTab === "send" ? (
        <form
          className="rounded-lg border border-foreground/10 p-4"
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
                isBundle
                  ? `Master onboarding link ready.${emailHint}`
                  : `Form link ready.${emailHint}`,
                "success",
              );
              router.refresh();
            })();
          }}
        >
          <p className="mb-3 text-sm font-semibold text-foreground">Send a form link</p>
          {sendMode === "team" && selectedMember ? (
            <div className="mb-3 space-y-2">
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-sm text-foreground">
                Sending to <strong>{selectedMember.name}</strong> ({selectedMember.email}) — they are already on Team.
                Job title and payroll details come from their HR record, not Team role.
              </div>
              <Link
                href={`/${tenantSlug}/hr/dashboard?employeeUserId=${selectedMember.userId}`}
                className="inline-block text-xs font-semibold text-foreground underline"
              >
                Preview their My dashboard →
              </Link>
            </div>
          ) : null}
          <div className="mb-4 flex gap-2 rounded-lg bg-foreground/[0.04] p-1">
            <label className="flex flex-1 cursor-pointer items-center justify-center rounded-md px-3 py-2 text-sm has-[:checked]:bg-background has-[:checked]:font-semibold has-[:checked]:shadow-sm">
              <input type="radio" name="sendMode" value="team" checked={sendMode === "team"} onChange={() => setSendMode("team")} className="sr-only" />
              Team member
            </label>
            <label className="flex flex-1 cursor-pointer items-center justify-center rounded-md px-3 py-2 text-sm has-[:checked]:bg-background has-[:checked]:font-semibold has-[:checked]:shadow-sm">
              <input type="radio" name="sendMode" value="newcomer" checked={sendMode === "newcomer"} onChange={() => setSendMode("newcomer")} className="sr-only" />
              New joiner (not on Team yet)
            </label>
          </div>

          {sendMode === "team" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Team member" name="userId" required={sendMode === "team"}>
                <UiSelect name="userId" defaultValue={selectedUserId ?? ""} key={`send-user-${selectedUserId ?? "none"}`}>
                  <option value="">Select…</option>
                  {teamMembers.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.name} — {m.email}
                    </option>
                  ))}
                </UiSelect>
              </Field>
              <p className="sm:col-span-2 text-xs text-muted">
                We will email the link to their address on file when you copy it into your mail app. Their name is filled in automatically.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Full name" name="recipientName" required={sendMode === "newcomer"} />
              <Field label="Email address" name="recipientEmail" type="email" required={sendMode === "newcomer"} />
              <p className="sm:col-span-2 text-xs text-muted">
                For candidates not on Team yet. After they join, add them under Team and merge records.
              </p>
            </div>
          )}

          <div className="mt-3 space-y-3">
            <div>
              <p className="mb-2 text-xs font-semibold text-foreground">Forms to send *</p>
              <p className="mb-2 text-[11px] text-muted">
                Select one or more — multiple forms share one master link with a step-by-step checklist.
              </p>
              <div className="flex flex-wrap gap-2">
                {HR_FORM_OPTIONS.map((opt) => {
                  const on = selectedFormTypes.includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => toggleFormType(opt.value)}
                      className={[
                        "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                        on
                          ? "border-foreground bg-foreground text-background"
                          : "border-foreground/15 bg-background text-foreground hover:bg-foreground/[0.04]",
                      ].join(" ")}
                    >
                      {on ? "✓ " : ""}
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
            <Field label="How they complete it" name="deliveryMode">
              <UiSelect name="deliveryMode" defaultValue="BOTH">
                <option value="ONLINE_FILL">Fill online only</option>
                <option value="PRINT_UPLOAD">Print & upload only</option>
                <option value="BOTH">Online or print & upload</option>
              </UiSelect>
            </Field>
            <Field label="Link expires (days)" name="expiresInDays" type="number" defaultValue="14">
              <input name="expiresInDays" type="number" min={1} max={90} defaultValue={14} className={inputClass} />
            </Field>
            <Field label="Note to employee" name="hrNote" hint="Optional message shown on the form." />
            </div>
          </div>

          <button
            type="submit"
            disabled={pending || selectedFormTypes.length === 0}
            className="mt-4 rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-50"
          >
            {pending ? "Generating…" : selectedFormTypes.length > 1 ? "Generate master link" : "Generate link"}
          </button>

          {createdMasterUrl || createdFormLinks.length > 0 ? (
            <div className="mt-4 space-y-3 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs">
              {createdSendToEmail ? (
                <p className="font-semibold text-foreground">Send to: {createdSendToEmail}</p>
              ) : null}
              {createdMasterUrl && createdFormLinks.length > 1 ? (
                <>
                  <p className="font-medium text-foreground">Master onboarding link — one URL for all {createdFormLinks.length} sections</p>
                  <input
                    readOnly
                    value={createdMasterUrl}
                    className="w-full border border-foreground/15 bg-field px-2 py-1.5 font-mono text-[11px]"
                    onFocus={(ev) => ev.target.select()}
                  />
                  {createdMasterPrintUrls.length > 0 ? (
                    <details className="mt-2">
                      <summary className="cursor-pointer font-medium text-muted">Print blank forms (per section)</summary>
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
                    <td className="px-3 py-2">{r.formTypeLabel}</td>
                    <td className="px-3 py-2">
                      {r.status}
                      {r.submittedAtLabel !== "—" ? <span className="block text-[10px] text-muted">{r.submittedAtLabel}</span> : null}
                    </td>
                    <td className="px-3 py-2 text-xs">{r.expiresLabel}</td>
                    <td className="px-3 py-2 space-x-2">
                      {r.statusValue === "SUBMITTED" ? (
                        <button
                          type="button"
                          className="text-xs font-semibold text-emerald-700 underline"
                          onClick={() => void runAction(() => approveHrFormRequest(tenantSlug, r.id), "Approved.")}
                        >
                          Approve
                        </button>
                      ) : null}
                      {r.statusValue === "PENDING" || r.statusValue === "SUBMITTED" ? (
                        <button
                          type="button"
                          className="text-xs text-muted underline"
                          onClick={() => void runAction(() => cancelHrFormRequest(tenantSlug, r.id), "Cancelled.")}
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
        )
      ) : null}

      {showOfferLetter && record && selectedUserId ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4 print:bg-white print:p-0">
          <div className="mx-auto max-w-3xl rounded-xl bg-background p-4 print:max-w-none print:p-0">
            <div className="mb-4 flex flex-wrap justify-between gap-2 print:hidden">
              <button type="button" className="text-sm underline" onClick={() => setShowOfferLetter(false)}>
                Close
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-md border border-foreground bg-foreground px-3 py-1.5 text-xs font-semibold text-background"
              >
                Print / Save PDF
              </button>
            </div>
            <OfferLetterEditor
              tenantSlug={tenantSlug}
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
                  ? new Intl.DateTimeFormat("en-NG", { dateStyle: "long" }).format(new Date(record.dateOfJoining))
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
