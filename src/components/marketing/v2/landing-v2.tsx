"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useInView,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type Variants,
} from "motion/react";

import { Wordmark } from "./marks";
import { LandingJsonLd } from "./landing-seo";
import { fontVariables } from "./fonts";
import { FAQ_CONTENT, SITE } from "@/lib/seo";
import {
  IconArrowRight,
  IconBroadcast,
  IconBuilding,
  IconCheck,
  IconChev,
  IconClose,
  IconGlobe,
  IconHistory,
  IconKey,
  IconLayers,
  IconLedger,
  IconMenu,
  IconMinus,
  IconPeople,
  IconPipeline,
  IconPlus,
  IconShield,
} from "./icons";
import "@/styles/landing-v2.css";

/* ═══════════════════════════════════════════════════════════════
   Motion primitives
   ═══════════════════════════════════════════════════════════════ */

const EASE = [0.16, 1, 0.3, 1] as const;

const rise: Variants = {
  hidden: { opacity: 0, y: 22 },
  show: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: EASE, delay: i * 0.07 },
  }),
};

/** Fades + lifts its children into view once. */
function Reveal({
  children,
  delay = 0,
  className,
  as = "div",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "section" | "li" | "header";
}) {
  const Component = motion[as];
  return (
    <Component
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-12% 0px -8% 0px" }}
      custom={delay}
      variants={rise}
    >
      {children}
    </Component>
  );
}

/** Counts up to `to` the first time it scrolls into view. */
function Counter({
  to,
  prefix = "",
  suffix = "",
  decimals = 0,
}: {
  to: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-20%" });
  const reduce = useReducedMotion();
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const duration = reduce ? 0 : 1400;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = duration === 0 ? 1 : Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(to * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, to, reduce]);

  return (
    <span ref={ref}>
      {prefix}
      {value.toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Hero backdrop — swappable.
   Three drifting copper/brass glows over a masked grid. Replace the
   body of this component to drop in a different background.
   ═══════════════════════════════════════════════════════════════ */
function HeroBackdrop() {
  const reduce = useReducedMotion();
  const drift = (x: number[], y: number[], duration: number) =>
    reduce
      ? {}
      : {
          animate: { x, y },
          transition: {
            duration,
            repeat: Infinity,
            repeatType: "mirror" as const,
            ease: "easeInOut" as const,
          },
        };

  return (
    <div className="backdrop" aria-hidden="true">
      <div className="backdrop-grid" />
      <motion.div
        className="backdrop-glow glow-a"
        {...drift([0, 60, -20, 0], [0, 30, 60, 0], 22)}
      />
      <motion.div
        className="backdrop-glow glow-b"
        {...drift([0, -50, 30, 0], [0, 40, -20, 0], 26)}
      />
      <motion.div
        className="backdrop-glow glow-c"
        {...drift([0, 40, -40, 0], [0, -30, 20, 0], 30)}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Content
   ═══════════════════════════════════════════════════════════════ */

const NAV = [
  { href: "#platform", label: "Platform" },
  { href: "#modules", label: "Modules" },
  { href: "#ledger", label: "How it works" },
  { href: "#customers", label: "Customers" },
  { href: "#faq", label: "FAQ" },
];

const CUSTOMERS = [
  "Kingsway Estates",
  "Marigold Group",
  "Lekki Heights",
  "Sterling Realty",
  "Adron Homes",
];

const BEFORE = [
  "Unit availability lives in a WhatsApp thread",
  "Finance re-keys every signed contract by hand",
  "Commission is argued about after the fact",
  "Month-end is four days of reconciliation",
  "Nobody can say who changed the price, or when",
];

const AFTER = [
  "One unit record, one status, visible to every desk",
  "A signed contract posts its own receivable schedule",
  "Commission accrues off the same number sales closed",
  "Month-end is a review, not a rebuild",
  "Every field change is stamped, attributed, exportable",
];

type Role = {
  id: string;
  label: string;
  headline: string;
  blurb: string;
  points: string[];
  shot: string;
};

const ROLES: Role[] = [
  {
    id: "sales",
    label: "Sales",
    headline: "Work the pipeline, not the spreadsheet.",
    blurb:
      "Leads arrive from WhatsApp, Meta and your own forms already scored and assigned. Reps move deals, hold units, and generate contracts without leaving the record.",
    points: [
      "WhatsApp & Meta lead capture with routing rules",
      "Deal stages with unit allocation and locking built in",
      "Quote → contract → commission in one handoff",
      "Activity feed every manager can actually read",
    ],
    shot: "/screenshots/sc-5.png",
  },
  {
    id: "finance",
    label: "Finance",
    headline: "Close the month in an afternoon.",
    blurb:
      "Milestone plans generate themselves from the deal. Receivables age automatically. Bank statements match against the ledger instead of against memory.",
    points: [
      "Milestone payment plans posted straight from the deal",
      "Receivables, payables and vendor bills on one ledger",
      "Bank import with auto-match and an exceptions queue",
      "Profit, cash flow and balance reports per project",
    ],
    shot: "/screenshots/sc-3.png",
  },
  {
    id: "operations",
    label: "Operations",
    headline: "Every unit, every night, accounted for.",
    blurb:
      "Projects, inventory and shortlets in one place — front desk, reservations, folio and night audit included, so operations and finance never disagree.",
    points: [
      "Project and unit inventory with allocation history",
      "Shortlets: front desk, folio, channels, night audit",
      "Inspections and handover checklists",
      "Floor plans and price lists attached to the unit",
    ],
    shot: "/screenshots/sc-6.png",
  },
  {
    id: "people",
    label: "People",
    headline: "Offer letter to payslip, one thread.",
    blurb:
      "Onboarding bundles issue the right forms for the role. Departments, reporting lines and deductions stay in step with the org you actually have.",
    points: [
      "Role-based onboarding bundles that send themselves",
      "Offer letters, contracts and e-signature",
      "Payslips, deductions and statutory schedules",
      "Departments, reporting lines and access in sync",
    ],
    shot: "/screenshots/sc-2.png",
  },
];

const MODULES = [
  {
    n: "01",
    icon: <IconPipeline />,
    title: "Sales CRM",
    body: "Capture, score, assign and close — without a single export.",
    items: [
      "WhatsApp & Meta capture",
      "Scoring and routing rules",
      "Deals, stages, activity",
      "Quote-to-contract",
    ],
  },
  {
    n: "02",
    icon: <IconBuilding />,
    title: "Projects & inventory",
    body: "Every unit, its status, and the deal that holds it.",
    items: [
      "Unit inventory",
      "Allocation, locking, release",
      "Shortlets & front desk",
      "Floor plans and price lists",
    ],
  },
  {
    n: "03",
    icon: <IconLedger />,
    title: "Finance",
    body: "Milestones, receivables, reconciliation and audit in one ledger.",
    items: [
      "Milestone payment plans",
      "Receivables & payables",
      "Bank reconciliation",
      "Vendor bills & audit logs",
    ],
  },
  {
    n: "04",
    icon: <IconPeople />,
    title: "People & HR",
    body: "From offer letter to payslip, with the right forms attached.",
    items: [
      "Bundled onboarding",
      "Offers and contracts",
      "Payslips & deductions",
      "Departments & reporting lines",
    ],
  },
  {
    n: "05",
    icon: <IconLayers />,
    title: "Multi-tenant platform",
    body: "An isolated workspace per organization, one console to run them.",
    items: [
      "Isolated tenant data",
      "Platform console",
      "SSO & role-based access",
      "Per-tenant branding",
    ],
  },
  {
    n: "06",
    icon: <IconBroadcast />,
    title: "Marketing",
    body: "Campaigns that close the loop back into the pipeline.",
    items: [
      "Email & WhatsApp broadcasts",
      "Embedded capture forms",
      "Campaign attribution",
      "Audience segmentation",
    ],
  },
];

const CHAIN = [
  {
    k: "01",
    t: "Lead",
    d: "Arrives from WhatsApp, Meta or a form. Scored and routed.",
  },
  {
    k: "02",
    t: "Deal",
    d: "Stages, documents and the rep who owns the outcome.",
  },
  {
    k: "03",
    t: "Unit",
    d: "Allocated and locked the moment the deal reaches contract.",
  },
  {
    k: "04",
    t: "Plan",
    d: "Milestones generated from the contract, not retyped.",
  },
  {
    k: "05",
    t: "Ledger",
    d: "Receivables age, payments match, the audit trail writes itself.",
  },
  {
    k: "06",
    t: "Payslip",
    d: "Commission accrues off the same number sales closed on.",
  },
];

const SECURITY = [
  {
    icon: <IconLayers />,
    t: "Tenant isolation",
    d: "Each organization gets its own workspace and its own data boundary — enforced at the query layer, not the UI.",
  },
  {
    icon: <IconKey />,
    t: "SSO & granular roles",
    d: "Sign-in through your identity provider, with permissions scoped per module, per project, per desk.",
  },
  {
    icon: <IconHistory />,
    t: "Immutable audit trail",
    d: "Who changed what, when, and what it was before. Exportable for any auditor who asks.",
  },
  {
    icon: <IconGlobe />,
    t: "Regional data residency",
    d: "Run in the region your regulator expects. Lagos, London, New York or your own cloud.",
  },
];

/** Shared with FAQPage JSON-LD so the rich result always matches the page. */
const FAQ = FAQ_CONTENT;

const FOOTER = [
  {
    h: "Product",
    links: [
      ["Platform", "#platform"],
      ["Modules", "#modules"],
      ["How it works", "#ledger"],
      ["Pricing", "#cta"],
    ],
  },
  {
    h: "Company",
    links: [
      ["About", "/about"],
      ["Customers", "#customers"],
      ["Careers", "/careers"],
      ["Contact", `mailto:${SITE.email}`],
    ],
  },
  {
    h: "Legal",
    links: [
      ["Privacy", "/privacy"],
      ["Terms", "/terms"],
      ["Security", "/security"],
      ["DPA", "/dpa"],
    ],
  },
] as const;

/* ═══════════════════════════════════════════════════════════════
   Page
   ═══════════════════════════════════════════════════════════════ */

export function LandingV2() {
  return (
    <div className={`rc ${fontVariables}`}>
      <LandingJsonLd />
      {/* Entrance animations start at opacity 0. Without JS they must not stay
          there — for readers, and for crawlers that skip JavaScript.
          React serialises <noscript> children to a string on the server but
          hydrates them as elements on the client, which mismatches. Passing the
          markup directly keeps both sides identical. */}
      <noscript
        dangerouslySetInnerHTML={{
          __html: `<style>.rc [style*="opacity:0"]{opacity:1!important;transform:none!important}</style>`,
        }}
      />
      <Nav />
      <main>
        <Hero />
        <LogoStrip />
        <Shift />
        <Roles />
        <Modules />
        <LedgerChain />
        <Proof />
        <Security />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}

/* ── Nav ─────────────────────────────────────────────────────── */
function Nav() {
  const [stuck, setStuck] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header className={["nav", stuck ? "stuck" : ""].filter(Boolean).join(" ")}>
      <div className="wrap nav-in">
        <Link href="/" aria-label="Realcorp — home">
          <Wordmark />
        </Link>

        <nav className="nav-mid" aria-label="Primary">
          {NAV.map((item) => (
            <a key={item.href} href={item.href}>
              {item.label}
            </a>
          ))}
        </nav>

        <div className="nav-end">
          <Link className="nav-signin" href="/login">
            Sign in
          </Link>
          <a className="btn btn-primary btn-sm" href="#cta">
            Book a demo <IconChev className="chev" />
          </a>
          <button
            type="button"
            className="nav-burger"
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <IconClose /> : <IconMenu />}
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            className="nav-sheet"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.32, ease: EASE }}
          >
            <div className="wrap nav-sheet-in">
              {NAV.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </a>
              ))}
              <Link href="/login" onClick={() => setOpen(false)}>
                Sign in
              </Link>
              <a
                className="btn btn-primary"
                href="#cta"
                onClick={() => setOpen(false)}
              >
                Book a demo <IconChev className="chev" />
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

/* ── Hero ────────────────────────────────────────────────────── */
function Hero() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const raw = useTransform(scrollYProgress, [0, 1], [0, -70]);
  const lift = useSpring(raw, { stiffness: 90, damping: 26, mass: 0.5 });

  return (
    <section className="hero" id="platform">
      <HeroBackdrop />
      <div className="wrap-wide">
        <motion.div
          className="hero-in"
          initial={false}
          animate="show"
          variants={{
            hidden: {},
            show: {
              transition: { staggerChildren: 0.09, delayChildren: 0.05 },
            },
          }}
        >
          <motion.a className="pill" href="#modules" variants={rise}>
            <b>New</b> Shortlets, channel manager & night audit
            <IconChev size={13} />
          </motion.a>

          <motion.h1 className="h1" variants={rise}>
            {/* nbsp keeps the italic phrase from breaking across two lines */}
            Everything a <span className="em">real&nbsp;corporation</span> runs
            on.
          </motion.h1>

          <motion.p className="lede" variants={rise}>
            Sales, inventory, finance and people on one ledger — not four
            systems pretending to talk. A contract signed this morning is a
            locked unit, a payment schedule and a commission accrual before
            lunch. Property-first, built for companies that build real things.
          </motion.p>

          <motion.div className="hero-cta" variants={rise}>
            <a className="btn btn-primary" href="#cta">
              Book a demo <IconChev className="chev" />
            </a>
            <a className="btn btn-ghost" href="#ledger">
              See how it works
            </a>
          </motion.div>

          <motion.div className="hero-note" variants={rise}>
            <span>
              <i />
              Live in under a week
            </span>
            <span>
              <i />
              Your data, not a sandbox
            </span>
            <span>
              <i />
              SSO on day one
            </span>
          </motion.div>
        </motion.div>

        <div ref={ref}>
          <motion.div
            className="shot"
            style={reduce ? undefined : { y: lift }}
            initial={{ opacity: 0, y: 40, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 1, ease: EASE, delay: 0.35 }}
          >
            <div className="shot-chrome">
              <i />
              <i />
              <i />
              <span>realcorp · command center</span>
            </div>
            <div className="shot-inner">
              <Image
                src="/screenshots/sc-1.png"
                alt="Realcorp command centre: lead and deal counters, collections against target, pipeline against target, pending finance approvals and a live inventory snapshot on one dashboard"
                width={3022}
                height={1480}
                sizes="(max-width: 760px) 94vw, 1200px"
                quality={78}
                priority
              />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

/* ── Logo strip ──────────────────────────────────────────────── */
function LogoStrip() {
  return (
    <section className="strip" id="customers">
      <div className="wrap strip-in">
        <div className="strip-label">
          Trusted by real corporations — property-first, built to scale
        </div>
        {CUSTOMERS.map((name, i) => (
          <Reveal key={name} delay={i} className="strip-logo">
            <CustomerGlyph index={i} />
            {name}
          </Reveal>
        ))}
      </div>
    </section>
  );
}

/** Neutral placeholder glyphs for customer names — swap for real client logos. */
function CustomerGlyph({ index }: { index: number }) {
  const shapes = [
    <path key="0" d="M4 14 10 3l6 11H4Z" />,
    <rect key="1" x="4" y="4" width="10" height="10" rx="2" />,
    <path key="2" d="M9 3l6 6-6 6-6-6 6-6Z" />,
    <path
      key="3"
      d="M9 3a6 6 0 1 0 0 12A6 6 0 0 0 9 3Zm0 3.5A2.5 2.5 0 1 1 9 11.5a2.5 2.5 0 0 1 0-5Z"
    />,
    <path key="4" d="M3 15V6l6-3 6 3v9H3Z" />,
  ];
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="currentColor"
      aria-hidden="true"
    >
      {shapes[index % shapes.length]}
    </svg>
  );
}

/* ── Before / after ──────────────────────────────────────────── */
function Shift() {
  return (
    <section className="sec">
      <div className="wrap">
        <Reveal className="head center">
          <div className="eyebrow">The shift</div>
          <h2 className="h2">
            Stop reconciling. Start <span className="em">closing.</span>
          </h2>
          <p className="lede">
            The problem was never that your team lacked software. It is that
            eleven tools each hold a different version of the same number, and
            not one of them holds the corporation.
          </p>
        </Reveal>

        <div className="shift">
          <Reveal className="shift-col before">
            <h3 className="h4">Today</h3>
            <ul>
              {BEFORE.map((item) => (
                <li key={item}>
                  <IconMinus />
                  {item}
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={1} className="shift-arrow">
            <IconArrowRight />
          </Reveal>

          <Reveal delay={2} className="shift-col after">
            <h3 className="h4">On Realcorp</h3>
            <ul>
              {AFTER.map((item) => (
                <li key={item}>
                  <IconCheck />
                  {item}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ── Role tabs ───────────────────────────────────────────────── */
function Roles() {
  const [active, setActive] = useState(ROLES[0].id);
  const role = ROLES.find((r) => r.id === active) ?? ROLES[0];

  return (
    <section className="sec" style={{ paddingTop: 0 }}>
      <div className="wrap">
        <Reveal className="head-split">
          <div>
            <div className="eyebrow">Built for every desk</div>
            <h2 className="h2" style={{ marginTop: 16 }}>
              Four teams. <span className="em">One record.</span>
            </h2>
          </div>
          <p className="body">
            Sales does not wait on finance. Finance does not chase sales.
            Operations and HR read the same unit, the same contract and the same
            number — because there is only one of each.
          </p>
        </Reveal>

        <div className="tabs" role="tablist" aria-label="Teams">
          {ROLES.map((r) => (
            <button
              key={r.id}
              type="button"
              role="tab"
              aria-selected={active === r.id}
              data-on={active === r.id}
              className="tab"
              onClick={() => setActive(r.id)}
            >
              <span>{r.label}</span>
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={role.id}
            className="tab-panel"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: EASE }}
          >
            <div>
              <h3 className="h3">{role.headline}</h3>
              <p className="body" style={{ marginTop: 12 }}>
                {role.blurb}
              </p>
              <ul>
                {role.points.map((p) => (
                  <li key={p}>
                    <IconCheck />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
            <div className="tab-shot">
              <Image
                src={role.shot}
                alt={`Realcorp ${role.label.toLowerCase()} workspace — ${role.headline.replace(/\.$/, "")}`}
                width={3024}
                height={1530}
                sizes="(max-width: 900px) 94vw, 52vw"
                quality={76}
              />
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}

/* ── Modules ─────────────────────────────────────────────────── */
function Modules() {
  return (
    <section className="sec" id="modules" style={{ paddingTop: 0 }}>
      <div className="wrap">
        <Reveal className="head-split">
          <div>
            <div className="eyebrow">§ Modules</div>
            <h2 className="h2" style={{ marginTop: 16 }}>
              Six modules. <span className="em">One ledger.</span>
            </h2>
          </div>
          <p className="body">
            Every module reads from and writes to the same record. The pipeline
            closes a deal; the payment plan posts to receivables; the audit
            trail keeps everyone honest. No exports, no reconciliation theatre.
          </p>
        </Reveal>

        <div className="mods">
          {MODULES.map((m, i) => (
            <Reveal key={m.title} delay={i % 3} className="mod">
              <div className="mod-top">
                <span className="mod-ico">{m.icon}</span>
                <span className="mod-n">{m.n}</span>
              </div>
              <h3 className="h4">{m.title}</h3>
              <p className="body" style={{ fontSize: 14.5 }}>
                {m.body}
              </p>
              <ul>
                {m.items.map((it) => (
                  <li key={it}>{it}</li>
                ))}
              </ul>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── The ledger chain ────────────────────────────────────────── */
function LedgerChain() {
  const reduce = useReducedMotion();
  return (
    <section className="sec" id="ledger" style={{ paddingTop: 0 }}>
      <div className="wrap">
        <Reveal className="head center">
          <div className="eyebrow">How it works</div>
          <h2 className="h2">
            A lead becomes a payslip{" "}
            <span className="em">without retyping.</span>
          </h2>
          <p className="lede">
            This is the whole product in one line. Each step inherits the last
            one&apos;s numbers, so nobody re-enters anything and nobody argues
            about which figure is real.
          </p>
        </Reveal>

        <div className="chain-rail">
          {!reduce && (
            <motion.div
              className="chain-pulse"
              initial={{ x: "-30%" }}
              whileInView={{ x: "130%" }}
              viewport={{ once: false, margin: "-25%" }}
              transition={{
                duration: 2.6,
                ease: "easeInOut",
                repeat: Infinity,
                repeatDelay: 0.8,
              }}
            />
          )}
        </div>

        <div className="chain">
          {CHAIN.map((node, i) => (
            <Reveal key={node.t} delay={i} className="chain-node">
              <span className="k">{node.k}</span>
              <span className="t">{node.t}</span>
              <span className="d">{node.d}</span>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Proof ───────────────────────────────────────────────────── */
function Proof() {
  return (
    <section className="sec proof">
      <div className="wrap proof-in">
        <Reveal>
          <div className="eyebrow" style={{ color: "rgba(247,246,243,.5)" }}>
            A note from operations
          </div>
          <blockquote style={{ marginTop: 24 }}>
            &ldquo;From contract to payslip, the{" "}
            <span className="em">same number</span> reaches every desk.
            Month-end went from four days to one afternoon.&rdquo;
          </blockquote>
          <cite>Hannah Reyes · SVP Operations · Kingsway Estates</cite>
        </Reveal>

        <Reveal delay={1} className="stats">
          <div className="stat">
            <div className="v">
              <Counter to={38} suffix=" hrs" />
            </div>
            <div className="k">Saved every week</div>
          </div>
          <div className="stat">
            <div className="v">
              <Counter to={2.1} prefix="$" suffix="B" decimals={1} />
            </div>
            <div className="k">Gross volume tracked</div>
          </div>
          <div className="stat">
            <div className="v">
              <Counter to={99.4} suffix="%" decimals={1} />
            </div>
            <div className="k">Audit-trail coverage</div>
          </div>
          <div className="stat">
            <div className="v">
              <Counter to={40} suffix="+" />
            </div>
            <div className="k">Organizations live</div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ── Security ────────────────────────────────────────────────── */
function Security() {
  return (
    <section className="sec">
      <div className="wrap">
        <Reveal className="head">
          <div className="eyebrow">Platform</div>
          <h2 className="h2">
            Built to survive an <span className="em">audit.</span>
          </h2>
          <p className="lede">
            The reason finance teams trust a single ledger is that it can be
            proven. Realcorp is built so every number has a provenance.
          </p>
        </Reveal>

        <div className="sec-grid">
          {SECURITY.map((s, i) => (
            <Reveal key={s.t} delay={i} className="sec-card">
              {s.icon}
              <h3 className="h4">{s.t}</h3>
              <p className="small">{s.d}</p>
            </Reveal>
          ))}
        </div>

        <Reveal delay={2}>
          <p
            className="small"
            style={{
              marginTop: 32,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <IconShield size={16} />
            Encryption in transit and at rest · role-scoped access · full export
            on request.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/* ── FAQ ─────────────────────────────────────────────────────── */
function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className="sec" id="faq" style={{ paddingTop: 0 }}>
      <div className="wrap">
        <Reveal className="head center">
          <div className="eyebrow">Questions</div>
          <h2 className="h2">The ones people actually ask.</h2>
        </Reveal>

        <div className="faq">
          {FAQ.map((item, i) => {
            const isOpen = open === i;
            return (
              <div className="faq-item" key={item.q} data-open={isOpen}>
                <h3 className="faq-h">
                  <button
                    type="button"
                    className="faq-q"
                    aria-expanded={isOpen}
                    onClick={() => setOpen(isOpen ? null : i)}
                  >
                    {item.q}
                    <IconPlus className="faq-ico" />
                  </button>
                </h3>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      className="faq-a"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: EASE }}
                    >
                      <p className="body">{item.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ── Final CTA ───────────────────────────────────────────────── */
function FinalCta() {
  return (
    <section className="sec" id="cta" style={{ paddingTop: 0 }}>
      <div className="wrap">
        <Reveal className="cta">
          <div className="eyebrow" style={{ color: "rgba(247,246,243,.55)" }}>
            Let&apos;s talk
          </div>
          <h2 className="h2" style={{ maxWidth: "20ch" }}>
            See Realcorp running <span className="em">your projects.</span>
          </h2>
          <p className="lede">
            Thirty minutes with a solutions engineer, in a workspace pre-loaded
            with your project list. So the demo is about your business, not a
            fictional one.
          </p>
          <div className="hero-cta">
            <a className="btn btn-primary" href={`mailto:${SITE.email}`}>
              Book a demo <IconChev className="chev" />
            </a>
            <Link className="btn btn-ghost" href="/login">
              Sign in to your workspace
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ── Footer ──────────────────────────────────────────────────── */
function Footer() {
  return (
    <footer>
      <div className="wrap">
        <div className="foot-grid">
          <div>
            <Wordmark size={28} />
            <p className="small" style={{ marginTop: 14, maxWidth: "34ch" }}>
              Everything a real corporation runs on. Offices in Lagos, New York
              and Dubai.
            </p>
          </div>
          {FOOTER.map((col) => (
            <div className="foot-col" key={col.h}>
              <h5>{col.h}</h5>
              <ul>
                {col.links.map(([label, href]) => (
                  <li key={label}>
                    {href.startsWith("/") ? (
                      <Link href={href}>{label}</Link>
                    ) : (
                      <a href={href}>{label}</a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="foot-bottom">
          {/* Server and client can straddle midnight on New Year's Eve. */}
          <span suppressHydrationWarning>
            © {new Date().getFullYear()} Realcorp, Inc.
          </span>
          <span>Lagos · New York · Dubai</span>
        </div>
      </div>
    </footer>
  );
}
