import type { ProfileDetailRow } from "@/lib/hr-profile-form";

/** Carries job & personal fields through multi-step onboarding saves (bank/activate forms). */
export function OnboardingProfileHiddenFields({
  draft,
  statusOverride,
}: {
  draft: ProfileDetailRow;
  statusOverride?: string;
}) {
  const status = statusOverride ?? (draft.status || "DRAFT");
  return (
    <>
      <input type="hidden" name="userId" value={draft.userId} />
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="fullName" value={draft.fullName} />
      <input type="hidden" name="employeeNumber" value={draft.employeeNumber} />
      <input type="hidden" name="position" value={draft.position} />
      <input type="hidden" name="department" value={draft.department} />
      <input type="hidden" name="dateOfJoining" value={draft.dateOfJoining} />
      <input type="hidden" name="employmentType" value={draft.employmentType} />
      <input type="hidden" name="workSchedule" value={draft.workSchedule} />
      <input type="hidden" name="paygroupName" value={draft.paygroupName} />
      <input type="hidden" name="phoneMobile" value={draft.phoneMobile} />
      <input type="hidden" name="workEmail" value={draft.workEmail} />
      <input type="hidden" name="grossMonthly" value={draft.grossMonthly} />
      <input type="hidden" name="payeeTaxMonthly" value={draft.payeeTaxMonthly} />
      <input type="hidden" name="basicPercent" value={draft.basicPercent} />
      <input type="hidden" name="housingPercent" value={draft.housingPercent} />
      <input type="hidden" name="transportPercent" value={draft.transportPercent} />
      <input type="hidden" name="otherPercent" value={draft.otherPercent} />
    </>
  );
}
