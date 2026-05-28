import {
  InvoiceStatus,
  VendorBillRecurrenceFrequency,
  VendorBillStatus,
} from "../../src/generated/prisma";
import { daysAgo, daysFromNow, monthsFromNow } from "./helpers";
import type { DemoSeedContext, SalesSeedRefs } from "./types";

const VENDORS = [
  "PHCN",
  "MTN Nigeria",
  "LAWMA",
  "Dangote Cement",
  "Flutterwave",
  "Sterling Bank",
  "Julius Berger",
  "Nestlé Waters",
  "Google Workspace",
  "Lagos Water Corporation",
];

export async function seedFinance(ctx: DemoSeedContext, sales: SalesSeedRefs) {
  const { prisma, tenantId, users } = ctx;
  console.log("  [finance] vendors, invoices, payables, expenses, receipts…");

  await prisma.tenantSettings.update({
    where: { tenantId },
    data: {
      orgDepartments: ["Finance", "Sales", "Marketing", "Community", "HR", "Operations", "Legal"],
      financeBankAccounts: ["GTBank — Ops 0123456789", "Access — Collections 0987654321", "Petty Cash"],
      financePaymentModes: ["Bank Transfer", "Cash", "Cheque", "POS", "Paystack"],
      financeCurrencies: ["NGN", "USD"],
      financeControls: {
        expenseApprovalThreshold: 500000,
        firstReminderAfterDays: 7,
        secondReminderAfterDays: 14,
      },
    },
  });

  for (const name of VENDORS) {
    await prisma.financeVendor.upsert({
      where: { tenantId_name: { tenantId, name } },
      create: { tenantId, name },
      update: {},
    });
  }

  const invoiceFixtures = [
    {
      num: "INV-DEMO-001",
      title: "Reservation deposit — Azure B-04",
      dealIdx: 0,
      status: InvoiceStatus.PARTIALLY_PAID,
      amount: "15000000",
      balance: "5000000",
      dueDays: 14,
      dept: "Sales",
    },
    {
      num: "INV-DEMO-002",
      title: "Professional fees — staging",
      dealIdx: null,
      status: InvoiceStatus.SENT,
      amount: "2500000",
      balance: "2500000",
      dueDays: -10,
      dept: "Marketing",
    },
    {
      num: "INV-DEMO-003",
      title: "Unit 3 — Palm P-07 milestone 1",
      dealIdx: 1,
      status: InvoiceStatus.SENT,
      amount: "10000000",
      balance: "10000000",
      dueDays: -45,
      dept: "Sales",
    },
    {
      num: "INV-DEMO-004",
      title: "Azure C-21 — final payment",
      dealIdx: 7,
      status: InvoiceStatus.PAID,
      amount: "92000000",
      balance: "0",
      dueDays: -60,
      dept: "Sales",
    },
    {
      num: "INV-DEMO-005",
      title: "Consulting — land survey",
      dealIdx: null,
      status: InvoiceStatus.SENT,
      amount: "1800000",
      balance: "1800000",
      dueDays: -35,
      dept: "Operations",
    },
    {
      num: "INV-DEMO-006",
      title: "Azure D-08 — reservation fee",
      dealIdx: 5,
      status: InvoiceStatus.PARTIALLY_PAID,
      amount: "15000000",
      balance: "8000000",
      dueDays: -5,
      dept: "Sales",
    },
    {
      num: "INV-DEMO-007",
      title: "Community launch event",
      dealIdx: null,
      status: InvoiceStatus.SENT,
      amount: "4500000",
      balance: "4500000",
      dueDays: 21,
      dept: "Marketing",
    },
    {
      num: "INV-DEMO-008",
      title: "Azure A-12 — expression of interest",
      dealIdx: 3,
      status: InvoiceStatus.SENT,
      amount: "5000000",
      balance: "5000000",
      dueDays: -75,
      dept: "Sales",
    },
  ];

  for (const row of invoiceFixtures) {
    const dueDate = row.dueDays >= 0 ? daysFromNow(row.dueDays) : daysAgo(Math.abs(row.dueDays));
    const inv = await prisma.invoice.upsert({
      where: { tenantId_invoiceNumber: { tenantId, invoiceNumber: row.num } },
      create: {
        tenantId,
        dealId: row.dealIdx != null ? sales.deals[row.dealIdx]?.id : null,
        invoiceNumber: row.num,
        title: row.title,
        status: row.status,
        amount: row.amount,
        balanceDue: row.balance,
        currency: "NGN",
        department: row.dept,
        dueDate,
        createdByUserId: users.financeUser.id,
        createdByLabel: users.financeUser.name,
      },
      update: { status: row.status, balanceDue: row.balance, dueDate },
    });

    if (row.num === "INV-DEMO-001") {
      const payExists = await prisma.paymentRecord.findFirst({
        where: { tenantId, invoiceId: inv.id, reference: "GTB-DEMO-001" },
      });
      if (!payExists) {
        await prisma.paymentRecord.create({
          data: {
            tenantId,
            invoiceId: inv.id,
            amount: "10000000",
            currency: "NGN",
            paidAt: daysAgo(3),
            method: "Bank transfer",
            reference: "GTB-DEMO-001",
            recordedByUserId: users.financeUser.id,
            recordedByLabel: users.financeUser.name,
          },
        });
      }
    }
    if (row.num === "INV-DEMO-006") {
      const payExists = await prisma.paymentRecord.findFirst({
        where: { tenantId, invoiceId: inv.id, reference: "GTB-DEMO-006" },
      });
      if (!payExists) {
        await prisma.paymentRecord.create({
          data: {
            tenantId,
            invoiceId: inv.id,
            amount: "7000000",
            currency: "NGN",
            paidAt: daysAgo(8),
            method: "Bank transfer",
            reference: "GTB-DEMO-006",
            recordedByUserId: users.financeUser.id,
            recordedByLabel: users.financeUser.name,
          },
        });
      }
    }
  }

  const directPayExists = await prisma.paymentRecord.findFirst({
    where: { tenantId, reference: "GTB-DEMO-DIRECT-001" },
  });
  if (!directPayExists) {
    await prisma.paymentRecord.create({
      data: {
        tenantId,
        invoiceId: null,
        standaloneTitle: "Walk-in reservation deposit — Azure B-04",
        payerName: "Chidi Eze",
        amount: "2500000",
        currency: "NGN",
        paidAt: daysAgo(2),
        method: "Bank transfer",
        reference: "GTB-DEMO-DIRECT-001",
        recordedByUserId: users.financeUser.id,
        recordedByLabel: users.financeUser.name,
      },
    });
  }

  const billFixtures = [
    { num: "BILL-DEMO-001", vendor: "PHCN", title: "PHCN — May 2026", amount: "185000", balance: "185000", due: -3, status: VendorBillStatus.OPEN },
    { num: "BILL-DEMO-002", vendor: "MTN Nigeria", title: "MTN — April 2026", amount: "450000", balance: "0", due: -20, status: VendorBillStatus.PAID },
    { num: "BILL-DEMO-003", vendor: "LAWMA", title: "Waste collection Q2", amount: "320000", balance: "320000", due: -35, status: VendorBillStatus.OPEN },
    { num: "BILL-DEMO-004", vendor: "Dangote Cement", title: "Site materials batch 12", amount: "8900000", balance: "4500000", due: -15, status: VendorBillStatus.PARTIAL },
    { num: "BILL-DEMO-005", vendor: "Flutterwave", title: "Payment gateway fees", amount: "125000", balance: "125000", due: 10, status: VendorBillStatus.OPEN },
    { num: "BILL-DEMO-006", vendor: "PHCN", title: "PHCN — June 2026", amount: "192000", balance: "192000", due: 28, status: VendorBillStatus.OPEN, recurring: true },
    { num: "BILL-DEMO-007", vendor: "Julius Berger", title: "Roadworks — Phase 2", amount: "15000000", balance: "15000000", due: -55, status: VendorBillStatus.OPEN },
    { num: "BILL-DEMO-008", vendor: "Google Workspace", title: "Google Workspace — May", amount: "89000", balance: "89000", due: 5, status: VendorBillStatus.OPEN },
  ];

  for (const row of billFixtures) {
    await prisma.vendorBill.upsert({
      where: { tenantId_billNumber: { tenantId, billNumber: row.num } },
      create: {
        tenantId,
        billNumber: row.num,
        vendorName: row.vendor,
        title: row.title,
        amount: row.amount,
        balanceDue: row.balance,
        currency: "NGN",
        department: "Operations",
        dueDate: row.due >= 0 ? daysFromNow(row.due) : daysAgo(Math.abs(row.due)),
        status: row.status,
        isRecurring: Boolean(row.recurring),
        recurrenceFrequency: row.recurring ? VendorBillRecurrenceFrequency.MONTHLY : null,
        createdByUserId: users.financeUser.id,
        createdByLabel: users.financeUser.name,
      },
      update: { balanceDue: row.balance, status: row.status },
    });
  }

  const expenseFixtures = [
    { cat: "Fuel & transport", vendor: "Uber", amount: "85000", days: 2 },
    { cat: "Site visit", vendor: "Julius Berger", amount: "450000", days: 5 },
    { cat: "Marketing", vendor: "Meta Ads", amount: "1200000", days: 8 },
    { cat: "Office supplies", vendor: "Shoprite", amount: "42000", days: 12 },
    { cat: "Legal", vendor: "Aluko & Oyebode", amount: "750000", days: 18 },
    { cat: "Utilities", vendor: "PHCN", amount: "185000", days: 25 },
    { cat: "Software", vendor: "Google Workspace", amount: "89000", days: 30 },
    { cat: "Contractor", vendor: "Nestlé Waters", amount: "210000", days: 40 },
  ];

  for (let i = 0; i < expenseFixtures.length; i += 1) {
    const row = expenseFixtures[i];
    const id = `${tenantId}-expense-demo-${i + 1}`;
    await prisma.expense.upsert({
      where: { id },
      create: {
        id,
        tenantId,
        category: row.cat,
        vendorName: row.vendor,
        amount: row.amount,
        currency: "NGN",
        expenseDate: daysAgo(row.days),
        paidThroughAccount: "GTBank — Ops 0123456789",
        department: row.cat === "Marketing" ? "Marketing" : "Operations",
        createdByUserId: users.financeUser.id,
        createdByLabel: users.financeUser.name,
      },
      update: {},
    });
  }

  const receiptFixtures = [
    { num: "RCPT-DEMO-001", title: "Walk-in deposit — Azure showroom", customer: "Mr. Adeyemi", amount: "2000000" },
    { num: "RCPT-DEMO-002", title: "Shortlet overflow payment", customer: "Sarah Okon", amount: "850000" },
    { num: "RCPT-DEMO-003", title: "Consultation fee", customer: "Investor group", amount: "500000" },
    { num: "RCPT-DEMO-004", title: "Palm Heights open day", customer: "Fatima Bello", amount: "1000000" },
  ];

  for (const row of receiptFixtures) {
    await prisma.salesReceipt.upsert({
      where: { tenantId_receiptNumber: { tenantId, receiptNumber: row.num } },
      create: {
        tenantId,
        receiptNumber: row.num,
        title: row.title,
        customerName: row.customer,
        amount: row.amount,
        currency: "NGN",
        paymentMode: "Bank Transfer",
        depositAccount: "Access — Collections 0987654321",
        createdByUserId: users.financeUser.id,
        createdByLabel: users.financeUser.name,
      },
      update: {},
    });
  }
}
