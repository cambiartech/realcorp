# Future Caribbean 2026 — Application Draft

**Project:** Realcorp  
**Track:** [AI for Real Estate & Development](https://futurecaribbean.com/tracks/real-estate)  
**Judging rubric:** [futurecaribbean.com/judging-rubric](https://futurecaribbean.com/judging-rubric)  
**Product:** [realcoerp.com](https://realcoerp.com)  
**Live deployment:** Bo Properties Nigeria (team onboarding in progress)

---

## Tagline

**The agentic operating system for property markets — from WhatsApp inquiry to investor closing, on one ledger.**

---

## Problem

Real estate is a coordination industry — but most of it still runs on WhatsApp, spreadsheets, and disconnected tools.

For developers and agencies selling across borders, the pain is worse. A diaspora buyer in London, Toronto, or New York discovers a project on Instagram, messages on WhatsApp, and enters a black hole: no structured qualification, no live inventory, no document trail, no payment milestones, no investor visibility. Meanwhile, the developer's sales team, finance desk, operations staff, and existing investors all work from different systems.

**Bo Properties** — our first live client — faces exactly this. They sell development units and short-let assets to buyers and investors across Nigeria and the global diaspora. Leads arrive on WhatsApp and social ads. Finance tracks milestone payments manually. Investors expect portfolio updates, documents, and transparency — but staff spend hours on follow-ups instead of closing.

The Caribbean faces the same structural challenge at regional scale: multiple countries, currencies, legal systems, and diaspora capital flows — with tourism, short-stays, and cross-border property investment all running through informal channels.

**Real estate doesn't need another listing site. It needs executable coordination infrastructure.**

---

## Solution

**Realcorp** is a multi-tenant property operating system that connects sales, inventory, finance, operations, and investor relations on a single ledger of record.

We are now building the **agentic layer** on top of that foundation: autonomous workflows that turn WhatsApp conversations into structured transactions — without forcing teams to leave how they already work.

### What exists today (production)

- **Sales CRM** — leads, deals pipeline, activities, Meta lead capture
- **Projects & unit inventory** — allocation, locking, status tied to deals
- **WhatsApp CRM + Bot** — two-way inbox, listings bot, viewing booking handoff
- **Finance** — milestone receivables, invoices, receipts, branded exports, audit trail
- **Investor portal** — portfolio, linked units/shortlets, shared documents
- **Short-let PMS** — front desk, reservations, inspections, guest bill
- **Public listings API** — embeddable Explore pages for ads and websites
- **Multi-tenant platform** — isolated workspaces per organization

### What we will ship during the 21-day build sprint

**Realcorp Agent Stack** — three coordinated agents on one property ledger:

1. **Sales Agent (WhatsApp-native)** — qualifies inbound leads, sends dynamic listings, books viewings, creates/updates CRM records, and escalates hot buyers to human closers.
2. **Transaction Agent** — when a deal advances, orchestrates document requests, milestone invoicing, payment reminders, and stakeholder notifications across finance and client records.
3. **Investor Agent** — keeps diaspora investors informed: portfolio updates, shared documents, payment status, and project milestones — via portal and optional WhatsApp/email nudges.

Human-in-the-loop at every commitment point (pricing, contract, payment confirmation). Full audit trail on the Realcorp ledger.

---

## Why Bo Properties proves this works

Bo Properties Nigeria is our first production client. We are actively onboarding their team onto Realcorp across:

- Sales pipeline and project inventory
- Finance and receivables
- Client and investor records
- Short-let operations
- Investor portal for stakeholders

Their investor base spans **Nigeria and the global diaspora** — buyers and stakeholders who cannot walk into a sales office but expect transparency, documents, and payment visibility from abroad.

Bo Properties is our **design partner and deployment environment** for the agentic layer: real units, real investors, real WhatsApp volume — not a synthetic demo.

This is the same coordination pattern Future Caribbean targets: **fragmented markets, diaspora capital, digital-first sales, and operations that must scale without adding headcount.**

---

## Why Caribbean / global relevance

The Caribbean is one of the world's most coordination-intensive property environments: tourism flows, short-stay inventory, diaspora investment, multi-jurisdiction transactions, and WhatsApp as the default sales channel.

Realcorp is built for exactly that kind of fragmentation:

| Challenge | Realcorp response |
|---|---|
| Sales on WhatsApp | Native WhatsApp CRM + agent |
| Cross-border investors | Investor portal + document sharing + milestone finance |
| Tourism / short-stays | Short-let PMS module |
| Multiple orgs / markets | Multi-tenant isolated workspaces |
| Trust & compliance | Unified audit trail across sales → finance → documents |

**Thesis:** If Realcorp can coordinate diaspora-backed property sales for Bo Properties in Nigeria, the same agent stack deploys to Caribbean developers, agencies, and hospitality operators — and scales globally.

---

## Agentic AI architecture

**Category:** Using It — Agentic AI applied to real estate coordination

```
WhatsApp / Web / Portal
        ↓
   Agent Orchestrator
   ├── Sales Agent       → CRM, listings, qualification, booking
   ├── Transaction Agent → deals, documents, invoices, milestones
   └── Investor Agent    → portal, portfolio, notifications
        ↓
   Realcorp Ledger (single source of truth)
   Projects · Units · Deals · Finance · Clients · Documents · Shortlets
```

**Design principles (aligned with judging rubric):**

- **Semi-autonomous agents** with explicit human approval gates
- **Multi-agent coordination** across sales, finance, and investor workflows
- **Workflow orchestration** on existing production data models — not a chatbot bolted onto spreadsheets
- **Efficient compute** — structured tool calls to Realcorp APIs; LLM for intent, qualification, and natural language
- **Real-world impact** — measured in lead response time, deal velocity, investor document delivery, and staff hours saved at Bo Properties

---

## 21-day sprint deliverables

| Week | Deliverable |
|---|---|
| **Week 1** | Sales Agent live on Bo Properties WhatsApp — qualify, list, book, sync CRM |
| **Week 2** | Transaction Agent — deal stage triggers → document checklist + milestone invoice draft |
| **Week 3** | Investor Agent — portal notifications + diaspora investor update flows; recorded demo |

### Demo script (3 minutes)

1. Diaspora prospect messages Bo Properties on WhatsApp → Sales Agent responds with live listings
2. Prospect books viewing → lead created in CRM, task assigned to sales exec
3. Deal moves to reservation → Transaction Agent requests documents, drafts milestone invoice
4. Investor logs into portal → sees linked unit, documents, payment status
5. Investor Agent sends milestone update notification

---

## Business model

- **SaaS per organization** — module-based pricing (Sales, Finance, Short-lets, Investor Portal, WhatsApp Agent)
- **Implementation & onboarding** — for developers and agencies migrating from spreadsheets
- **Agent usage tier** — per-conversation or per-org agent compute allowance

**Initial GTM:** Property developers and agencies in Nigeria, West Africa, and Caribbean markets where WhatsApp is the primary sales channel and diaspora investment is material.

---

## Traction

- **First live client:** Bo Properties Nigeria — team onboarding in progress
- **Product:** Multi-module ERP live at [realcoerp.com](https://realcoerp.com)
- **Modules in production:** CRM, finance, projects/units, WhatsApp, listings, investor portal, short-let PMS, HR
- **Deployment model:** Multi-tenant — each developer/agency gets an isolated workspace

> **TODO before submit:** Add founder names, team size, Bo Properties project/unit counts, investor geography, WhatsApp volume, and any revenue or GMV metrics.

---

## Team

> **TODO before submit:** Fill in names, roles, and LinkedIn profiles.

| Role | Focus |
|---|---|
| **Founder / CEO** | Product vision, GTM, Bo Properties relationship |
| **Technical lead** | Agent architecture, Realcorp platform, integrations |
| **Full-stack engineer** | WhatsApp agent, CRM/deal orchestration |
| **Domain advisor** | Bo Properties operations — sales, finance, investor relations |

**Why we can execute in 21 days:** The hard part — unified property ledger, CRM, finance, investor portal, WhatsApp integration — is already built. The sprint focuses on the agentic coordination layer, with a live client providing real data and feedback.

---

## Judging rubric self-map

| Criterion | Our evidence |
|---|---|
| **Team quality** | Live product + first client onboarding; domain + engineering depth |
| **Product innovation & defensibility** | Unified ledger across sales/finance/ops/investors; WhatsApp-native agent OS; multi-tenant; hard to replicate without deep property workflow integration |
| **Product-market fit** | Bo Properties validates diaspora investor + developer coordination pain; WhatsApp-first markets (Nigeria, Caribbean, emerging markets globally) |
| **Agentic AI excellence** | Multi-agent orchestration on production ledger; human-in-the-loop; measurable workflow automation — sprint deliverable |

---

## Short answers (form fields)

**What are you building?**  
An agentic property operating system — WhatsApp sales agent, transaction orchestration, and investor coordination — on Realcorp's unified real-estate ledger.

**Who is it for?**  
Property developers, agencies, and operators with diaspora investors and WhatsApp-driven sales — starting with Bo Properties Nigeria.

**What will you demo?**  
End-to-end: WhatsApp inquiry → qualified lead → listing/viewing → deal → milestone finance → investor portal update.

**Why Future Caribbean?**  
Same coordination problem as Caribbean property markets — diaspora capital, tourism/short-stays, fragmented jurisdictions — with a live deployment proving the model today.

**What's your unfair advantage?**  
Production ERP already live; first client onboarding now; agent layer ships on real data, not a hackathon prototype.

---

## Closing

Realcorp is not a concept. It is a live property operating system, now onboarding Bo Properties Nigeria — a developer serving investors across Nigeria and the global diaspora. During Future Caribbean, we will turn that platform into **agentic coordination infrastructure**: the layer that makes property markets executable at scale, starting where deals actually happen — on WhatsApp — and ending where trust is earned — transparent investor closing on one ledger.

---

## Track alignment reference

See also:
- [futureCarribean.md](./futureCarribean.md) — track pillar mapping (A–G)
- [future-caribbean-workflow.md](./future-caribbean-workflow.md) — workflow diagram for application upload
- **Upload files:** `future-caribbean-workflow.png` or `future-caribbean-workflow.svg`
