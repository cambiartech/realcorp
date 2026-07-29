/** Line icons for landing v2. 24×24, 1.6 stroke, inherit currentColor. */

type P = { className?: string; size?: number };

function Svg({ children, size = 24, className }: P & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const IconPipeline = (p: P) => (
  <Svg {...p}>
    <path d="M3 6h18M6 12h12M9 18h6" />
  </Svg>
);

export const IconBuilding = (p: P) => (
  <Svg {...p}>
    <path d="M4 21V6a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v15" />
    <path d="M15 10h3a2 2 0 0 1 2 2v9M2 21h20M8 8h3M8 12h3M8 16h3" />
  </Svg>
);

export const IconLedger = (p: P) => (
  <Svg {...p}>
    <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H6.5A2.5 2.5 0 0 0 4 21.5V4.5Z" />
    <path d="M8 7h8M8 11h5" />
  </Svg>
);

export const IconPeople = (p: P) => (
  <Svg {...p}>
    <circle cx="9" cy="8" r="3.6" />
    <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
    <path d="M16.5 5.2a3.6 3.6 0 0 1 0 6.9M18 20a6.4 6.4 0 0 0-2.2-4.4" />
  </Svg>
);

export const IconLayers = (p: P) => (
  <Svg {...p}>
    <path d="m12 2.8 9 4.6-9 4.6-9-4.6 9-4.6Z" />
    <path d="m3 12.6 9 4.6 9-4.6" />
    <path d="m3 17.2 9 4.6 9-4.6" />
  </Svg>
);

export const IconBroadcast = (p: P) => (
  <Svg {...p}>
    <path d="M4 10.5v3a1 1 0 0 0 1 1h2.6L14 19V5L7.6 9.5H5a1 1 0 0 0-1 1Z" />
    <path d="M17.5 8.5a5 5 0 0 1 0 7M20 6a8.5 8.5 0 0 1 0 12" />
  </Svg>
);

export const IconCheck = (p: P) => (
  <Svg {...p} size={p.size ?? 17}>
    <path d="m4 12.5 5 5L20 6.5" />
  </Svg>
);

export const IconMinus = (p: P) => (
  <Svg {...p} size={p.size ?? 17}>
    <path d="M5 12h14" />
  </Svg>
);

export const IconChev = (p: P) => (
  <Svg {...p} size={p.size ?? 16}>
    <path d="m9 5 7 7-7 7" />
  </Svg>
);

export const IconArrowRight = (p: P) => (
  <Svg {...p} size={p.size ?? 22}>
    <path d="M4 12h15M13 6l6 6-6 6" />
  </Svg>
);

export const IconPlus = (p: P) => (
  <Svg {...p} size={p.size ?? 20}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

export const IconShield = (p: P) => (
  <Svg {...p} size={p.size ?? 20}>
    <path d="M12 2.5 20 6v6c0 5-3.4 8.4-8 9.5C7.4 20.4 4 17 4 12V6l8-3.5Z" />
    <path d="m9 12 2 2 4-4" />
  </Svg>
);

export const IconKey = (p: P) => (
  <Svg {...p} size={p.size ?? 20}>
    <circle cx="7.5" cy="15.5" r="4" />
    <path d="m10.5 12.5 8-8M16 7l2.5 2.5M13.5 9.5 16 12" />
  </Svg>
);

export const IconGlobe = (p: P) => (
  <Svg {...p} size={p.size ?? 20}>
    <circle cx="12" cy="12" r="9.2" />
    <path d="M3 12h18M12 2.8c2.4 2.6 3.6 5.7 3.6 9.2s-1.2 6.6-3.6 9.2c-2.4-2.6-3.6-5.7-3.6-9.2S9.6 5.4 12 2.8Z" />
  </Svg>
);

export const IconHistory = (p: P) => (
  <Svg {...p} size={p.size ?? 20}>
    <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" />
    <path d="M3 4v4.5h4.5M12 7.5V12l3 2" />
  </Svg>
);

export const IconMenu = (p: P) => (
  <Svg {...p} size={p.size ?? 18}>
    <path d="M3 6.5h18M3 12h18M3 17.5h18" />
  </Svg>
);

export const IconClose = (p: P) => (
  <Svg {...p} size={p.size ?? 18}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);
