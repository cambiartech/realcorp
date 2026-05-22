import Image from "next/image";
import Link from "next/link";

/** Background the mark sits on — not the app colour-scheme name. */
export type LandingSurface = "light" | "dark";

const MARK_SRC = {
  light: "/mark-dark.svg",
  dark: "/mark-light.svg",
} as const;

export function LandingMark({
  surface,
  size,
  className,
  priority,
}: {
  surface: LandingSurface;
  size: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src={MARK_SRC[surface]}
      alt=""
      width={size}
      height={size}
      className={["mark-img", className].filter(Boolean).join(" ")}
      priority={priority}
    />
  );
}

export function LandingLockup({
  surface,
  href = "/",
  markSize = 34,
  className,
}: {
  surface: LandingSurface;
  href?: string;
  markSize?: number;
  className?: string;
}) {
  return (
    <Link href={href} className={["lockup", className].filter(Boolean).join(" ")} aria-label="Realcorp · home">
      <LandingMark surface={surface} size={markSize} className="mark" priority />
      <span>Realcorp</span>
    </Link>
  );
}
