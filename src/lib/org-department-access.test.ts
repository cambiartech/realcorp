import assert from "node:assert/strict";
import test from "node:test";
import { MembershipRole } from "@/generated/prisma";
import {
  inviteDepartmentChoices,
  mapOrgDepartmentToAccess,
  resolveInviteDepartmentRole,
} from "./org-department-access";

test("custom department names map onto the right access area", () => {
  assert.equal(mapOrgDepartmentToAccess("Human Resources"), "hr");
  assert.equal(mapOrgDepartmentToAccess("Facility Management Department"), "facility");
  assert.equal(mapOrgDepartmentToAccess("Site Supervisors"), "facility");
  assert.equal(mapOrgDepartmentToAccess("Sales"), "sales");
  assert.equal(mapOrgDepartmentToAccess("finance"), "finance");
});

test("invite department list includes saved custom names", () => {
  const choices = inviteDepartmentChoices([
    "Facility Management Department",
    "Human Resources",
    "Site Supervisors",
  ]);
  const labels = choices.map((row) => row.label);
  assert.ok(labels.includes("Facility Management Department"));
  assert.ok(labels.includes("Human Resources"));
  assert.ok(labels.includes("Site Supervisors"));
  assert.ok(labels.includes("Sales"));
});

test("unmapped custom departments still store the name the org typed", () => {
  const resolved = resolveInviteDepartmentRole("Legal", false);
  assert.equal(resolved.storedDepartment, "Legal");
  assert.equal(resolved.role, MembershipRole.FACILITY_STAFF);
});
