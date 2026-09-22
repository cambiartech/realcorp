import assert from "node:assert/strict";
import test from "node:test";
import { MembershipRole, MembershipStatus } from "@/generated/prisma";
import { getVisibleNavKeys, type TenantSettingsNavSlice } from "./tenant-nav-access";

const modulesOn: TenantSettingsNavSlice = {
  moduleSales: true,
  moduleFinance: true,
  moduleMarketing: true,
  moduleCommunity: true,
  moduleShortLets: true,
  moduleHr: true,
  moduleTasks: true,
  moduleClients: true,
  moduleListings: true,
  moduleInvestorPortal: true,
  moduleFacility: true,
  moduleInventory: true,
  roleModuleGrants: null,
};

test("sales executives do not see Clients by default", () => {
  const keys = getVisibleNavKeys({
    role: MembershipRole.SALES_EXECUTIVE,
    isPlatformAdmin: false,
    membershipStatus: MembershipStatus.ACTIVE,
    settings: modulesOn,
  });
  assert.equal(keys.includes("clients"), false);
  assert.equal(keys.includes("leads"), true);
  assert.equal(keys.includes("deals"), true);
});

test("sales leads see Clients by default", () => {
  const keys = getVisibleNavKeys({
    role: MembershipRole.SALES_MANAGER,
    isPlatformAdmin: false,
    membershipStatus: MembershipStatus.ACTIVE,
    settings: modulesOn,
  });
  assert.equal(keys.includes("clients"), true);
});

test("Clients can be granted to sales executives from Settings role modules", () => {
  const keys = getVisibleNavKeys({
    role: MembershipRole.SALES_EXECUTIVE,
    isPlatformAdmin: false,
    membershipStatus: MembershipStatus.ACTIVE,
    settings: {
      ...modulesOn,
      roleModuleGrants: { SALES_EXECUTIVE: ["CLIENTS"] },
    },
  });
  assert.equal(keys.includes("clients"), true);
});

test("Clients can be granted to one person from Team module access", () => {
  const keys = getVisibleNavKeys({
    role: MembershipRole.SALES_EXECUTIVE,
    isPlatformAdmin: false,
    membershipStatus: MembershipStatus.ACTIVE,
    settings: modulesOn,
    userModulePermissions: { clients: "read" },
  });
  assert.equal(keys.includes("clients"), true);
});

test("front desk / ops staff can open Tasks (assigned work from Sales, etc.)", () => {
  for (const role of [MembershipRole.FNB_STAFF, MembershipRole.HOUSEKEEPING_MANAGER] as const) {
    const keys = getVisibleNavKeys({
      role,
      isPlatformAdmin: false,
      membershipStatus: MembershipStatus.ACTIVE,
      settings: modulesOn,
    });
    assert.equal(keys.includes("tasks"), true, `${role} should see tasks`);
    assert.equal(keys.includes("shortlets"), true);
  }
});

test("active staff keep Tasks even when Team module access set tasks to none", () => {
  const keys = getVisibleNavKeys({
    role: MembershipRole.FNB_STAFF,
    isPlatformAdmin: false,
    membershipStatus: MembershipStatus.ACTIVE,
    settings: modulesOn,
    userModulePermissions: { tasks: "none" },
  });
  assert.equal(keys.includes("tasks"), true);
});

test("investors still do not get staff Tasks", () => {
  const keys = getVisibleNavKeys({
    role: MembershipRole.INVESTOR,
    isPlatformAdmin: false,
    membershipStatus: MembershipStatus.ACTIVE,
    settings: modulesOn,
  });
  assert.equal(keys.includes("tasks"), false);
});
