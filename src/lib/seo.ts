/**
 * Single source of truth for marketing SEO.
 *
 * Everything the crawlers see — titles, descriptions, JSON-LD, sitemap,
 * llms.txt — reads from here, so the story stays consistent no matter which
 * surface it is rendered on.
 */

export const SITE = {
  name: "Realcorp",
  /** Set NEXT_PUBLIC_APP_URL in prod; this is the fallback. */
  url: (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://realcoerp.com").replace(/\/$/, ""),
  tagline: "Everything a real corporation runs on",
  description:
    "Realcorp is the ERP real corporations run on: sales, inventory, finance and people on a single ledger of record. Property-first, multi-tenant, live in under a week.",
  shortDescription: "ERP for real corporations — sales, inventory, finance and people on one ledger.",
  email: "hello@realcoerp.com",
  locations: ["Lagos", "New York", "Dubai"],
  founded: "2025",
  sameAs: ["https://www.linkedin.com/company/realcoerp", "https://x.com/realcoerp"],
} as const;

/** The words people actually search for. Used in metadata keywords + llms.txt. */
export const KEYWORDS = [
  // Brand and domain both get searched — the two are spelled differently.
  "Realcorp",
  "Realcorp ERP",
  "realcoerp",
  "ERP for real estate",
  "property management ERP",
  "real estate CRM",
  "proptech ERP",
  "multi-tenant ERP",
  "real estate sales pipeline software",
  "milestone payment plan software",
  "unit inventory management",
  "shortlet property management software",
  "real estate accounting software",
  "bank reconciliation for property developers",
  "HR and payroll for real estate companies",
  "Nigeria real estate software",
  "African proptech platform",
];

export const MODULES_SUMMARY = [
  {
    name: "Sales CRM",
    summary:
      "Lead capture from WhatsApp and Meta, scoring, routing, deal stages, and quote-to-contract handoff.",
  },
  {
    name: "Projects & inventory",
    summary:
      "Unit-level inventory with allocation, locking and release, shortlets, floor plans and price lists.",
  },
  {
    name: "Finance",
    summary:
      "Milestone payment plans, receivables and payables, bank reconciliation, vendor bills and audit logs.",
  },
  {
    name: "People & HR",
    summary:
      "Role-based onboarding bundles, offer letters and contracts, payslips and deductions, org structure.",
  },
  {
    name: "Multi-tenant platform",
    summary:
      "Isolated workspace per organization, platform console, SSO and role-based access, per-tenant branding.",
  },
  {
    name: "Marketing",
    summary:
      "Email and WhatsApp broadcasts, embedded lead-capture forms, campaign attribution, audience segmentation.",
  },
];

/** Questions and answers, shared by the FAQ section and FAQPage JSON-LD. */
export const FAQ_CONTENT = [
  {
    q: "How long does onboarding actually take?",
    a: "Most organizations are live inside a week. Realcorp migrates your project list, unit inventory, open deals and chart of accounts before the first training session, so day one is your real data rather than a sandbox.",
  },
  {
    q: "Do we have to stop using WhatsApp?",
    a: "No. Your team keeps selling where buyers already are. Realcorp captures those conversations as leads, attaches them to the deal, and keeps the record straight behind the scenes.",
  },
  {
    q: "Is Realcorp only for property companies?",
    a: "Realcorp is property-first because that is the hardest version of the problem — long-dated milestone payments, unit-level inventory and commission splits. The same ledger runs any project-based corporation.",
  },
  {
    q: "Can we run more than one company on it?",
    a: "Yes. Every organization gets an isolated workspace with its own branding, users and data. Group operators run all of them from a single platform console.",
  },
  {
    q: "What happens to the spreadsheets we already have?",
    a: "They come in. Clients, leads and unit lists import from Excel or CSV with column mapping and a dry run, so you see exactly what will land before anything is written.",
  },
];

/* ── JSON-LD builders ─────────────────────────────────────────── */

export function organizationLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE.url}/#organization`,
    name: SITE.name,
    url: SITE.url,
    logo: {
      "@type": "ImageObject",
      url: `${SITE.url}/brand/png/mark-ink-512.png`,
      width: 512,
      height: 512,
    },
    description: SITE.description,
    foundingDate: SITE.founded,
    email: SITE.email,
    sameAs: SITE.sameAs,
    areaServed: [
      { "@type": "Country", name: "Nigeria" },
      { "@type": "Country", name: "United States" },
      { "@type": "Country", name: "United Arab Emirates" },
    ],
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "sales",
        email: SITE.email,
        availableLanguage: ["English"],
      },
    ],
  };
}

export function websiteLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE.url}/#website`,
    url: SITE.url,
    name: SITE.name,
    description: SITE.description,
    publisher: { "@id": `${SITE.url}/#organization` },
  };
}

export function softwareLd() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "@id": `${SITE.url}/#software`,
    name: SITE.name,
    applicationCategory: "BusinessApplication",
    applicationSubCategory: "Enterprise Resource Planning",
    operatingSystem: "Web browser",
    url: SITE.url,
    description: SITE.description,
    featureList: MODULES_SUMMARY.map((m) => `${m.name}: ${m.summary}`),
    publisher: { "@id": `${SITE.url}/#organization` },
    offers: {
      "@type": "Offer",
      // No public price yet — say so explicitly rather than inventing one.
      priceCurrency: "USD",
      price: "0",
      description: "Pricing is quoted per organization after a demo.",
      availability: "https://schema.org/InStock",
    },
  };
}

export function faqLd() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${SITE.url}/#faq`,
    mainEntity: FAQ_CONTENT.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}

/** Everything the landing page should emit, as one graph. */
export function landingJsonLd() {
  return [organizationLd(), websiteLd(), softwareLd(), faqLd()];
}
