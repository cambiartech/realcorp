export const UNIT_NAME_PATTERN_PRESETS = [
  {
    id: "room_then_name",
    label: "Room number, then client name",
    example: "RM 26 MR EMANA EDET",
    pattern: "RM {room} {name}",
  },
  {
    id: "name_then_room",
    label: "Client name, then room number",
    example: "MR EMANA EDET RM 26",
    pattern: "{name} RM {room}",
  },
  {
    id: "custom",
    label: "Custom pattern",
    example: "Unit {room} — {name}",
    pattern: "Unit {room} — {name}",
  },
] as const;

export type UnitNamePatternPresetId = (typeof UNIT_NAME_PATTERN_PRESETS)[number]["id"];

const GENERIC_NAME = /^(penthouse|studio|family|deluxe|unit|room|apartment|apt|hostel|block|wing)s?$/i;

export function normalizeClientNameKey(name: string) {
  return name
    .trim()
    .replace(/[.,/\\]+/g, " ")
    .replace(/\s+/g, " ")
    .toUpperCase();
}

export function formatClientDisplayName(name: string) {
  return name
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => {
      if (word.length <= 3 && word === word.toUpperCase()) {
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function compileCustomPattern(pattern: string): RegExp | null {
  const trimmed = pattern.trim();
  if (!/{name}/i.test(trimmed)) return null;

  const tokens = trimmed.split(/(\{name\}|\{room\}|\{unit\}|\{code\})/i);
  if (tokens.every((part) => !part)) return null;

  let source = "^";
  tokens.forEach((part, index) => {
    const token = part.toLowerCase();
    if (token === "{name}") {
      const isLast = index === tokens.length - 1;
      source += isLast ? "(.+)" : "(.+?)";
      return;
    }
    if (token === "{room}" || token === "{unit}" || token === "{code}") {
      source += "\\S+";
      return;
    }
    source += escapeRegex(part).replace(/\\ +/g, "\\s+").replace(/\s+/g, "\\s+");
  });
  source += "$";
  try {
    return new RegExp(source, "i");
  } catch {
    return null;
  }
}

const HONORIFIC =
  /^(mr|mrs|miss|ms|dr|alhj|alhaji|chief|engr|eng|prof|sir|lady|prince|princess|hon|barr|pastor|rev)\.?$/i;

/** RM 26 NAME, S8 NAME, A12 NAME, Unit 4 NAME */
const ROOM_THEN_NAME =
  /^(?:(?:rm|room|apt|apartment|unit|u|#)[\s.\-]*)?(?:[a-z]{1,4}[\s.\-]*)?\d+[a-z]?\s+(.+)$/i;
const NAME_THEN_ROOM =
  /^(.+?)\s+(?:(?:rm|room|apt|apartment|unit|u|#)[\s.\-]*)?\d+[a-z]?$/i;
const NAME_THEN_ROOM_STRICT =
  /^(.+?)\s+(?:(?:rm|room|apt|apartment|unit|u|#)[\s.\-]+)\d+[a-z]?$/i;

export function extractClientNameFromUnitLabel(
  label: string,
  options?: { preset?: UnitNamePatternPresetId; pattern?: string },
): string | null {
  const text = label.trim().replace(/\s+/g, " ");
  if (!text) return null;

  const preset = options?.preset ?? "room_then_name";
  let extracted: string | null = null;

  if (preset === "room_then_name") {
    extracted = text.match(ROOM_THEN_NAME)?.[1] ?? null;
  } else if (preset === "name_then_room") {
    extracted = text.match(NAME_THEN_ROOM)?.[1] ?? null;
  } else {
    const compiled = compileCustomPattern(options?.pattern || "");
    if (!compiled) return null;
    extracted = text.match(compiled)?.[1] ?? null;
  }

  const name = extracted?.trim().replace(/\s+/g, " ") ?? "";
  if (name.length < 2) return null;
  if (/^\d+[a-z]?$/i.test(name)) return null;
  return name;
}

export function nameLooksGeneric(name: string, projectName?: string) {
  const key = normalizeClientNameKey(name);
  if (!key) return true;
  if (GENERIC_NAME.test(key)) return true;
  const words = key.split(" ").filter(Boolean);
  if (words.length > 0 && words.every((word) => GENERIC_NAME.test(word))) return true;
  if (projectName && key === normalizeClientNameKey(projectName)) return true;
  return false;
}

export function labelLooksLikePersonName(name: string) {
  const words = name.trim().replace(/\s+/g, " ").split(" ").filter(Boolean);
  if (words.length < 2) return false;
  if (nameLooksGeneric(name)) return false;
  const last = words[words.length - 1] ?? "";
  if (/^\d+[a-z]?$/i.test(last) && !HONORIFIC.test(words[0] ?? "")) return false;
  if (HONORIFIC.test((words[0] ?? "").replace(/\./g, ""))) return true;
  const meaningful = words.filter((word) => !/^\d+[a-z]?$/i.test(word) && !GENERIC_NAME.test(word));
  return meaningful.length >= 2;
}

/** Purpose never excludes a client — rental, short-let, sale, and hostel all count. */
export function extractClientNameForImport(
  label: string,
  options?: { preset?: UnitNamePatternPresetId; pattern?: string },
): string | null {
  const preset = options?.preset ?? "room_then_name";
  const primary = extractClientNameFromUnitLabel(label, options);
  if (preset === "custom") return primary;
  if (primary) return primary;
  if (preset !== "room_then_name") {
    const coded = extractClientNameFromUnitLabel(label, { preset: "room_then_name" });
    if (coded) return coded;
  }
  const strictName = label.trim().replace(/\s+/g, " ").match(NAME_THEN_ROOM_STRICT)?.[1]?.trim();
  if (strictName && strictName.length >= 2) return strictName;
  const whole = label.trim().replace(/\s+/g, " ");
  if (labelLooksLikePersonName(whole)) return whole;
  return null;
}

export function clientDisplayNameFromUnitLabel(label: string, projectName?: string) {
  const extracted = extractClientNameForImport(label);
  if (!extracted || nameLooksGeneric(extracted, projectName)) return null;
  return formatClientDisplayName(extracted);
}

export type UnitLabelImportInput = {
  id: string;
  label: string;
  projectId: string;
  projectName: string;
  purpose: string;
  status: string;
  alreadyLinked: boolean;
};

export type UnitLabelImportGroup = {
  key: string;
  fullName: string;
  warning: string | null;
  defaultSelected: boolean;
  units: Array<{
    id: string;
    label: string;
    projectId: string;
    projectName: string;
    purpose: string;
    status: string;
    alreadyLinked: boolean;
  }>;
};

export function groupUnitsByExtractedClient(
  units: UnitLabelImportInput[],
  options?: { preset?: UnitNamePatternPresetId; pattern?: string },
): {
  groups: UnitLabelImportGroup[];
  skippedNoName: number;
  skippedAlreadyLinked: number;
} {
  const byKey = new Map<string, UnitLabelImportGroup>();
  let skippedNoName = 0;
  let skippedAlreadyLinked = 0;

  for (const unit of units) {
    if (unit.alreadyLinked) {
      skippedAlreadyLinked += 1;
      continue;
    }
    const extracted = extractClientNameForImport(unit.label, options);
    if (!extracted) {
      skippedNoName += 1;
      continue;
    }
    const key = normalizeClientNameKey(extracted);
    const generic = nameLooksGeneric(extracted, unit.projectName);
    const current = byKey.get(key);
    const unitRow = {
      id: unit.id,
      label: unit.label,
      projectId: unit.projectId,
      projectName: unit.projectName,
      purpose: unit.purpose,
      status: unit.status,
      alreadyLinked: unit.alreadyLinked,
    };
    if (current) {
      current.units.push(unitRow);
      if (generic) current.warning = current.warning || "This name looks like a unit description, not a person.";
      continue;
    }
    byKey.set(key, {
      key,
      fullName: formatClientDisplayName(extracted),
      warning: generic ? "This name looks like a unit description, not a person." : null,
      defaultSelected: !generic,
      units: [unitRow],
    });
  }

  const groups = Array.from(byKey.values()).sort((a, b) => a.fullName.localeCompare(b.fullName));
  return { groups, skippedNoName, skippedAlreadyLinked };
}

/** Banner only when enough unmapped units still look like they contain a person name. */
export const UNIT_IMPORT_HINT_MIN = 12;

export function countImportableUnlinkedUnits(
  units: Array<{ label: string; projectName?: string; alreadyLinked?: boolean }>,
) {
  const unlinked = units.filter((unit) => !unit.alreadyLinked);
  const detected = detectUnitNamePattern(unlinked.map((unit) => unit.label));
  let count = 0;
  for (const unit of unlinked) {
    const name = extractClientNameForImport(unit.label, detected);
    if (!name || nameLooksGeneric(name, unit.projectName)) continue;
    count += 1;
  }
  return count;
}

export function scoreUnitNamePattern(
  labels: string[],
  options: { preset: UnitNamePatternPresetId; pattern?: string },
) {
  let hits = 0;
  for (const label of labels) {
    const name = extractClientNameFromUnitLabel(label, options);
    if (name && name.split(" ").length >= 1 && name.length >= 3) hits += 1;
  }
  return hits;
}

export function detectUnitNamePattern(labels: string[]): {
  preset: UnitNamePatternPresetId;
  pattern: string;
  hits: number;
} {
  const candidates: Array<{ preset: UnitNamePatternPresetId; pattern: string }> = [
    { preset: "room_then_name", pattern: "RM {room} {name}" },
    { preset: "name_then_room", pattern: "{name} RM {room}" },
  ];
  let best = { ...candidates[0], hits: -1 };
  for (const candidate of candidates) {
    const hits = scoreUnitNamePattern(labels, candidate);
    if (hits > best.hits) best = { ...candidate, hits };
  }
  return best;
}

export function suggestedClientStatus(statuses: string[], purposes: string[] = []) {
  if (statuses.some((status) => status === "SOLD")) return "ACTIVE" as const;
  if (
    purposes.some(
      (purpose) =>
        purpose === "SHORT_LET" || purpose === "RENTAL" || purpose === "HOSTEL" || purpose === "LIVING",
    )
  ) {
    return "ACTIVE" as const;
  }
  return "PROSPECT" as const;
}

/** Sold, short-let, and rental clients are owners. Reserved stays assigned as owner of record, but the client is not marked completed. */
export function suggestedRoleForUnit(_purpose: string, _status: string) {
  return "OWNER" as const;
}

export function suggestedClientRole(_purposes: string[]) {
  return "OWNER" as const;
}

export function reservedOwnerNote(status: string) {
  if (status !== "RESERVED") return null;
  return "Reserved — not a completed owner yet (part payment / allocation pending).";
}
