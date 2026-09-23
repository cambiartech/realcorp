export type OrgPerson = {
  userId: string;
  name: string;
  title: string | null;
  department: string | null;
  photoUrl: string | null;
  reportsToUserId: string | null;
  reportingToLabel: string | null;
};

export type OrgNode = OrgPerson & { children: OrgNode[] };

function norm(value: string | null | undefined) {
  return (value || "").trim().toLowerCase();
}

/** Prefer the saved user id. Fall back to a unique name match on the old text label. */
export function resolveReportsToUserId(person: OrgPerson, people: OrgPerson[]): string | null {
  if (person.reportsToUserId) {
    const hit = people.find((p) => p.userId === person.reportsToUserId && p.userId !== person.userId);
    if (hit) return hit.userId;
  }
  const label = norm(person.reportingToLabel);
  if (!label) return null;
  const matches = people.filter((p) => p.userId !== person.userId && norm(p.name) === label);
  return matches.length === 1 ? matches[0].userId : null;
}

export function directReportsOf(userId: string, people: OrgPerson[]): OrgPerson[] {
  return people
    .filter((p) => resolveReportsToUserId(p, people) === userId)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Top of the company first, then each manager, ending with the person. */
export function ancestorChain(userId: string, people: OrgPerson[]): OrgPerson[] {
  const byId = new Map(people.map((p) => [p.userId, p]));
  const self = byId.get(userId);
  if (!self) return [];

  const chain: OrgPerson[] = [];
  const seen = new Set<string>();
  let cursor: OrgPerson | undefined = self;
  while (cursor && !seen.has(cursor.userId)) {
    seen.add(cursor.userId);
    chain.push(cursor);
    const managerId = resolveReportsToUserId(cursor, people);
    cursor = managerId ? byId.get(managerId) : undefined;
  }
  return chain.reverse();
}

export function buildOrgForest(people: OrgPerson[]): OrgNode[] {
  const childIds = new Map<string, OrgPerson[]>();
  const linked = new Set<string>();

  for (const person of people) {
    const managerId = resolveReportsToUserId(person, people);
    if (!managerId) continue;
    linked.add(person.userId);
    const list = childIds.get(managerId) ?? [];
    list.push(person);
    childIds.set(managerId, list);
  }

  function node(person: OrgPerson, trail: Set<string>): OrgNode {
    if (trail.has(person.userId)) return { ...person, children: [] };
    const next = new Set(trail);
    next.add(person.userId);
    const children = (childIds.get(person.userId) ?? [])
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((child) => node(child, next));
    return { ...person, children };
  }

  const roots = people
    .filter((p) => !linked.has(p.userId))
    .sort((a, b) => a.name.localeCompare(b.name));

  return roots.map((root) => node(root, new Set()));
}

/** Staff view: their line to the top, plus people who report directly to them. */
export function personalOrgView(userId: string, people: OrgPerson[]) {
  const chain = ancestorChain(userId, people);
  return {
    chain,
    directReports: directReportsOf(userId, people),
  };
}
