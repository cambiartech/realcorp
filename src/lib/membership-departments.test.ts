import assert from "node:assert/strict";
import test from "node:test";
import { MembershipRole } from "@/generated/prisma";
import { filterTaskAssigneeMembers, type TaskAssigneeMember } from "./membership-departments";

const members: TaskAssigneeMember[] = [
  { id: "sales-1", label: "Sales Kid", role: MembershipRole.SALES_EXECUTIVE, department: "Sales" },
  { id: "ops-fd", label: "Front Desk", role: MembershipRole.HOUSEKEEPING_MANAGER, department: "Operations" },
  { id: "ops-2", label: "Housekeeping", role: MembershipRole.FNB_STAFF, department: "Operations" },
  { id: "finance-1", label: "Finance", role: MembershipRole.FINANCE_MANAGER, department: "Finance" },
  { id: "admin-1", label: "Admin", role: MembershipRole.ORG_ADMIN, department: null },
];

test("sales cannot assign Front Desk without a manager grant", () => {
  const allowed = filterTaskAssigneeMembers(members, {
    isPlatformAdmin: false,
    actorRole: MembershipRole.SALES_EXECUTIVE,
    actorUserId: "sales-1",
    actorDepartment: "Sales",
  });
  const ids = allowed.map((m) => m.id);
  assert.ok(ids.includes("sales-1"));
  assert.ok(ids.includes("admin-1"));
  assert.equal(ids.includes("ops-fd"), false);
  assert.equal(ids.includes("finance-1"), false);
});

test("sales can assign Front Desk when listed as their task manager", () => {
  const allowed = filterTaskAssigneeMembers(members, {
    isPlatformAdmin: false,
    actorRole: MembershipRole.SALES_EXECUTIVE,
    actorUserId: "sales-1",
    actorDepartment: "Sales",
    manageeUserIds: ["ops-fd"],
  });
  const ids = allowed.map((m) => m.id);
  assert.ok(ids.includes("ops-fd"));
  assert.equal(ids.includes("ops-2"), false);
  assert.equal(ids.includes("finance-1"), false);
});

test("org admin still sees everyone", () => {
  const allowed = filterTaskAssigneeMembers(members, {
    isPlatformAdmin: false,
    actorRole: MembershipRole.ORG_ADMIN,
    actorUserId: "admin-1",
  });
  assert.equal(allowed.length, members.length);
});
