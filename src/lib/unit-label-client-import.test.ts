import assert from "node:assert/strict";
import test from "node:test";
import {
  countImportableUnlinkedUnits,
  detectUnitNamePattern,
  extractClientNameForImport,
  extractClientNameFromUnitLabel,
  formatClientDisplayName,
  groupUnitsByExtractedClient,
  nameLooksGeneric,
  normalizeClientNameKey,
  reservedOwnerNote,
  suggestedClientRole,
  suggestedClientStatus,
  UNIT_IMPORT_HINT_MIN,
} from "./unit-label-client-import";

test("extracts the client from RM number then name labels", () => {
  assert.equal(
    extractClientNameFromUnitLabel("RM 26 MR EMANA EDET"),
    "MR EMANA EDET",
  );
  assert.equal(extractClientNameFromUnitLabel("RM 6 MR BOLARINWA"), "MR BOLARINWA");
  assert.equal(
    extractClientNameFromUnitLabel("RM 10 MR AND MRS ODIGIE"),
    "MR AND MRS ODIGIE",
  );
  assert.equal(extractClientNameFromUnitLabel("RM 12"), null);
  assert.equal(extractClientNameFromUnitLabel("Becca's Deluxe 1"), null);
  assert.equal(extractClientNameFromUnitLabel("S8 TUGBOGBO MUIZ"), "TUGBOGBO MUIZ");
  assert.equal(extractClientNameFromUnitLabel("S7 LEKOM GRACE"), "LEKOM GRACE");
});

test("custom pattern uses {name} from the label", () => {
  assert.equal(
    extractClientNameFromUnitLabel("Unit 4 — Ada Okafor", {
      preset: "custom",
      pattern: "Unit {room} — {name}",
    }),
    "Ada Okafor",
  );
});

test("name then room pattern", () => {
  assert.equal(
    extractClientNameFromUnitLabel("MR EMANA EDET RM 26", { preset: "name_then_room" }),
    "MR EMANA EDET",
  );
});

test("groups the same person across units and skips blanks", () => {
  const result = groupUnitsByExtractedClient([
    {
      id: "1",
      label: "RM 6 MR BOLARINWA",
      projectId: "p1",
      projectName: "Becca's Deluxe",
      purpose: "SALE",
      status: "SOLD",
      alreadyLinked: false,
    },
    {
      id: "2",
      label: "RM 5 MR BOLARINWA",
      projectId: "p1",
      projectName: "Becca's Deluxe",
      purpose: "SALE",
      status: "SOLD",
      alreadyLinked: false,
    },
    {
      id: "3",
      label: "RM 12",
      projectId: "p1",
      projectName: "Becca's Deluxe",
      purpose: "SALE",
      status: "RESERVED",
      alreadyLinked: false,
    },
    {
      id: "4",
      label: "RM 4 MISS MOBERRY",
      projectId: "p1",
      projectName: "Becca's Deluxe",
      purpose: "SALE",
      status: "SOLD",
      alreadyLinked: true,
    },
  ]);

  assert.equal(result.groups.length, 1);
  assert.equal(result.groups[0].fullName, "Mr Bolarinwa");
  assert.equal(result.groups[0].units.length, 2);
  assert.equal(result.skippedNoName, 1);
  assert.equal(result.skippedAlreadyLinked, 1);
  assert.equal(normalizeClientNameKey("Mr  Bolarinwa"), "MR BOLARINWA");
  assert.equal(formatClientDisplayName("MR BOLARINWA"), "Mr Bolarinwa");
});

test("flags org or generic names so they are not imported by default", () => {
  assert.equal(nameLooksGeneric("BO PROPERTIES", "BO Properties"), true);
  assert.equal(nameLooksGeneric("PENTHOUSE FAMILY"), true);
  assert.equal(nameLooksGeneric("FAMILY"), true);
  const grouped = groupUnitsByExtractedClient([
    {
      id: "1",
      label: "RM 12 BO PROPERTIES",
      projectId: "p1",
      projectName: "BO Properties",
      purpose: "SHORT_LET",
      status: "SOLD",
      alreadyLinked: false,
    },
  ]);
  assert.equal(grouped.groups[0].defaultSelected, false);
});

test("auto-detects room-then-name for BO Properties style labels", () => {
  const detected = detectUnitNamePattern([
    "RM 26 MR EMANA EDET",
    "RM 25 MR EMANA EDET",
    "RM 6 MR BOLARINWA",
    "Becca's Deluxe 1",
  ]);
  assert.equal(detected.preset, "room_then_name");
  assert.ok(detected.hits >= 3);
});

test("counts only unmapped units that look like a person, ignoring already linked and generic labels", () => {
  assert.equal(UNIT_IMPORT_HINT_MIN, 12);
  assert.equal(
    countImportableUnlinkedUnits([
      { label: "RM 26 MR EMANA EDET", alreadyLinked: false },
      { label: "RM 6 MR BOLARINWA", alreadyLinked: false },
      { label: "RM 5 MR BOLARINWA", alreadyLinked: true },
      { label: "RM 12 PENTHOUSE FAMILY", alreadyLinked: false, projectName: "BO Properties" },
      { label: "Becca's Deluxe 1", alreadyLinked: false },
    ]),
    2,
  );
});

test("rental units with letter codes or name-only labels still import as clients", () => {
  assert.equal(extractClientNameForImport("S8 TUGBOGBO MUIZ"), "TUGBOGBO MUIZ");
  assert.equal(extractClientNameForImport("MR CHIMA DAVID"), "MR CHIMA DAVID");
  assert.equal(extractClientNameForImport("Becca's Deluxe 1"), null);
  const grouped = groupUnitsByExtractedClient([
    {
      id: "1",
      label: "S8 TUGBOGBO MUIZ",
      projectId: "p1",
      projectName: "Project Primero",
      purpose: "RENTAL",
      status: "SOLD",
      alreadyLinked: false,
    },
    {
      id: "2",
      label: "MR CHIMA DAVID",
      projectId: "p1",
      projectName: "Project Primero",
      purpose: "RENTAL",
      status: "SOLD",
      alreadyLinked: false,
    },
  ]);
  assert.equal(grouped.groups.length, 2);
  assert.equal(grouped.skippedNoName, 0);
  assert.ok(grouped.groups.every((group) => group.defaultSelected));
  assert.equal(suggestedClientStatus(["SOLD"], ["RENTAL"]), "ACTIVE");
});

test("sold, short-let, and rental count as completed owners; reserved stays a prospect", () => {
  assert.equal(suggestedClientStatus(["SOLD"], ["SALE"]), "ACTIVE");
  assert.equal(suggestedClientStatus(["UNDER_CONSTRUCTION"], ["SHORT_LET"]), "ACTIVE");
  assert.equal(suggestedClientStatus(["AVAILABLE"], ["RENTAL"]), "ACTIVE");
  assert.equal(suggestedClientStatus(["RESERVED"], ["SALE"]), "PROSPECT");
  assert.equal(suggestedClientRole(["SHORT_LET"]), "OWNER");
  assert.equal(reservedOwnerNote("RESERVED"), "Reserved — not a completed owner yet (part payment / allocation pending).");
  assert.equal(reservedOwnerNote("SOLD"), null);
});
