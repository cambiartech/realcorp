import assert from "node:assert/strict";
import test from "node:test";
import { ancestorChain, buildOrgForest, directReportsOf, personalOrgView, type OrgPerson } from "./org-chart";

const people: OrgPerson[] = [
  { userId: "ceo", name: "Ada CEO", title: "CEO", department: null, photoUrl: null, reportsToUserId: null, reportingToLabel: null },
  { userId: "mgr", name: "Bo Manager", title: "Sales lead", department: "Sales", photoUrl: null, reportsToUserId: "ceo", reportingToLabel: "Ada CEO" },
  { userId: "me", name: "Chi Staff", title: "Executive", department: "Sales", photoUrl: null, reportsToUserId: "mgr", reportingToLabel: "Bo Manager" },
  { userId: "peer", name: "Dee Peer", title: "Executive", department: "Sales", photoUrl: null, reportsToUserId: "mgr", reportingToLabel: "Bo Manager" },
  { userId: "report", name: "Efe Report", title: "Intern", department: "Sales", photoUrl: null, reportsToUserId: "me", reportingToLabel: "Chi Staff" },
];

test("staff line goes up to the top and skips peers", () => {
  const view = personalOrgView("me", people);
  assert.deepEqual(view.chain.map((p) => p.userId), ["ceo", "mgr", "me"]);
  assert.deepEqual(view.directReports.map((p) => p.userId), ["report"]);
  assert.equal(view.chain.some((p) => p.userId === "peer"), false);
});

test("name label still links when the user id is missing", () => {
  const loose: OrgPerson[] = [
    { ...people[0], reportsToUserId: null },
    { ...people[2], reportsToUserId: null, reportingToLabel: "Ada CEO" },
  ];
  assert.deepEqual(ancestorChain("me", loose).map((p) => p.userId), ["ceo", "me"]);
});

test("company forest nests reports under their manager", () => {
  const forest = buildOrgForest(people);
  assert.equal(forest.length, 1);
  assert.equal(forest[0].userId, "ceo");
  assert.equal(forest[0].children[0].userId, "mgr");
  assert.equal(directReportsOf("mgr", people).length, 2);
});
