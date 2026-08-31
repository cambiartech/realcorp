import assert from "node:assert/strict";
import { test } from "node:test";
import {
  parsePensionAdministrators,
  pensionAdministratorSelectOptions,
  normalizePensionAdministratorName,
} from "./org-pension-administrators";

test("parsePensionAdministrators trims, drops blanks, and de-dupes case-insensitively", () => {
  assert.deepEqual(
    parsePensionAdministrators([
      "  Stanbic IBTC Pension Managers Limited ",
      "stanbic ibtc pension managers limited",
      "",
      "Leadway Pensure PFA LIMITED",
      12,
    ]),
    ["Stanbic IBTC Pension Managers Limited", "Leadway Pensure PFA LIMITED"],
  );
});

test("pensionAdministratorSelectOptions keeps a current value that is not on the org list", () => {
  const options = pensionAdministratorSelectOptions(
    ["Stanbic IBTC Pension Managers Limited"],
    "ARM Pension Managers",
  );
  assert.equal(options[0], "ARM Pension Managers");
  assert.equal(options[1], "Stanbic IBTC Pension Managers Limited");
});

test("normalizePensionAdministratorName collapses inner spaces", () => {
  assert.equal(
    normalizePensionAdministratorName("  AccessARM   Pension   Limited  "),
    "AccessARM Pension Limited",
  );
});
