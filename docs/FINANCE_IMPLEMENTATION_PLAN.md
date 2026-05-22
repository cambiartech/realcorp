# Finance Suite Implementation Plan (Zoho-Parity + Beyond)
> Status: Active Draft  
> Target: First customer go-live next week, then phased expansion  
> Scope: Finance module IA, data model, workflows, reports, banking, and automation

---

## 1) Product Goal

Build a finance module where every transaction is traceable from:

- **Customer/Lead/Deal**
- **Project/Unit**
- **Invoice/Sales Receipt**
- **Payment/Bank movement**
- **Expense/Commission**

This is the core differentiator: property-native finance, not generic bookkeeping.

---

## 2) Finance Information Architecture (with submenus)

Finance should not be one flat page. Use this submenu stack:

1. `/{tenant}/finance/overview`
2. `/{tenant}/finance/receivables`
3. `/{tenant}/finance/sales-receipts`
4. `/{tenant}/finance/invoices`
5. `/{tenant}/finance/payments`
6. `/{tenant}/finance/expenses`
7. `/{tenant}/finance/banking`
8. `/{tenant}/finance/reports`
9. `/{tenant}/finance/settings` (fiscal year, account mapping, numbering)

### Role visibility inside Finance

- **Org Admin:** all submenus (read/write policy by section)
- **Finance Manager:** all submenus
- **Sales Manager / Sales Exec:** read-only to receivable/payment snapshots where needed
- **Marketing/Community:** no finance submenus by default

---

## 3) Must-Have Flows to Match Current Zoho Usage

Based on provided flows/screens, these are priority:

### A. Sales Receipts
- List view with filters (status/date/customer/payment mode)
- Create new receipt
- Item rows, tax selection, notes, terms
- Payment detail block (mode, deposit account, reference)
- Save / save-and-send

### B. Expenses
- Expense list + filters
- New expense form
- Paid-through account
- Tax and reference capture
- Attachment upload for receipts (Cloudinary-backed storage bucket + signed upload flow)

### C. Banking
- Banking overview
- Multiple accounts (bank + cash + wallets)
- Import statements
- Reconciliation queue (uncategorized -> matched)
- Transaction rule engine (Phase 2)

### D. Reports Center
- Report catalog
- Core reports:
  - Profit & Loss
  - Cash Flow Statement
  - Balance Sheet
- Filters (date range, report basis, project/unit/department tags)
- Export

### E. Finance Dashboard Widgets
- Total receivables (current vs overdue)
- Total payables
- Income vs expense trend
- Top expenses
- Cash flow trend

---

## 4) Property-Native Enhancements (Beyond Zoho)

These are mandatory for RealCorp advantage:

1. **Project/Unit linkage in every finance record**
   - Invoice, payment, receipt, expense, commission line must map to project/unit where applicable.

2. **Deal-aware receivables**
   - From deal stage -> invoice plan -> payment schedule -> collection status.

3. **Commission intelligence**
   - Commission payable by realtor/partner, tied to deal and payout status.

4. **Finance + Sales sync**
   - Finance verification actions feed back to deal state and dashboard KPIs.

---

## 5) Delivery Phases (Fast + Safe)

## Phase 0 (Now -> next week, go-live readiness)

### Objective
Ship stable core flows customers already understand.

### Deliverables
- Finance submenu navigation
- Finance overview dashboard widgets
- Sales receipt list/create
- Expense list/create
- Basic payments list + record payment
- Basic reports center shell with 3 reports
- Project/unit selector in core forms

### Success criteria
- Customer can create and retrieve:
  - sales receipt
  - expense
  - payment
- Dashboard finance cards update correctly.

---

## Phase 1 (Post go-live, 2-3 weeks)

### Objective
Complete operational parity.

### Deliverables
- Banking overview + accounts management
- Statement import (CSV first)
- Reconciliation queue (manual match)
- Invoice list/create/edit + send
- Receivable/payable aging views
- Report filters (project/unit/date/basis) + export

---

## Phase 2 (Scale + automation)

### Objective
Reduce manual effort and errors.

### Deliverables
- Transaction rules engine
- Auto-categorization suggestions
- Scheduled reports
- Approval workflows for high-value expenses/payments
- Multi-entity compare (project vs project, period vs period)

---

## 6) Data Model Plan (Prisma)

Use current models and extend carefully:

### Existing to leverage
- `Invoice`
- `PaymentRecord`
- `Deal`
- `Unit`
- `Project`
- `AuditLog`

### Add/extend (new)
- `SalesReceipt`
- `SalesReceiptLine`
- `Expense`
- `ExpenseAttachment`
- `BankAccount`
- `BankStatementImport`
- `BankTransaction`
- `BankReconciliationMatch`
- `FinanceReportRun` (saved report snapshots / scheduled runs)

### Shared dimensions
Each finance entity should carry:
- `tenantId`
- `projectId` (nullable)
- `unitId` (nullable)
- `dealId` (nullable where applicable)
- `currency`
- `createdByUserId`
- audit fields (`createdAt`, `updatedAt`)

---

## 7) API + Action Surface

Standardize by section:

- `finance/receipts/actions.ts`
- `finance/expenses/actions.ts`
- `finance/payments/actions.ts`
- `finance/banking/actions.ts`
- `finance/reports/actions.ts`

Each section:
- create
- update
- list/filter
- export (CSV/PDF where needed)

All mutations must write `AuditLog`.

---

## 8) UX Rules (non-negotiable)

1. Forms must have **quick defaults** (date=today, currency=tenant default).
2. Every list needs **saved filters** and **clear empty states**.
3. Project/unit linkage must be visible and editable in forms.
4. Don’t hide key financial status:
   - paid/partial/overdue
   - current vs overdue buckets
5. Keep keyboard-first flow (tab-friendly for finance operators).

---

## 9) Navigation Spec (implementation detail)

In sidebar under **Finance**, implement collapsible sub-items:

- Overview
- Receivables
- Sales Receipts
- Invoices
- Payments
- Expenses
- Banking
- Reports
- Finance Settings

Mobile dock can keep one Finance icon; submenu opens in-page drawer.

---

## 10) Immediate Build Order (Engineering Sequence)

1. Finance submenu + route skeletons
2. Finance overview cards wired to existing data
3. Sales Receipts list/create (with lines + payment detail)
4. Expenses list/create (with attachments metadata)
5. Reports center shell + P&L/Cashflow/Balance endpoints
6. Project/unit linkage into all new forms
7. Banking account list + overview

---

## 11) Definition of Done (for first customer usage)

- Finance manager can navigate all finance submenus.
- Can record sales receipt and expense end-to-end.
- Can view receivables/payables summary and cashflow trend.
- Can run P&L/Cashflow/Balance summary report.
- Can link transactions to project/unit where applicable.
- All actions audited.

---

## 12) What We Add Beyond Zoho (Roadmap)

After parity, go beyond:

- Deal-stage aware cash forecasting
- Commission intelligence by realtor/team
- Risk scoring on overdue receivables
- Cross-module alerts (sales stalled + finance overdue)
- Portfolio-level project profitability analytics

---

## 13) Notes for Product + Delivery

- Prioritize **adoption and trust** over feature count this week.
- Keep first release simple but complete for daily finance operations.
- Every new finance screen should answer: "Can finance team close today’s books faster?"

