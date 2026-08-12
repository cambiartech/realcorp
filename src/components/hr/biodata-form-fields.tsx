"use client";

import { useEffect, useId, useRef, useState } from "react";
import { HrFormField, HrFormLockedField, HrFormSelect } from "@/components/hr/hr-form-field";
import { HrLocationFields } from "@/components/hr/hr-location-fields";

type InitialValues = Record<string, string>;

function locked(value: string | undefined) {
  return Boolean(value?.trim());
}

export function BiodataFormFields({ v }: { v: InitialValues }) {
  const nokSectionId = useId();
  const [sameAsEmergency, setSameAsEmergency] = useState(() => {
    if (!v.emergencyName?.trim()) return false;
    return (
      v.nextOfKinName === v.emergencyName &&
      (v.nextOfKinPhone === v.emergencyPhone || !v.nextOfKinPhone?.trim())
    );
  });
  const emergencyNameRef = useRef<HTMLInputElement>(null);
  const emergencyRelRef = useRef<HTMLInputElement>(null);
  const emergencyPhoneRef = useRef<HTMLInputElement>(null);
  const emergencyEmailRef = useRef<HTMLInputElement>(null);
  const nokNameRef = useRef<HTMLInputElement>(null);
  const nokRelRef = useRef<HTMLInputElement>(null);
  const nokPhoneRef = useRef<HTMLInputElement>(null);
  const nokEmailRef = useRef<HTMLInputElement>(null);

  const hasAssignedId = Boolean(v.employeeNumber?.trim());
  const hasJobPrefill = Boolean(v.position?.trim() || v.department?.trim());

  useEffect(() => {
    if (!sameAsEmergency) return;
    if (nokNameRef.current) nokNameRef.current.value = emergencyNameRef.current?.value ?? "";
    if (nokRelRef.current) nokRelRef.current.value = emergencyRelRef.current?.value ?? "";
    if (nokPhoneRef.current) nokPhoneRef.current.value = emergencyPhoneRef.current?.value ?? "";
    if (nokEmailRef.current) nokEmailRef.current.value = emergencyEmailRef.current?.value ?? "";
  }, [sameAsEmergency]);

  function syncNokFromEmergency() {
    if (!sameAsEmergency) return;
    if (nokNameRef.current) nokNameRef.current.value = emergencyNameRef.current?.value ?? "";
    if (nokRelRef.current) nokRelRef.current.value = emergencyRelRef.current?.value ?? "";
    if (nokPhoneRef.current) nokPhoneRef.current.value = emergencyPhoneRef.current?.value ?? "";
    if (nokEmailRef.current) nokEmailRef.current.value = emergencyEmailRef.current?.value ?? "";
  }

  return (
    <>
      {locked(v.fullName) ? (
        <HrFormLockedField label="Full name" name="fullName" value={v.fullName} />
      ) : (
        <HrFormField label="Full name" name="fullName" required defaultValue={v.fullName} />
      )}
      <HrFormSelect
        label="Gender"
        name="gender"
        defaultValue={v.gender}
        options={[
          { value: "Male", label: "Male" },
          { value: "Female", label: "Female" },
          { value: "Other", label: "Other" },
        ]}
      />
      <HrFormField label="Date of birth" name="dateOfBirth" type="date" defaultValue={v.dateOfBirth} />
      <HrFormField label="Marital status" name="maritalStatus" defaultValue={v.maritalStatus} />
      <HrFormField label="Nationality" name="nationality" defaultValue={v.nationality} />
      {locked(v.phoneMobile) ? (
        <HrFormLockedField label="Mobile phone" name="phoneMobile" value={v.phoneMobile} />
      ) : (
        <HrFormField label="Mobile phone" name="phoneMobile" type="tel" defaultValue={v.phoneMobile} />
      )}
      {locked(v.workEmail) ? (
        <HrFormLockedField label="Work email" name="workEmail" value={v.workEmail} />
      ) : (
        <HrFormField label="Email" name="workEmail" type="email" defaultValue={v.workEmail} />
      )}
      <HrFormField label="Street address" name="addressStreet" defaultValue={v.addressStreet} />
      <HrLocationFields
        countryName="addressCountry"
        stateName="addressState"
        cityName="addressCity"
        countryDefault={v.addressCountry}
        stateDefault={v.addressState}
        cityDefault={v.addressCity}
      />

      <hr className="border-slate-200" />
      <p className="text-xs font-semibold uppercase text-slate-500">Emergency contact</p>
      <HrFormField label="Name" name="emergencyName" defaultValue={v.emergencyName}>
        <input
          ref={emergencyNameRef}
          name="emergencyName"
          defaultValue={v.emergencyName}
          onBlur={syncNokFromEmergency}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 shadow-sm focus:border-[var(--hr-brand-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--hr-brand-accent)]/30"
        />
      </HrFormField>
      <HrFormField label="Relationship" name="emergencyRelationship" defaultValue={v.emergencyRelationship}>
        <input
          ref={emergencyRelRef}
          name="emergencyRelationship"
          defaultValue={v.emergencyRelationship}
          onBlur={syncNokFromEmergency}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 shadow-sm focus:border-[var(--hr-brand-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--hr-brand-accent)]/30"
        />
      </HrFormField>
      <HrFormField label="Phone" name="emergencyPhone" defaultValue={v.emergencyPhone}>
        <input
          ref={emergencyPhoneRef}
          name="emergencyPhone"
          type="tel"
          defaultValue={v.emergencyPhone}
          onBlur={syncNokFromEmergency}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 shadow-sm focus:border-[var(--hr-brand-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--hr-brand-accent)]/30"
        />
      </HrFormField>
      <HrFormField label="Email (optional)" name="emergencyEmail" defaultValue={v.emergencyEmail}>
        <input
          ref={emergencyEmailRef}
          name="emergencyEmail"
          type="email"
          defaultValue={v.emergencyEmail}
          onBlur={syncNokFromEmergency}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 shadow-sm focus:border-[var(--hr-brand-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--hr-brand-accent)]/30"
        />
      </HrFormField>

      {hasJobPrefill ? (
        <>
          <hr className="border-slate-200" />
          <p className="text-xs font-semibold uppercase text-slate-500">Job details (from HR)</p>
          {v.position ? <HrFormLockedField label="Position" name="position" value={v.position} /> : null}
          {v.department ? (
            <HrFormLockedField label="Department" name="department" value={v.department} />
          ) : null}
          {hasAssignedId ? (
            <HrFormLockedField label="Employee ID" name="employeeNumber" value={v.employeeNumber} hint="" />
          ) : (
            <p className="text-xs text-slate-600">
              Your employee ID will be assigned automatically by HR when your record is approved.
            </p>
          )}
          {locked(v.dateOfJoining) ? (
            <HrFormLockedField label="Date of joining" name="dateOfJoining" value={v.dateOfJoining} />
          ) : (
            <HrFormField
              label="Date of joining"
              name="dateOfJoining"
              type="date"
              defaultValue={v.dateOfJoining}
            />
          )}
        </>
      ) : (
        <>
          <hr className="border-slate-200" />
          {locked(v.position) ? (
            <HrFormLockedField label="Position" name="position" value={v.position} />
          ) : (
            <HrFormField label="Position" name="position" defaultValue={v.position} />
          )}
          {locked(v.department) ? (
            <HrFormLockedField label="Department" name="department" value={v.department} />
          ) : (
            <HrFormField label="Department" name="department" defaultValue={v.department} />
          )}
          {hasAssignedId ? (
            <HrFormLockedField label="Employee ID" name="employeeNumber" value={v.employeeNumber} hint="" />
          ) : (
            <p className="text-xs text-slate-600">
              Employee ID is assigned by the system — you do not need to enter one.
            </p>
          )}
          <HrFormField
            label="Date of joining"
            name="dateOfJoining"
            type="date"
            defaultValue={v.dateOfJoining}
          />
        </>
      )}

      <hr className="border-slate-200" />
      <p className="text-xs font-semibold uppercase text-slate-500">Next of kin</p>
      <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
        <input
          type="checkbox"
          name="nextOfKinSameAsEmergency"
          value="yes"
          checked={sameAsEmergency}
          onChange={(e) => setSameAsEmergency(e.target.checked)}
          className="mt-0.5"
        />
        <span>Same person as emergency contact above</span>
      </label>

      <div
        id={nokSectionId}
        className={sameAsEmergency ? "hidden" : "space-y-4"}
        aria-hidden={sameAsEmergency}
      >
        <HrFormField label="Full name" name="nextOfKinName" defaultValue={v.nextOfKinName}>
          <input
            ref={nokNameRef}
            name="nextOfKinName"
            defaultValue={v.nextOfKinName}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 shadow-sm focus:border-[var(--hr-brand-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--hr-brand-accent)]/30"
          />
        </HrFormField>
        <HrFormField label="Relationship" name="nextOfKinRelationship" defaultValue={v.nextOfKinRelationship}>
          <input
            ref={nokRelRef}
            name="nextOfKinRelationship"
            defaultValue={v.nextOfKinRelationship}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 shadow-sm focus:border-[var(--hr-brand-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--hr-brand-accent)]/30"
          />
        </HrFormField>
        <HrFormField label="Phone" name="nextOfKinPhone" defaultValue={v.nextOfKinPhone}>
          <input
            ref={nokPhoneRef}
            name="nextOfKinPhone"
            type="tel"
            defaultValue={v.nextOfKinPhone}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 shadow-sm focus:border-[var(--hr-brand-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--hr-brand-accent)]/30"
          />
        </HrFormField>
        <HrFormField label="Email (optional)" name="nextOfKinEmail" defaultValue={v.nextOfKinEmail}>
          <input
            ref={nokEmailRef}
            name="nextOfKinEmail"
            type="email"
            defaultValue={v.nextOfKinEmail}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 shadow-sm focus:border-[var(--hr-brand-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--hr-brand-accent)]/30"
          />
        </HrFormField>
      </div>
    </>
  );
}
