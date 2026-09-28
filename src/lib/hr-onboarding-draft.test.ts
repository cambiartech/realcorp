import assert from "node:assert/strict";
import test from "node:test";
import { applyStoredOnboardingDraft } from "./hr-onboarding-draft";
import type { ProfileDetailRow } from "./hr-profile-form";

const record = {
  fullName: "",
  phoneMobile: "0801",
  grossMonthly: "200000",
  taxId: "",
} as ProfileDetailRow;

test("a stored draft fills fields the record does not have yet", () => {
  const next = applyStoredOnboardingDraft(record, { fullName: "Ada Obisesan", taxId: "N-1" });
  assert.equal(next.fullName, "Ada Obisesan");
  assert.equal(next.taxId, "N-1");
  assert.equal(next.phoneMobile, "0801");
  assert.equal(next.grossMonthly, "200000");
});

test("a blank stored field does not wipe a value already on the record", () => {
  const next = applyStoredOnboardingDraft(record, { phoneMobile: "  ", grossMonthly: "" });
  assert.equal(next.phoneMobile, "0801");
  assert.equal(next.grossMonthly, "200000");
});
