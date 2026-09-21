import type { ReactNode } from "react";

const WIDTH_CLASS = {
  /** Standard tenant pages — aligns flush left from sidebar with comfortable padding */
  default: "max-w-[1400px]",
  narrow: "max-w-4xl",
  medium: "max-w-6xl",
  finance: "max-w-none",
} as const;

type TenantPageShellProps = {
  children: ReactNode;
  width?: keyof typeof WIDTH_CLASS;
  className?: string;
};

/**
 * Shared page container for tenant app views.
 * Calm Stripe-like page padding; left-aligned beside the sidebar.
 */
export function TenantPageShell({ children, width = "default", className = "" }: TenantPageShellProps) {
  return (
    <div
      className={["rc-page w-full px-5 py-5 sm:px-8 sm:py-7", WIDTH_CLASS[width], className]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}
