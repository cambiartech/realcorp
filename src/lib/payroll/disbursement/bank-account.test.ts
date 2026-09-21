import assert from "node:assert/strict";
import test from "node:test";
import { normalizeBankCode, normalizeNuban, parseSalaryBankAccount } from "./bank-account";

test("normalizeNuban requires exactly 10 digits", () => {
  assert.deepEqual(normalizeNuban("0123456789"), { ok: true, accountNumber: "0123456789" });
  assert.deepEqual(normalizeNuban("012-345-6789"), { ok: true, accountNumber: "0123456789" });
  assert.equal(normalizeNuban("123").ok, false);
  assert.equal(normalizeNuban("01234567890").ok, false);
});

test("normalizeBankCode accepts 3–6 digit codes", () => {
  assert.deepEqual(normalizeBankCode("058"), { ok: true, bankCode: "058" });
  assert.equal(normalizeBankCode("12").ok, false);
});

test("parseSalaryBankAccount flags missing bank code as not disbursement-ready", () => {
  const parsed = parseSalaryBankAccount({
    accountHolderName: "Ada Lovelace",
    bankName: "GTBank",
    accountNumber: "0123456789",
    accountType: "Checking",
    receivePayments: true,
  });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.disbursementReady, false);
  assert.ok(parsed.warnings.some((w) => /bank code/i.test(w)));
});

test("parseSalaryBankAccount is disbursement-ready when complete", () => {
  const parsed = parseSalaryBankAccount({
    accountHolderName: "Ada Lovelace",
    bankName: "GTBank",
    accountNumber: "0123456789",
    bankCode: "058",
    accountType: "Checking",
    receivePayments: true,
  });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.disbursementReady, true);
  assert.equal(parsed.account.bankCode, "058");
  assert.equal(parsed.warnings.length, 0);
});

test("receivePayments false blocks disbursement-ready", () => {
  const parsed = parseSalaryBankAccount({
    accountHolderName: "Ada",
    bankName: "Access",
    accountNumber: "0123456789",
    bankCode: "044",
    receivePayments: false,
  });
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.disbursementReady, false);
});
