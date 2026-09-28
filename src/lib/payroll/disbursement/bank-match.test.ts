import assert from "node:assert/strict";
import test from "node:test";
import { completeSalaryBank, matchPaystackBankCode, type PaystackBankRow } from "./bank-match";

const banks: PaystackBankRow[] = [
  { name: "First City Monument Bank", code: "214", slug: "first-city-monument-bank" },
  { name: "Guaranty Trust Bank", code: "058", slug: "guaranty-trust-bank" },
  { name: "Access Bank", code: "044", slug: "access-bank" },
  { name: "United Bank For Africa", code: "033", slug: "united-bank-for-africa" },
  { name: "Zenith Bank", code: "057", slug: "zenith-bank" },
  { name: "Union Bank of Nigeria", code: "032", slug: "union-bank-of-nigeria" },
];

test("matchPaystackBankCode reads short names staff already saved", () => {
  assert.equal(matchPaystackBankCode(banks, "FCMB"), "214");
  assert.equal(matchPaystackBankCode(banks, "GTBank"), "058");
  assert.equal(matchPaystackBankCode(banks, "GTB"), "058");
  assert.equal(matchPaystackBankCode(banks, "UBA"), "033");
  assert.equal(matchPaystackBankCode(banks, "Access Bank"), "044");
  assert.equal(matchPaystackBankCode(banks, "Zenith"), "057");
});

test("completeSalaryBank stores the code and marks the account payable", () => {
  const completed = completeSalaryBank(
    {
      accountHolderName: "",
      bankName: "FCMB",
      accountNumber: "5903400017",
      bankCode: "",
      accountType: "Checking",
      receivePayments: false,
    },
    banks,
    "Aceman Ahamisi",
  );
  assert.equal(completed.ok, true);
  if (!completed.ok) return;
  assert.equal(completed.changed, true);
  assert.equal(completed.account.bankCode, "214");
  assert.equal(completed.account.receivePayments, true);
  assert.equal(completed.account.accountHolderName, "Aceman Ahamisi");
});
