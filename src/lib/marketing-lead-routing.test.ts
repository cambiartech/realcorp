import assert from "node:assert/strict";
import test from "node:test";
import { inboundLeadIsSalesVisible, inboundLeadVisibilityData } from "./marketing-lead-routing";

test("default and immediate routing send inbound leads to Sales", () => {
  assert.equal(inboundLeadIsSalesVisible(undefined), true);
  assert.equal(inboundLeadIsSalesVisible("SALES_IMMEDIATE"), true);
  assert.equal(inboundLeadVisibilityData("SALES_IMMEDIATE").salesVisible, true);
});

test("hold routing keeps inbound leads in Marketing until pushed", () => {
  assert.equal(inboundLeadIsSalesVisible("MARKETING_HOLD"), false);
  assert.equal(inboundLeadVisibilityData("MARKETING_HOLD").salesVisible, false);
  assert.equal(inboundLeadVisibilityData("MARKETING_HOLD").salesReleasedAt, null);
});
