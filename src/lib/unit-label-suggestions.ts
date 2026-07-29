function projectCode(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "UNIT";
  const initials = words
    .slice(0, 3)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");
  return initials || "UNIT";
}

function maxTrailingNumber(labels: string[]) {
  let max = 0;
  for (const label of labels) {
    const match = label.match(/(\d+)(?!.*\d)/);
    if (!match) continue;
    const n = Number(match[1]);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max;
}

function nextAlphabetBucket(labels: string[]) {
  const letters = labels.map((l) => l.trim().charAt(0).toUpperCase()).filter((ch) => ch >= "A" && ch <= "Z");
  if (letters.length === 0) return "A";
  const top = letters.sort().at(-1) ?? "A";
  const code = top.charCodeAt(0);
  return code >= 90 ? "A" : String.fromCharCode(code + 1);
}

export function suggestUnitLabels(projectName: string, existingLabels: string[]) {
  const next = maxTrailingNumber(existingLabels) + 1;
  const padded = String(next).padStart(2, "0");
  const code = projectCode(projectName);
  const nextLetter = nextAlphabetBucket(existingLabels);
  return [`${projectName} ${next}`, `${code}-${padded}`, `${nextLetter}-${next}`];
}

/** Build N sequential unit labels from a base name or pricing plan name. */
export function generateBulkUnitLabels(opts: {
  count: number;
  existingLabels: string[];
  baseLabel?: string;
  pricingPlanName?: string;
  projectName: string;
}): string[] {
  const count = Math.min(Math.max(opts.count, 1), 50);
  const start = maxTrailingNumber(opts.existingLabels) + 1;

  let prefix = opts.baseLabel?.trim();
  if (!prefix && opts.pricingPlanName?.trim()) {
    prefix = opts.pricingPlanName.trim();
  }
  if (!prefix) {
    prefix = opts.projectName.trim() || "Unit";
  }

  const trailingNum = prefix.match(/^(.*?)(\d+)$/);
  const stem = trailingNum ? trailingNum[1].trimEnd() : prefix;
  const padWidth = trailingNum ? trailingNum[2].length : 2;

  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const n = start + i;
    const num = String(n).padStart(padWidth, "0");
    out.push(stem ? `${stem} ${num}` : num);
  }
  return out;
}
