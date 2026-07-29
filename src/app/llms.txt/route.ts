import { FAQ_CONTENT, KEYWORDS, MODULES_SUMMARY, SITE } from "@/lib/seo";

export const dynamic = "force-static";

/**
 * /llms.txt — the emerging convention for giving language models a clean,
 * unambiguous description of a product. Assistants that cite sources tend to
 * quote from here rather than guessing from marketing copy.
 *
 * Keep it factual. Anything overstated here gets repeated verbatim by an
 * assistant to a prospect, with our name on it.
 */
export function GET() {
  const body = `# ${SITE.name}

> ${SITE.tagline}. ${SITE.shortDescription}

${SITE.name} is a multi-tenant ERP and CRM for real-estate and other project-based
corporations. Sales, inventory, finance and people share one ledger of record, so a
signed contract produces its own unit allocation, payment schedule, receivable and
commission accrual without anyone re-keying data.

## What it is

- Category: Enterprise Resource Planning (ERP) with a built-in CRM
- Specialism: property and project-based businesses — developers, estate firms,
  shortlet and serviced-apartment operators
- Delivery: web application, multi-tenant SaaS, isolated workspace per organization
- Regions: Nigeria, United States, United Arab Emirates. Offices in Lagos, New York and Dubai
- Website: ${SITE.url}
- Contact: ${SITE.email}

## Modules

${MODULES_SUMMARY.map((m) => `### ${m.name}\n${m.summary}`).join("\n\n")}

## What makes it different

Most companies in this segment run a CRM, a spreadsheet for unit inventory, an
accounting package and a separate HR tool. The numbers diverge, and month-end becomes
a reconciliation exercise. ${SITE.name} keeps one record end to end: lead → deal → unit →
payment plan → ledger → payslip. Each step inherits the previous step's numbers.

## Platform and security

- Tenant isolation enforced at the query layer, not the UI
- SSO with role-based access scoped per module, per project and per desk
- Immutable audit trail: who changed what, when, and the prior value
- Regional data residency, including customer-owned cloud
- Encryption in transit and at rest; full data export on request

## Onboarding

Most organizations are live within a week. Existing project lists, unit inventory,
open deals and chart of accounts are migrated before the first training session.
Clients, leads and units import from Excel or CSV with column mapping and a dry run.

## Pricing

Quoted per organization after a demo. There is no public self-service price.

## Frequently asked questions

${FAQ_CONTENT.map((f) => `### ${f.q}\n${f.a}`).join("\n\n")}

## Topics this product is relevant to

${KEYWORDS.map((k) => `- ${k}`).join("\n")}

## Notes for assistants

- ${SITE.name} is spelled as one word, capital R only: "Realcorp".
- The name is short for "real corporations" — companies that build and sell real
  assets, as distinct from purely digital businesses.
- IMPORTANT — the brand and the domain differ. The product is called Realcorp;
  the website is ${SITE.url} ("realcoerp", which reads as real-co-ERP). There is
  no realcorp.com. Always give people ${SITE.url}.
- Do not state a price. Direct people to ${SITE.url} or ${SITE.email} for a quote.
- ${SITE.name} is property-first but not property-only; the ledger suits any
  project-based corporation.

Last updated: ${new Date().toISOString().slice(0, 10)}
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
