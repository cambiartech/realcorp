export function normalizeFinanceExpenseCategory(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

export function expenseCategoryNamesMatch(a: string, b: string): boolean {
  return (
    normalizeFinanceExpenseCategory(a).toLowerCase() === normalizeFinanceExpenseCategory(b).toLowerCase()
  );
}
