"use client";

import { useActionState, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FormAlert } from "@/components/form-message";
import { ButtonSpinner } from "@/components/button-spinner";
import { OrgDepartmentsEditor } from "@/components/org-departments-editor";
import { PensionAdministratorsEditor } from "@/components/pension-administrators-editor";
import { useSnackbar } from "@/components/snackbar";
import { UiSelect } from "@/components/ui-select";
import { UiTabs } from "@/components/ui-tabs";
import { isDefaultOrgDepartment } from "@/lib/org-departments";
import { PAYROLL_COUNTRY_OPTIONS, type OrgPayrollSettings } from "@/lib/payroll/org-payroll-settings";
import {
  applyCountryTaxLawToEveryone,
  savePeopleOrgSettings,
} from "@/app/[tenantSlug]/hr/actions";

const inputClass =
  "w-full rounded-md border border-foreground/15 bg-field px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-foreground/30";

const TABS = [
  { id: "tax", label: "Tax & PAYE" },
  { id: "split", label: "Salary split" },
  { id: "pension", label: "Pension" },
  { id: "statutory", label: "NSITF & ITF" },
  { id: "departments", label: "Departments" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function PercentField({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue: number;
}) {
  return (
    <label className="text-xs font-medium text-muted">
      {label}
      <input
        name={name}
        type="number"
        min={0}
        max={100}
        step={0.01}
        defaultValue={defaultValue}
        className={`mt-1 ${inputClass}`}
      />
    </label>
  );
}

function TabPanel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-foreground/10 bg-background p-5 sm:p-6">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <p className="mt-1 text-sm text-muted">{description}</p>
      <div className="mt-5">{children}</div>
    </div>
  );
}

export function HrPeopleSettingsWorkspace({
  tenantSlug,
  payroll,
  orgDepartments,
  pensionAdministrators,
}: {
  tenantSlug: string;
  payroll: OrgPayrollSettings;
  orgDepartments: string[];
  pensionAdministrators: string[];
}) {
  const router = useRouter();
  const { showSnackbar } = useSnackbar();
  const [tab, setTab] = useState<TabId>("tax");
  const [saveState, saveAction, savePending] = useActionState(
    savePeopleOrgSettings.bind(null, tenantSlug),
    null as { ok: true; appliedCount?: number } | { ok: false; error: string } | null,
  );
  const [taxPending, setTaxPending] = useState(false);
  const [customDepartments, setCustomDepartments] = useState(() =>
    orgDepartments.filter((name) => !isDefaultOrgDepartment(name)),
  );
  const [pfaList, setPfaList] = useState(pensionAdministrators);

  useEffect(() => {
    setCustomDepartments(orgDepartments.filter((name) => !isDefaultOrgDepartment(name)));
  }, [orgDepartments]);

  useEffect(() => {
    setPfaList(pensionAdministrators);
  }, [pensionAdministrators]);

  useEffect(() => {
    if (!saveState) return;
    if (!saveState.ok) return;
    const extra =
      saveState.appliedCount != null && saveState.appliedCount > 0
        ? ` Applied to ${saveState.appliedCount} people.`
        : "";
    showSnackbar(`People settings saved.${extra}`, "success");
    router.refresh();
  }, [saveState, router, showSnackbar]);

  async function applyTaxLaw() {
    setTaxPending(true);
    const result = await applyCountryTaxLawToEveryone(tenantSlug);
    setTaxPending(false);
    if (!result.ok) {
      showSnackbar(result.error, "error");
      return;
    }
    showSnackbar(
      `Country tax law is now the default for ${result.clearedCount ?? 0} people. Generate / refresh payslips to recalculate PAYE.`,
      "success",
    );
    router.refresh();
  }

  const showPayrollSave = tab !== "departments";

  return (
    <div className="w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">People</p>
      <h1 className="mt-1 text-2xl font-bold text-foreground">People settings</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Defaults for this organization. Change a person only when they need an exception.
      </p>

      <div className="mt-6">
        <UiTabs tabs={TABS} value={tab} onChange={setTab} aria-label="People settings" />
      </div>

      <form action={saveAction} className="mt-6">
        {saveState && !saveState.ok ? <FormAlert>{saveState.error}</FormAlert> : null}

        <div className={tab === "tax" ? "" : "hidden"} role="tabpanel">
          <TabPanel
            title="Tax & PAYE"
            description="Which tax law to use. PAYE is calculated on payslips — you do not type it on each person."
          >
            <label className="mb-1 block text-xs font-medium text-muted">Tax law</label>
            <UiSelect name="payrollCountryCode" defaultValue={payroll.payrollCountryCode}>
              {PAYROLL_COUNTRY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </UiSelect>
            <p className="mt-3 text-xs text-muted">
              Nigeria: the first ₦800,000 of yearly chargeable income is untaxed. Payslips annualize this month
              (after pension), apply the yearly bands, then deduct one month of that tax.
            </p>
            <div className="mt-4 rounded-lg border border-foreground/10 bg-foreground/[0.02] px-4 py-3">
              <p className="text-xs text-muted">
                Wrong PAYE on old slips? Use this once, then{" "}
                <Link href={`/${tenantSlug}/hr/payslips`} className="font-semibold underline">
                  Generate / refresh
                </Link>
                . Documented manual exceptions stay.
              </p>
              <button
                type="button"
                disabled={taxPending}
                onClick={() => void applyTaxLaw()}
                className="mt-3 inline-flex items-center gap-2 rounded-md border border-foreground/20 px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-foreground/[0.06] disabled:opacity-50"
              >
                {taxPending ? <ButtonSpinner /> : null}
                {taxPending ? "Updating…" : "Use country tax law for everyone"}
              </button>
            </div>
          </TabPanel>
        </div>

        <div className={tab === "split" ? "" : "hidden"} role="tabpanel">
          <TabPanel
            title="Salary split"
            description="How monthly gross is broken into basic, housing, transport, and other earnings. These should add up to 100%."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <PercentField label="Basic salary (%)" name="basicPercent" defaultValue={payroll.basicPercent} />
              <PercentField label="Housing (%)" name="housingPercent" defaultValue={payroll.housingPercent} />
              <PercentField label="Transport (%)" name="transportPercent" defaultValue={payroll.transportPercent} />
              <PercentField label="Other earnings (%)" name="otherPercent" defaultValue={payroll.otherPercent} />
            </div>
          </TabPanel>
        </div>

        <div className={tab === "pension" ? "" : "hidden"} role="tabpanel">
          <TabPanel
            title="Pension"
            description="Contribution rates for payslips. Add the PFAs this organization remits to — they show on People records."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <PercentField
                label="Employee pension (%)"
                name="employeePensionRate"
                defaultValue={payroll.employeePensionRate}
              />
              <PercentField
                label="Employer pension (%)"
                name="employerPensionRate"
                defaultValue={payroll.employerPensionRate}
              />
            </div>
            <div className="mt-4">
              <label className="mb-1 block text-xs font-medium text-muted">
                Deduct employee pension on payslips
              </label>
              <UiSelect name="pensionEnabled" defaultValue={payroll.pensionEnabled ? "yes" : "no"}>
                <option value="yes">Yes — 8% of basic + housing + transport (unless you change the rate)</option>
                <option value="no">No</option>
              </UiSelect>
            </div>
            <div className="mt-6 border-t border-foreground/10 pt-5">
              <PensionAdministratorsEditor
                tenantSlug={tenantSlug}
                administrators={pfaList}
                onChange={setPfaList}
                compact
              />
            </div>
          </TabPanel>
        </div>

        <div className={tab === "statutory" ? "" : "hidden"} role="tabpanel">
          <TabPanel
            title="NSITF & ITF"
            description="Employer statutory rates used on payroll. Leave at 0 if this organization does not apply them."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <PercentField
                label="NSITF / employee compensation (%)"
                name="nsitfRate"
                defaultValue={payroll.nsitfRate}
              />
              <PercentField label="ITF (%)" name="itfRate" defaultValue={payroll.itfRate} />
            </div>
          </TabPanel>
        </div>

        {showPayrollSave ? (
          <div className="mt-5 rounded-xl border border-foreground/10 bg-foreground/[0.02] p-5 sm:p-6">
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" name="applyStructureToEveryone" value="on" className="mt-0.5 h-4 w-4" />
              <span>
                <span className="font-medium text-foreground">Also apply this split and pension to everyone now</span>
                <span className="mt-0.5 block text-xs text-muted">
                  Leave unchecked to only change defaults for new people.
                </span>
              </span>
            </label>
            <button
              type="submit"
              disabled={savePending}
              aria-busy={savePending}
              className="mt-4 inline-flex items-center gap-2 rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-50"
            >
              {savePending ? <ButtonSpinner /> : null}
              {savePending ? "Saving…" : "Save payroll defaults"}
            </button>
          </div>
        ) : null}
      </form>

      {tab === "departments" ? (
        <div className="mt-6" role="tabpanel">
          <TabPanel
            title="Departments"
            description="Shared list for Team invites, People, Finance, and reporting. Add a name and it is saved immediately."
          >
            <OrgDepartmentsEditor
              tenantSlug={tenantSlug}
              customDepartments={customDepartments}
              onCustomDepartmentsChange={setCustomDepartments}
              compact
            />
          </TabPanel>
        </div>
      ) : null}
    </div>
  );
}
