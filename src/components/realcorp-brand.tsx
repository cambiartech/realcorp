import Image from "next/image";
import Link from "next/link";

const MARK = {
  light: "/mark-dark.svg",
  dark: "/mark-light.svg",
} as const;

export function RealcorpMark({
  variant = "light",
  size = 32,
  className,
}: {
  /** Background the mark sits on — light surfaces use the dark mark, dark surfaces use the light mark */
  variant?: keyof typeof MARK;
  size?: number;
  className?: string;
}) {
  return (
    <Image
      src={MARK[variant]}
      alt=""
      width={size}
      height={size}
      className={["shrink-0", className].filter(Boolean).join(" ")}
      priority
    />
  );
}

export function RealcorpLogoLink({
  href = "/",
  variant = "light",
  showWordmark = true,
  subtitle,
  className,
}: {
  href?: string;
  variant?: keyof typeof MARK;
  showWordmark?: boolean;
  subtitle?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={["group inline-flex min-w-0 items-center gap-px", className].filter(Boolean).join(" ")}
    >
      <RealcorpMark variant={variant} size={32} className="h-8 w-8" />
      {showWordmark ? (
        <span className="min-w-0">
          <span className="block text-sm font-bold tracking-tight text-foreground group-hover:opacity-90">Realcorp</span>
          {subtitle ? <span className="block truncate text-xs text-muted">{subtitle}</span> : null}
        </span>
      ) : null}
    </Link>
  );
}

export function RealcorpHeroLogo({
  className,
  /** Pass to force a mark; omit to auto-switch with light/dark theme */
  variant,
}: {
  className?: string;
  variant?: keyof typeof MARK;
}) {
  return (
    <div className={className}>
      {variant ? (
        <RealcorpMark variant={variant} size={80} className="mx-auto h-20 w-20" />
      ) : (
        <>
          <RealcorpMark variant="light" size={80} className="mx-auto h-20 w-20 dark:hidden" />
          <RealcorpMark variant="dark" size={80} className="mx-auto hidden h-20 w-20 dark:block" />
        </>
      )}
      <p className="mt-5 text-center font-serif text-3xl font-semibold tracking-tight text-foreground">Realcorp</p>
    </div>
  );
}
