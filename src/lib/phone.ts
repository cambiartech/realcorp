/** Normalize Nigerian phone values and produce matching variants. */
function digitsOnly(input: string): string {
  return input.replace(/[^\d]/g, "");
}

export function phoneVariants(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const d = digitsOnly(raw);
  if (!d) return [];

  const set = new Set<string>();
  set.add(d);

  // 080xxxxxxxx -> 23480xxxxxxxx
  if (d.length === 11 && d.startsWith("0")) {
    set.add(`234${d.slice(1)}`);
  }

  // 23480xxxxxxxx -> 080xxxxxxxx
  if (d.length === 13 && d.startsWith("234")) {
    set.add(`0${d.slice(3)}`);
  }

  // 80xxxxxxxx (missing prefix) -> add both variants
  if (d.length === 10) {
    set.add(`0${d}`);
    set.add(`234${d}`);
  }

  return Array.from(set);
}

export function canonicalPhone(raw: string | null | undefined): string | null {
  const variants = phoneVariants(raw);
  return variants[0] ?? null;
}
