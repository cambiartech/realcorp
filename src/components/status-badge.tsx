/**
 * Shared status badge with a small set of semantic tones, so statuses look
 * the same in every module instead of per-workspace color maps.
 */
export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral";

const TONE_CLASSES: Record<StatusTone, string> = {
  success: "border-[var(--success-line)] bg-[var(--success-wash)] text-[var(--success)] ",
  warning: "border-[var(--warn-line)] bg-[var(--warn-wash)] text-[var(--warn)] ",
  danger: "border-[var(--danger-line)] bg-[var(--danger-wash)] text-[var(--danger)] ",
  info: "border-[var(--info-line)] bg-[var(--info-wash)] text-[var(--info)] ",
  neutral: "border-foreground/15 bg-foreground/[0.06] text-foreground",
};

export function StatusBadge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: StatusTone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        TONE_CLASSES[tone],
        className ?? "",
      ].join(" ")}
    >
      {children}
    </span>
  );
}
