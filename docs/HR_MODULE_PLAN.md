# HR Module Plan (People Management)
> Customer anchor: Bo Properties Nigeria  
> Status: Phase 4 & 5 complete — optional enhancements only

## Product goal

One place for employee records, payroll slips, performance reviews, and HR documents — linked to existing **Team** users (login accounts).

---

## Delivery chunks

### Chunk 1 — Foundation (current)
- [x] Data model: employee profile, documents, payslip runs, appraisals, performance goals
- [x] `HR_MANAGER` role + `moduleHr` tenant toggle
- [x] HR navigation: People, Payslips, Appraisals, Documents, My HR
- [x] Employee record form (biodata, employment, bank, emergency, education, next of kin — JSON sections)
- [x] Payslip generation (Bo split: Basic/Housing/Transport/Other + Payee + Pension)
- [x] Employees download **My payslips**
- [x] Appraisal **action templates** (monthly / yearly)
- [x] Appraisal **cycles** + per-employee reviews
- [x] Document upload per employee (NDA, offer, guarantor, etc.)

### Chunk 2 — Forms & compliance (Bo pack)
- [x] Branded org theme (logo, colors, address, phone, email) in Settings → Organization
- [x] Printable blank forms (biodata, bank, guarantor, health) with company branding
- [x] Shareable fill links — online fill on mobile/desktop
- [x] Print & upload path (employee uploads signed scan/PDF)
- [x] HR chooses delivery: online only, print only, or both
- [x] Approve submitted forms → merges into employee profile
- [x] Offer letter generator from template + employee fields
- [x] NDA / guarantor checklist UI on profile (data model ready)
- [x] Onboarding wizard: biodata → bank → documents → active

### Chunk 3 — Payroll depth
- [x] Manual override Payee per employee (People → Job tab)
- [x] Payslip print view with Bo earnings % columns + HR payroll table UI
- [x] Paygroups — generate/filter by group, payroll chips, table totals
- [x] Bulk publish all draft payroll runs
- [x] Year-to-date summary on profile (People → Job) and My dashboard
- [x] Payroll payment tracking: **Published** (employee sees slip) vs **Paid** (HR confirms bank transfer)

### Payroll workflow (Bo)

| Step | Meaning |
|------|---------|
| Eligible | ACTIVE profile + monthly gross on People → Job |
| Generate | Creates **draft** payslips for a month (Bo earnings split) |
| Publish | Run → **Finalized**; employees see slips in My dashboard |
| Mark paid | Per slip after salary hits bank (manual; optional bank ref) |

### Chunk 4 — Employee dashboard & appraisals
- [x] **My dashboard** (sidebar: My dashboard) — tabbed self-service UI
- [x] Overview: payslip count, open appraisals, pending HR forms
- [x] Payslips: list + view/print branded PDF
- [x] My record: read-only personal, job, bank (masked), emergency
- [x] My documents: offer letter, NDA, etc.
- [x] Self-appraisal with checklist items + ratings (no JSON)
- [x] Non-HR users land on My dashboard; HR admin routes protected
- [x] Manager review queue (HR appraisals tab — Review queue, criteria, periods)
- [x] Performance goals dashboard by department (Appraisals → Performance goals)
- [x] Yearly appraisal sign-off archive (Appraisals → Yearly archive)

### Chunk 5 — HR analytics (optional)
- [x] Headcount, joiners/leavers, overdue appraisals (Insights tab)
- [x] Export employee register CSV (`/api/hr/{slug}/register`)

---

## Roles

| Role | Access |
|------|--------|
| Org Admin | Full HR |
| HR Manager | Full HR |
| Everyone else (module on) | My profile, my payslips, self appraisal when cycle open |

---

## Bo Properties starting forms (mapped)

| Form | Stored in |
|------|-----------|
| Employee biodata | `EmployeeProfile` columns + JSON |
| Employment info | columns |
| Emergency contact | `emergencyContact` JSON |
| Education | `education` JSON |
| Next of kin | `nextOfKin` JSON |
| Health | `healthInfo` JSON |
| Bank account | `bankAccount` JSON |
| Guarantor | `guarantorInfo` JSON + `HrDocument` GUARANTOR |
| NDA / Offer | `HrDocument` |

---

## Platform notes

- **Cloudinary**: set `CLOUDINARY_*` in `.env` (see `.env.example`) — plug-and-play for Finance, HR docs, HR forms, org logo. Platform env takes priority; tenant keys in Settings are optional fallback.
- **Paystack / deal payroll**: out of scope per product decision.
