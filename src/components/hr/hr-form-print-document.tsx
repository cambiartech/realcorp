import { BrandedDocumentShell, FormSection, PrintFieldRow } from "@/components/hr/branded-document-shell";
import type { HrFormType } from "@/generated/prisma";
import { HR_FORM_TYPE_LABELS } from "@/lib/hr-form-types";
import type { TenantBranding } from "@/lib/tenant-branding";

export function HrFormPrintDocument({
  brand,
  formType,
  employeeName,
}: {
  brand: TenantBranding;
  formType: HrFormType;
  employeeName?: string;
}) {
  const title = HR_FORM_TYPE_LABELS[formType];

  return (
    <BrandedDocumentShell
      brand={brand}
      title={title}
      subtitle={employeeName ? `For: ${employeeName}` : "Print, complete, sign, and return to HR"}
      footerNote="Confidential — for employment purposes only."
    >
      {formType === "BIODATA" ? <BiodataPrint /> : null}
      {formType === "BANK_FORM" ? <BankPrint /> : null}
      {formType === "GUARANTOR" ? <GuarantorPrint /> : null}
      {formType === "HEALTH" ? <HealthPrint /> : null}
      <div className="mt-8 grid gap-8 sm:grid-cols-2">
        <PrintFieldRow label="Employee signature" />
        <PrintFieldRow label="Date (DD/MM/YYYY)" />
      </div>
    </BrandedDocumentShell>
  );
}

function BiodataPrint() {
  return (
    <>
      <FormSection title="Personal information">
        <PrintFieldRow label="Full name" />
        <PrintFieldRow label="Gender" />
        <PrintFieldRow label="Date of birth (DD/MM/YYYY)" />
        <PrintFieldRow label="Marital status" />
        <PrintFieldRow label="Nationality" />
        <PrintFieldRow label="Phone (mobile)" />
        <PrintFieldRow label="Email address" />
        <PrintFieldRow label="Home address — street" />
        <PrintFieldRow label="City" />
        <PrintFieldRow label="State" />
      </FormSection>
      <FormSection title="Emergency contact">
        <PrintFieldRow label="Name" />
        <PrintFieldRow label="Relationship" />
        <PrintFieldRow label="Phone" />
        <PrintFieldRow label="Email" />
      </FormSection>
      <FormSection title="Employment information">
        <PrintFieldRow label="Position" />
        <PrintFieldRow label="Department" />
        <PrintFieldRow label="Employee ID" />
        <PrintFieldRow label="Date of joining" />
        <PrintFieldRow label="Reporting authority" />
        <PrintFieldRow label="Employment type" />
        <PrintFieldRow label="Work schedule" />
      </FormSection>
      <FormSection title="Education">
        <PrintFieldRow label="Highest level of education" />
        <PrintFieldRow label="Last institution" />
        <PrintFieldRow label="Qualification" />
        <PrintFieldRow label="Year of graduation" />
      </FormSection>
      <FormSection title="Next of kin">
        <PrintFieldRow label="Full name" />
        <PrintFieldRow label="Relationship" />
        <PrintFieldRow label="Phone" />
        <PrintFieldRow label="Email" />
        <PrintFieldRow label="Address — street" />
        <PrintFieldRow label="City / State" />
        <PrintFieldRow label="Occupation" />
      </FormSection>
    </>
  );
}

function BankPrint() {
  return (
    <>
      <FormSection title="Bank account details">
        <PrintFieldRow label="Account holder name" />
        <PrintFieldRow label="Bank name" />
        <PrintFieldRow label="Bank address" />
        <PrintFieldRow label="City" />
        <PrintFieldRow label="State" />
        <PrintFieldRow label="Country" />
      </FormSection>
      <FormSection title="Account information">
        <PrintFieldRow label="Account type (Checking / Savings / Other)" />
        <PrintFieldRow label="Account number" />
        <PrintFieldRow label="Account for receiving payments (Yes / No)" />
      </FormSection>
    </>
  );
}

function GuarantorPrint() {
  return (
    <>
      <FormSection title="Employee information">
        <PrintFieldRow label="Full name of employee" />
        <PrintFieldRow label="Job title" />
        <PrintFieldRow label="Department" />
        <PrintFieldRow label="Address" />
        <PrintFieldRow label="Phone" />
      </FormSection>
      <FormSection title="Guarantor information">
        <PrintFieldRow label="Full name of guarantor" />
        <PrintFieldRow label="Relationship to employee" />
        <PrintFieldRow label="Address" />
        <PrintFieldRow label="Phone" />
        <PrintFieldRow label="Email" />
        <PrintFieldRow label="Occupation" />
        <PrintFieldRow label="Employer name" />
        <PrintFieldRow label="Employer address" />
        <PrintFieldRow label="Known employee for (years)" />
      </FormSection>
      <p className="text-xs leading-relaxed text-slate-600">
        I confirm that I act as guarantor for the employee named above and accept responsibility as outlined in company policy.
      </p>
    </>
  );
}

function HealthPrint() {
  return (
    <>
      <FormSection title="Health information">
        <PrintFieldRow label="Medical conditions or allergies? (Yes / No)" />
        <PrintFieldRow label="If yes, specify" />
        <PrintFieldRow label="Emergency medical contact — name" />
        <PrintFieldRow label="Relationship" />
        <PrintFieldRow label="Phone" />
      </FormSection>
      <FormSection title="Additional information">
        <PrintFieldRow label="Certifications or special skills? (Yes / No)" />
        <PrintFieldRow label="If yes, list" />
        <PrintFieldRow label="Willing to participate in training? (Yes / No)" />
      </FormSection>
      <p className="text-xs leading-relaxed text-slate-600">
        I declare that the information provided is accurate to the best of my knowledge.
      </p>
    </>
  );
}
