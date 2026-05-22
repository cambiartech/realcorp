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
      className={["group inline-flex min-w-0 items-center gap-2.5", className].filter(Boolean).join(" ")}
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

export function RealcorpHeroLogo({ className }: { className?: string }) {
  return (
    <div className={className}>
      <RealcorpMark variant="light" size={56} className="mx-auto h-14 w-14" />
      <p className="mt-4 text-center font-serif text-2xl font-semibold tracking-tight text-foreground">Realcorp</p>
    </div>
  );
}
