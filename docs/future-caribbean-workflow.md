# Realcorp Agent Workflow Diagram

**For:** Future Caribbean 2026 application — workflow diagram upload  
**Paste link option:** Render this Mermaid at [mermaid.live](https://mermaid.live) and share the link, or export PNG/SVG from there.

---

## How to submit

1. Open [mermaid.live](https://mermaid.live)
2. Paste the contents of [`future-caribbean-workflow.mmd`](./future-caribbean-workflow.mmd)
3. Click **Actions → Export PNG** or **Export SVG**
4. Upload the file (max 10 MB), **or** copy the shareable link from mermaid.live

---

## Diagram (Mermaid)

```mermaid
flowchart TB
  subgraph INPUTS["📥 Inputs"]
    WA["WhatsApp message<br/>(Meta Cloud API webhook)"]
    META["Meta Lead Ads<br/>(webhook)"]
    WEB["Web / Explore listings<br/>(public API + embed)"]
    STAFF["Staff actions<br/>(CRM UI)"]
  end

  subgraph ORCH["🤖 Agent Orchestrator"]
    ROUTE{"Intent router<br/>(LLM + rules)"}
    SALES["Sales Agent<br/>qualify · match · book"]
    TXN["Transaction Agent<br/>docs · milestones · notify"]
    INV["Investor Agent<br/>portfolio · updates"]
  end

  subgraph HITL["👤 Human-in-the-loop"]
    H1{"Hot lead /<br/>complex question?"}
    H2{"Approve pricing /<br/>offer terms?"}
    H3{"Confirm contract /<br/>reservation?"}
    H4{"Approve invoice /<br/>payment post?"}
    SALES_TEAM["Sales executive"]
    FINANCE["Finance manager"]
    LEGAL["Legal / org admin"]
  end

  subgraph DATA["🗄️ Data sources & APIs"]
    PG[("PostgreSQL<br/>Realcorp ledger")]
    LIST["Listings API<br/>loadPublicListings"]
    CRM["CRM module<br/>leads · deals · activities"]
    FIN["Finance module<br/>invoices · receipts · milestones"]
    CLIENT["Clients module<br/>documents · unit links"]
    PORTAL["Investor portal<br/>portfolio · shortlets"]
    WAPI["Meta WhatsApp<br/>Graph API v23"]
    EMAIL["Resend<br/>email API"]
  end

  subgraph OUTPUTS["📤 Outputs"]
    O1["WhatsApp replies<br/>listings · buttons · confirmations"]
    O2["CRM records<br/>lead created/updated · deal stage"]
    O3["Staff tasks<br/>viewing · agent callback"]
    O4["Milestone invoices<br/>& payment reminders"]
    O5["Investor portal<br/>docs · portfolio · status"]
    O6["Email notifications<br/>investors & staff"]
    O7["Audit trail<br/>full workflow log"]
  end

  WA --> ROUTE
  META --> CRM
  WEB --> LIST
  STAFF --> CRM

  ROUTE -->|"buy/rent/listings"| SALES
  ROUTE -->|"deal advanced"| TXN
  ROUTE -->|"investor query"| INV

  SALES --> LIST
  SALES --> CRM
  SALES --> H1
  H1 -->|"yes"| SALES_TEAM
  H1 -->|"no · auto"| WAPI
  SALES --> WAPI

  SALES -->|"book viewing"| O3
  SALES --> O1
  SALES --> O2

  TXN --> CRM
  TXN --> FIN
  TXN --> CLIENT
  TXN --> H2
  H2 -->|"needs approval"| SALES_TEAM
  H2 -->|"approved"| H3
  H3 -->|"needs approval"| LEGAL
  H3 -->|"approved"| H4
  H4 -->|"needs approval"| FINANCE
  H4 -->|"approved"| FIN

  TXN --> O4
  TXN --> O6
  TXN --> INV

  INV --> PORTAL
  INV --> CLIENT
  INV --> WAPI
  INV --> EMAIL
  INV --> O5
  INV --> O6

  LIST --> PG
  CRM --> PG
  FIN --> PG
  CLIENT --> PG
  PORTAL --> PG

  SALES_TEAM --> CRM
  FINANCE --> FIN
  LEGAL --> CRM

  CRM --> O7
  FIN --> O7
  WAPI --> O7
```

---

## Legend

| Section | What it shows |
|---|---|
| **Inputs** | WhatsApp, Meta Lead Ads, public listings, staff CRM actions |
| **Agent orchestration** | Intent router → Sales / Transaction / Investor agents |
| **Human-in-the-loop** | Escalation and approval gates before pricing, contracts, invoices |
| **Data sources & APIs** | PostgreSQL ledger, Realcorp modules, WhatsApp Graph API, Resend |
| **Outputs** | Replies, CRM updates, tasks, finance, portal, email, audit log |
| **Decision points** | Diamond nodes: hot lead?, approve pricing?, confirm contract?, approve invoice? |

---

## End-to-end example (Bo Properties)

1. **Input:** Diaspora prospect WhatsApps “I want a 2-bed in Lagos under ₦50M”
2. **Router:** Sales Agent
3. **Data:** Queries listings API + CRM (existing lead match by phone)
4. **Decision:** Budget fit → auto-send 3 listings; complex financing → escalate to sales exec
5. **Output:** WhatsApp listing cards + lead updated + viewing task if booked
6. **Transaction Agent:** Deal moves to reservation → document checklist → **legal approves** → milestone invoice draft → **finance approves** → send
7. **Investor Agent:** Linked investor gets portal update + optional email/WhatsApp nudge
