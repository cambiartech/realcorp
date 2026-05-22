export type FinanceControls = {
  expenseApprovalThreshold?: number;
  firstReminderAfterDays: number;
  secondReminderAfterDays: number;
};

const DEFAULT_CONTROLS: FinanceControls = {
  firstReminderAfterDays: 7,
  secondReminderAfterDays: 14,
};

export function parseFinanceControls(raw: unknown): FinanceControls {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_CONTROLS };
  const o = raw as Record<string, unknown>;
  const expenseApprovalThreshold =
    typeof o.expenseApprovalThreshold === "number" && o.expenseApprovalThreshold > 0
      ? o.expenseApprovalThreshold
      : undefined;
  const firstReminderAfterDays =
    typeof o.firstReminderAfterDays === "number" && o.firstReminderAfterDays >= 1
      ? Math.floor(o.firstReminderAfterDays)
      : DEFAULT_CONTROLS.firstReminderAfterDays;
  const secondReminderAfterDays =
    typeof o.secondReminderAfterDays === "number" && o.secondReminderAfterDays >= 1
      ? Math.floor(o.secondReminderAfterDays)
      : DEFAULT_CONTROLS.secondReminderAfterDays;
  return {
    expenseApprovalThreshold,
    firstReminderAfterDays,
    secondReminderAfterDays: Math.max(secondReminderAfterDays, firstReminderAfterDays),
  };
}
