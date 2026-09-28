/** Unique assignee ids, first one stays the lead. Capped so a task cannot grow without bound. */
export function normalizeAssigneeIds(ids: Array<string | null | undefined> | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of ids ?? []) {
    const id = String(raw ?? "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    if (out.length >= 12) break;
  }
  return out;
}

export function assigneeSummary(labels: string[]): string {
  const names = labels.map((label) => label.trim()).filter(Boolean);
  if (names.length === 0) return "Unassigned";
  if (names.length <= 2) return names.join(", ");
  return `${names[0]} +${names.length - 1}`;
}
