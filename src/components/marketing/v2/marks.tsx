/**
 * Realcorp brand marks — v2 explorations.
 *
 * Drawn on a 48×48 grid, ink from `currentColor`, copper from `--accent`.
 * Nothing here touches /public/mark-dark.svg or /public/mark-light.svg.
 *
 * Swap the mark used across the page with the ACTIVE_MARK constant below.
 */

export type MarkName = "monogram" | "tile" | "cornerstone" | "seal";

/** Change this one line to switch the mark used everywhere on the page. */
export const ACTIVE_MARK: MarkName = "tile";

type MarkProps = {
  size?: number;
  className?: string;
  /** Pass a label to expose the mark to screen readers; otherwise it's decorative. */
  title?: string;
  /** Colour the knockout is filled with — match the surface behind the mark. */
  knockout?: string;
};

/* Shared R geometry: stem + bowl (knockout), and the copper leg. */
const R_BODY = "M14 10h13a7 7 0 0 1 0 14h-7v14h-6V10Zm6 5h7a2 2 0 0 1 0 4h-7v-4Z";
const R_LEG = "M27 24l9 14h-7.2L20 24Z";

function svgProps(size: number, className?: string, title?: string) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 48 48",
    fill: "none" as const,
    className,
    role: title ? ("img" as const) : ("presentation" as const),
    "aria-label": title,
    "aria-hidden": title ? undefined : (true as const),
  };
}

/* ── A · MONOGRAM ──────────────────────────────────────────────
   Bare geometric R, copper leg. The most flexible — sits well next
   to the wordmark and never needs a background to work.           */
export function MarkMonogram({ size = 40, className, title }: MarkProps) {
  return (
    <svg {...svgProps(size, className, title)}>
      <path d={R_BODY} fill="currentColor" fillRule="evenodd" />
      <path d={R_LEG} fill="var(--accent)" />
    </svg>
  );
}

/* ── B · TILE ──────────────────────────────────────────────────
   The same R knocked out of an ink tile. Best app-icon / favicon
   behaviour; holds its shape down to 16px.                        */
export function MarkTile({ size = 40, className, title, knockout = "var(--canvas)" }: MarkProps) {
  return (
    <svg {...svgProps(size, className, title)}>
      <rect width="48" height="48" rx="11" fill="currentColor" />
      <path d={R_BODY} fill={knockout} fillRule="evenodd" />
      <path d={R_LEG} fill="var(--accent)" />
    </svg>
  );
}

/* ── C · CORNERSTONE ───────────────────────────────────────────
   An L-shaped foundation with a copper block slotted into the
   notch. Abstract: modules snapping into one structure.           */
export function MarkCornerstone({ size = 40, className, title }: MarkProps) {
  return (
    <svg {...svgProps(size, className, title)}>
      <path d="M8 13a5 5 0 0 1 5-5h10v10a5 5 0 0 0 5 5h12v12a5 5 0 0 1-5 5H8V13Z" fill="currentColor" />
      <rect x="26" y="8" width="14" height="14" rx="4.5" fill="var(--accent)" />
    </svg>
  );
}

/* ── D · SEAL ──────────────────────────────────────────────────
   R inside a disc. Institutional, stamp-like — reads as a mark of
   record, which suits a ledger-of-record product.                 */
export function MarkSeal({ size = 40, className, title, knockout = "var(--canvas)" }: MarkProps) {
  return (
    <svg {...svgProps(size, className, title)}>
      <circle cx="24" cy="24" r="20" fill="currentColor" />
      <path
        d="M16 12h12a7.5 7.5 0 0 1 0 15h-6v9h-6V12Zm6 5.5h6a2.2 2.2 0 0 1 0 4.4h-6v-4.4Z"
        fill={knockout}
        fillRule="evenodd"
      />
      <path d="M28.6 27l8 12h-7.3L22 27Z" fill="var(--accent)" />
    </svg>
  );
}

const MARKS = {
  monogram: MarkMonogram,
  tile: MarkTile,
  cornerstone: MarkCornerstone,
  seal: MarkSeal,
} as const;

export function Mark({ name = ACTIVE_MARK, ...rest }: MarkProps & { name?: MarkName }) {
  const Component = MARKS[name];
  return <Component {...rest} />;
}

/** Mark + wordmark. */
export function Wordmark({
  size = 30,
  name = ACTIVE_MARK,
  className,
}: {
  size?: number;
  name?: MarkName;
  className?: string;
}) {
  return (
    <span className={["v2-wordmark", className].filter(Boolean).join(" ")}>
      <Mark name={name} size={size} title="Realcorp" />
      <span>Realcorp</span>
    </span>
  );
}
