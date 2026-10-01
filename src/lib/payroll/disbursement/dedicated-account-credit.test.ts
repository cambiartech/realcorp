import assert from "node:assert/strict";
import test from "node:test";
import {
  matchDedicatedAccountTenant,
  parseDedicatedAccountCredit,
} from "./dedicated-account-credit";
import type { PayrollDisbursementSettings } from "./settings";

const settings = (patch: Partial<PayrollDisbursementSettings>): PayrollDisbursementSettings => ({
  feeFlatNaira: 0,
  feeBaseNaira: 0,
  feePercentBps: 0,
  dvaProvider: "PAYSTACK",
  ...patch,
});

const charge = {
  status: "success",
  amount: 50000,
  currency: "NGN",
  channel: "dedicated_nuban",
  reference: "ref_500",
  paid_at: "2026-09-28T15:39:00.000Z",
  customer: { customer_code: "CUS_76ilu0x4lmpmrqs9" },
  authorization: {
    receiver_bank_account_number: "9817762396",
    sender_name: "Ahamisi Godsfavour",
    sender_bank: "Opay",
  },
};

test("parseDedicatedAccountCredit reads a dedicated NUBAN charge", () => {
  const credit = parseDedicatedAccountCredit("charge.success", charge);
  assert.ok(credit);
  assert.equal(credit.amountKobo, 50000);
  assert.equal(credit.accountNumber, "9817762396");
  assert.equal(credit.customerCode, "CUS_76ilu0x4lmpmrqs9");
  assert.equal(credit.senderName, "Ahamisi Godsfavour");
});

test("parseDedicatedAccountCredit accepts amount sent as a string of kobo", () => {
  const credit = parseDedicatedAccountCredit("charge.success", { ...charge, amount: "20000" });
  assert.ok(credit);
  assert.equal(credit.amountKobo, 20000);
});

test("parseDedicatedAccountCredit ignores salary transfers and other channels", () => {
  assert.equal(parseDedicatedAccountCredit("transfer.success", charge), null);
  assert.equal(
    parseDedicatedAccountCredit("charge.success", { ...charge, channel: "card" }),
    null,
  );
});

test("matchDedicatedAccountTenant prefers the Paystack customer code", () => {
  const match = matchDedicatedAccountTenant(
    { customerCode: "CUS_76ilu0x4lmpmrqs9", accountNumber: "9817762396" },
    [
      { tenantId: "bo", settings: settings({ dvaCustomerCode: "CUS_76ilu0x4lmpmrqs9" }) },
      { tenantId: "other", settings: settings({ dvaAccountNumber: "0000000000" }) },
    ],
  );
  assert.deepEqual(match, { ok: true, tenantId: "bo" });
});

test("matchDedicatedAccountTenant falls back to the account number", () => {
  const match = matchDedicatedAccountTenant(
    { customerCode: "", accountNumber: "9817-762-396" },
    [{ tenantId: "bo", settings: settings({ dvaAccountNumber: "9817762396" }) }],
  );
  assert.deepEqual(match, { ok: true, tenantId: "bo" });
});

test("matchDedicatedAccountTenant does not credit when two orgs share the account", () => {
  const match = matchDedicatedAccountTenant(
    { customerCode: "", accountNumber: "9817762396" },
    [
      { tenantId: "a", settings: settings({ dvaAccountNumber: "9817762396" }) },
      { tenantId: "b", settings: settings({ dvaAccountNumber: "9817762396" }) },
    ],
  );
  assert.deepEqual(match, { ok: false, reason: "ambiguous" });
});
