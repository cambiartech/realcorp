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
