"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FormAlert } from "@/components/form-message";
import { ButtonSpinner } from "@/components/button-spinner";
import { OrgDepartmentsEditor } from "@/components/org-departments-editor";
import { useSnackbar } from "@/components/snackbar";
import { UiSelect } from "@/components/ui-select";
import { isDefaultOrgDepartment } from "@/lib/org-departments";
import { PAYROLL_COUNTRY_OPTIONS, type OrgPayrollSettings } from "@/lib/payroll/org-payroll-settings";
import {
  applyCountryTaxLawToEveryone,
  savePeopleOrgSettings,
} from "@/app/[tenantSlug]/hr/actions";

const inputClass =
  "w-full rounded-md border border-foreground/15 bg-field px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-foreground/30";

export function HrPeopleSettingsWorkspace({
  tenantSlug,
  payroll,
  orgDepartments,
}: {
  tenantSlug: string;
  payroll: OrgPayrollSettings;
  orgDepartments: string[];
}) {
  const router = useRouter();
  const { showSnackbar } = useSnackbar();
  const [saveState, saveAction, savePending] = useActionState(
    savePeopleOrgSettings.bind(null, tenantSlug),
    null as { ok: true; appliedCount?: number } | { ok: false; error: string } | null,
  );
  const [taxPending, setTaxPending] = useState(false);
  const [customDepartments, setCustomDepartments] = useState(() =>
    orgDepartments.filter((name) => !isDefaultOrgDepartment(name)),
  );

  useEffect(() => {
    setCustomDepartments(orgDepartments.filter((name) => !isDefaultOrgDepartment(name)));
  }, [orgDepartments]);

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

  return (
    <div className="w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">People</p>
      <h1 className="mt-1 text-2xl font-bold text-foreground">People settings</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Set tax, pension, and departments once for the whole organization. Open a person only when they
        need an exception.
      </p>

      <section className="mt-8 rounded-xl border border-foreground/10 bg-foreground/[0.02] p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-foreground">PAYE and payroll country</h2>
        <p className="mt-1 text-xs text-muted">
          Everyone is taxed by this country&apos;s law. Nigeria Tax Act 2026: first ₦800,000 of annual
          chargeable income is untaxed; pension comes off before tax. You do not enter PAYE on each
          record.
        </p>
        <form action={saveAction} className="mt-4 space-y-4">
          {saveState && !saveState.ok ? <FormAlert>{saveState.error}</FormAlert> : null}
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Tax law</label>
            <UiSelect name="payrollCountryCode" defaultValue={payroll.payrollCountryCode}>
              {PAYROLL_COUNTRY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </UiSelect>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-medium text-muted">
              Basic salary (%)
              <input
                name="basicPercent"
                type="number"
                min={0}
                max={100}
                step={0.01}
                defaultValue={payroll.basicPercent}
                className={`mt-1 ${inputClass}`}
              />
            </label>
            <label className="text-xs font-medium text-muted">
              Housing (%)
              <input
                name="housingPercent"
                type="number"
                min={0}
                max={100}
                step={0.01}
                defaultValue={payroll.housingPercent}
                className={`mt-1 ${inputClass}`}
              />
            </label>
            <label className="text-xs font-medium text-muted">
              Transport (%)
              <input
                name="transportPercent"
                type="number"
                min={0}
                max={100}
                step={0.01}
                defaultValue={payroll.transportPercent}
                className={`mt-1 ${inputClass}`}
              />
            </label>
            <label className="text-xs font-medium text-muted">
              Other earnings (%)
              <input
                name="otherPercent"
                type="number"
                min={0}
                max={100}
                step={0.01}
                defaultValue={payroll.otherPercent}
                className={`mt-1 ${inputClass}`}
              />
            </label>
            <label className="text-xs font-medium text-muted">
              Employee pension (%)
              <input
                name="employeePensionRate"
                type="number"
                min={0}
                max={100}
                step={0.01}
                defaultValue={payroll.employeePensionRate}
                className={`mt-1 ${inputClass}`}
              />
            </label>
            <label className="text-xs font-medium text-muted">
              Employer pension (%)
              <input
                name="employerPensionRate"
                type="number"
                min={0}
                max={100}
                step={0.01}
                defaultValue={payroll.employerPensionRate}
                className={`mt-1 ${inputClass}`}
              />
            </label>
            <label className="text-xs font-medium text-muted">
              NSITF / employee compensation (%)
              <input
                name="nsitfRate"
                type="number"
                min={0}
                max={100}
                step={0.01}
                defaultValue={payroll.nsitfRate}
                className={`mt-1 ${inputClass}`}
              />
            </label>
            <label className="text-xs font-medium text-muted">
              ITF (%)
              <input
                name="itfRate"
                type="number"
                min={0}
                max={100}
                step={0.01}
                defaultValue={payroll.itfRate}
                className={`mt-1 ${inputClass}`}
              />
            </label>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Pension on payslips</label>
            <UiSelect name="pensionEnabled" defaultValue={payroll.pensionEnabled ? "yes" : "no"}>
              <option value="yes">Yes — deduct employee pension (8% of basic + housing + transport)</option>
              <option value="no">No</option>
            </UiSelect>
          </div>
          <label className="flex items-start gap-3 rounded-md border border-foreground/10 bg-field px-3 py-3 text-sm">
            <input type="checkbox" name="applyStructureToEveryone" value="on" className="mt-0.5 h-4 w-4" />
            <span>
              <span className="font-medium text-foreground">Also apply this split and pension to everyone now</span>
              <span className="mt-0.5 block text-xs text-muted">
                Leave unchecked to only change defaults for new people. Existing records keep their current
                split unless you tick this.
              </span>
            </span>
          </label>
          <button
            type="submit"
            disabled={savePending}
            aria-busy={savePending}
            className="inline-flex items-center gap-2 rounded-md border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-50"
          >
            {savePending ? <ButtonSpinner /> : null}
            {savePending ? "Saving…" : "Save payroll defaults"}
          </button>
        </form>

        <div className="mt-6 border-t border-foreground/10 pt-4">
          <p className="text-xs text-muted">
            If old payslips still show the wrong PAYE, use this once, then{" "}
            <Link href={`/${tenantSlug}/hr/payslips`} className="font-semibold underline">
              Generate / refresh
            </Link>{" "}
            on Payslips. Documented manual exceptions are left alone.
          </p>
          <button
            type="button"
            disabled={taxPending}
            onClick={() => void applyTaxLaw()}
            className="mt-3 inline-flex items-center gap-2 rounded-md border border-foreground/20 px-4 py-2 text-sm font-semibold text-foreground hover:bg-foreground/[0.06] disabled:opacity-50"
          >
            {taxPending ? <ButtonSpinner /> : null}
            {taxPending ? "Updating…" : "Use country tax law for everyone"}
          </button>
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-foreground/10 bg-foreground/[0.02] p-4 sm:p-5">
        <OrgDepartmentsEditor
          tenantSlug={tenantSlug}
          customDepartments={customDepartments}
          onCustomDepartmentsChange={setCustomDepartments}
        />
      </section>
    </div>
  );
}
