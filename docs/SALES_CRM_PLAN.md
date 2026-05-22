# Sales CRM Integration Plan
> Status: Active · Last updated: 2026-04-18  
> Scope: RealCorp tenant sales module — leads, deals, contacts, activities, pipeline, reports, and channel integrations

---

## Current gaps (audit)

| Area | What exists | What's missing |
|------|-------------|----------------|
| **Leads** | List page, create modal, source/campaign/quality filters | No detail page, no edit, no notes/activities, no CSV import |
| **Deals** | Kanban (9 stages), drag-drop, finance flag | No detail page, no edit, no list view, no activities |
| **Activities** | Audit logs only | No human-logged calls, WhatsApp, emails, meetings, tasks |
| **Navigation** | 10 flat items | No Sales group / sub-menu |
| **Campaigns** | Model exists | No UI, no funnel per campaign |
| **Realtor Partners** | Model + portalTokenHash | No management UI, no portal |
| **Reporting** | Dashboard widgets | No dedicated reports page, no funnel, no source ROI |
| **WhatsApp** | Nothing | Biggest gap for Nigerian market |
| **SMS** | Nothing | Termii for Nigeria |
| **Social Lead Ads** | Nothing | Facebook/Instagram/TikTok lead forms |
| **Web Forms** | Nothing | Typeform/Tally webhook ingest |
| **Email (CRM)** | Transactional only (Resend) | No compose-and-send from lead/deal |
| **Lead import** | Nothing | CSV bulk upload |

---

## Integrations landscape

### A — Social media lead ads (highest ROI for Nigerian real estate)

| Platform | How leads come in | Our endpoint |
|----------|------------------|--------------|
| **Facebook Lead Ads** | Meta sends `POST` to your webhook with `leadgen_id`; you fetch full data from Graph API | `/api/integrations/meta-leads/[tenantId]` |
| **Instagram Lead Ads** | Same Meta webhook — Instagram ad forms use identical `leadgen` field on Page object | Same endpoint — Meta routes both |
| **TikTok Lead Generation** | TikTok Custom API with webhooks — real-time `POST` with lead fields on new form submit | `/api/integrations/tiktok-leads/[tenantId]` |
| **LinkedIn Lead Gen Forms** | `POST` webhook via LinkedIn Campaign Manager → Webhooks; B2B use (commercial real estate) | `/api/integrations/linkedin-leads/[tenantId]` |

**Meta setup notes:**
- App needs: `leads_retrieval`, `pages_manage_metadata`, `pages_show_list`, `pages_read_engagement`, `ads_management`
- Webhook verification: respond to GET `hub.challenge`; validate `X-Hub-Signature-256` on every POST
- Lead fetch: `GET /{leadgen_id}?access_token={page_token}` to get name/email/phone/custom fields
- Each tenant registers their own Page access token in Settings → Integrations

---

### B — Web forms (any landing page, any website)

| Tool | Webhook | Notes |
|------|---------|-------|
| **Tally** (recommended) | Native webhook POST | Free, beautiful Notion-style forms; popular in Nigerian market |
| **Typeform** | Native webhook POST | Best for conversational/multi-step qualification forms |
| **JotForm** | Native webhook + HMAC signature | 150+ integrations, conditional logic |
| **Custom HTML form** | Direct POST to our endpoint | Tenants add an embed snippet to their website; we provide a public ingest endpoint |

**Our endpoint:** `/api/integrations/form/[tenantId]` — accepts any JSON POST; maps fields by column name (name, email, phone, message); creates a Lead with `source: WEBSITE_FORM`.

---

### C — Communication channels

#### WhatsApp Business API (Meta Cloud — Phase 3 priority)
- **Why:** WhatsApp is the #1 communication channel for Nigerian real estate
- **Provider:** Meta Cloud API — free tier (~250 msgs/day), tenant brings own verified business number
- **What we build:** Send from lead page, inbound webhook creates/attaches to lead, message thread UI
- **Endpoint:** `/api/webhooks/whatsapp/[tenantId]`
- **Config:** Per-tenant `TenantWhatsAppConfig` (phoneNumberId, accessToken, webhookSecret)

#### SMS via Termii (Nigerian market)
- **Why:** Reaches DND-listed numbers; OTP-grade reliability; HQ Lagos
- **SDK:** `@davidbolaji/termii-node` (TypeScript)
- **Routes:** `dnd` for transactional (lead follow-up), `generic` for bulk campaigns
- **Use cases:** Lead notification SMS ("Thanks for your interest in Palm Heights…"), deal stage alerts, task reminders
- **Cost:** Pay-per-SMS; register Sender ID (alphanumeric, 3–11 chars, up to 24h approval)

#### Email outbound via Resend (already integrated)
- Compose + send from lead/deal page
- Reusable tenant-defined templates
- Log sent emails as `Activity { type: EMAIL }`

---

### D — Nigerian property portals

PropertyPro.ng and NigeriaPropertyCentre **do not publish a public lead push API**.  
Integration strategy is **inbound email parse** or **Zapier bridge**:

| Portal | Practical integration method |
|--------|------------------------------|
| **PropertyPro.ng** | Enquiry emails forwarded to a dedicated inbound address → our email parse webhook creates a Lead |
| **Nigeria Property Centre** | Same — forward enquiry notifications to parse webhook |
| **Jiji.ng** | Same pattern |

These are Phase 4 — lower priority because most Nigerian developers/agents drive leads via Facebook Ads, not portal enquiries.

---

### E — Automation bridges (Zapier / Make / n8n)

**Purpose:** "Connect everything else" — any tool that can send a webhook to us.

| Tool | Use case |
|------|----------|
| **Zapier** | Non-technical clients connect their own forms, sheets, chatbots |
| **Make (Integromat)** | More complex multi-step flows; lower cost than Zapier |
| **n8n** | Self-hostable; ideal for tenants with technical teams |

**Our side:** A single universal ingest endpoint `/api/integrations/webhook/[tenantId]?key=SECRET` that accepts JSON and creates a Lead or Activity. Tenants generate an API key in Settings → Integrations.

---

### F — Analytics & tracking

| Tool | Purpose | Integration |
|------|---------|-------------|
| **Meta Pixel / Conversions API** | Track ad ROI — know which Facebook campaign generated a closed deal | Server-side event via `POST /me/events` when deal reaches `CLOSED_WON` |
| **Google Analytics 4 + Ads** | Website traffic → lead conversion | Fire GA4 `generate_lead` event on form submit; import conversions into Google Ads |
| **UTM auto-capture** | Tag every lead with `utm_source`, `utm_medium`, `utm_campaign` | Already partially modelled on Lead — needs UI to display and link to campaigns |
| **TikTok Pixel** | TikTok ad ROI | Same pattern as Meta Pixel — fire `SubmitForm` event on new lead from TikTok |

---

### G — Scheduling & calendar

| Tool | Purpose |
|------|---------|
| **Calendly** | Agent shares a link; prospect books inspection → webhook fires to our endpoint, creates an `Activity { type: MEETING }` on the lead |
| **Google Calendar** | Two-way sync: activities with `dueAt` appear as calendar events for the assigned user |

Calendly integration: `/api/integrations/calendly/[tenantId]` — receives `invitee.created` event, matches phone/email to existing Lead, logs activity.

---

### H — Document & e-signature

| Tool | Purpose |
|------|---------|
| **PDF generation** | Auto-generate offer letters, reservation forms from deal data |
| **DocuSign / Digisign** | Send document for e-signature; webhook on `envelope-completed` updates deal stage |

Priority: Medium. Relevant when deal is at `RESERVATION_MADE` or `CLOSED_WON`.

---

### I — Payment

**Paystack** — most common Nigerian payment gateway.  
- Generate payment link from deal/invoice page
- Paystack webhook on `charge.success` → mark invoice paid
- Already partially relevant to the finance module

---

## Full sprint plan (execute in order, check off each item)

### ✅ Sprint 0 — Done
- [x] Unit purpose field (Short Let / Rental / Hostel / For Sale) — schema, migration, UI

---

### Sprint 1 — CRM foundation (now)

- [ ] **1.1** Sales sub-nav: collapsible "Sales" group in sidebar (Leads, Deals, Activities under one group)
- [ ] **1.2** Lead detail page `/leads/[leadId]` — profile header, contact card, linked deals, edit modal
- [ ] **1.3** `updateLead` server action
- [ ] **1.4** Activity model — Prisma schema + migration file

---

### Sprint 2 — Activity feed + Deal detail

- [ ] **2.1** `ActivityFeed` component — shared between Lead and Deal detail
- [ ] **2.2** `createActivity` / `deleteActivity` server actions
- [ ] **2.3** Activities tab on lead detail page
- [ ] **2.4** Deal detail page `/deals/[dealId]` — header, info card, invoices, activity feed, stage timeline
- [ ] **2.5** `updateDeal` server action

---

### Sprint 3 — Pipeline views + import

- [ ] **3.1** Activities global list page `/activities` — team task inbox, filter by owner/type/date
- [ ] **3.2** Deals list view (tab toggle: Kanban | List) with sort + CSV export
- [ ] **3.3** CSV lead import — upload → preview → bulk create with duplicate handling

---

### Sprint 4 — Social lead ads

- [ ] **4.1** Integration settings UI in Settings (`/settings/integrations`)
- [ ] **4.2** Facebook/Instagram Lead Ads webhook endpoint + Graph API lead fetch
- [ ] **4.3** TikTok Lead Generation webhook endpoint
- [ ] **4.4** Web form universal ingest endpoint + tenant API key

---

### Sprint 5 — SMS + WhatsApp

- [ ] **5.1** Termii SMS — send from lead page, log as Activity; tenant config in Settings
- [ ] **5.2** WhatsApp Business API config (Meta Cloud) — Settings → Integrations
- [ ] **5.3** Send WhatsApp from lead page — compose + send + Activity log
- [ ] **5.4** WhatsApp inbound webhook — auto-create/attach lead, message thread in lead detail
- [ ] **5.5** Zapier/n8n universal inbound webhook endpoint

---

### Sprint 6 — Contacts + Reports

- [ ] **6.1** Contact model + migration (link Lead → Contact by email)
- [ ] **6.2** Contacts list page `/contacts`
- [ ] **6.3** Contact detail page (all leads + deals for person)
- [ ] **6.4** Sales reports page `/sales/reports` — funnel, source ROI, leaderboard, stage velocity
- [ ] **6.5** Lead auto-scoring (recalculate HOT/WARM/COLD on key mutations)

---

### Sprint 7 — Calendly + Meta Pixel + email compose

- [ ] **7.1** Calendly webhook → Activity (inspection booking → lead)
- [ ] **7.2** Meta Conversions API — fire `Purchase` on `CLOSED_WON` deal
- [ ] **7.3** Email compose + send from lead/deal (Resend, log as Activity)
- [ ] **7.4** Email template manager

---

### Sprint 8 — Realtor portal + advanced

- [ ] **8.1** Realtor partner management UI (list, create, token generate/revoke)
- [ ] **8.2** External realtor portal `/portal/[tenantSlug]/[token]`
- [ ] **8.3** Sales forecasting (stage probability × value = forecast)
- [ ] **8.4** In-app notifications (bell + task reminders)
- [ ] **8.5** Daily email digest via Resend (tasks due today/overdue)

---

## Prisma migrations map

| Sprint | Migration name | What changes |
|--------|---------------|--------------|
| 0 | `unit_purpose` | ✅ done |
| 1 | `add_activity_model` | `Activity`, `ActivityType`, `ActivityStatus` enums |
| 4 | `add_integration_settings` | `TenantIntegrationConfig` (meta, tiktok, zapier keys) |
| 5 | `add_whatsapp` | `TenantWhatsAppConfig`, `WhatsAppMessage` |
| 5 | `add_termii_config` | field on `TenantIntegrationConfig` |
| 6 | `add_contact_model` | `Contact`, `Lead.contactId` |
| 7 | `add_email_template` | `EmailTemplate` |
| 8 | `add_notification_model` | `Notification` |
| 8 | `add_stage_probability` | `TenantSalesStageProbability` |

---

## Technology decisions

| Concern | Decision | Reason |
|---------|----------|--------|
| WhatsApp | Meta Cloud API | Free tier, official, tenant owns their number |
| SMS | Termii | Nigerian market specialist, DND-route delivery |
| Email send | Resend | Already integrated |
| Social ads | Meta + TikTok webhooks | Direct, no third-party fee |
| Form ingest | Universal endpoint + HMAC | Works with Tally, Typeform, JotForm, custom |
| Zapier | Inbound webhook endpoint | "Connect everything else" for non-technical clients |
| Charts | `recharts` | Lightweight, React-native |
| CSV parse | `papaparse` | Browser + Node, standard |
| Scheduling | Calendly webhook | Most widely used in market |
| Payment | Paystack | Dominant Nigerian gateway |
| Drag-drop | `@dnd-kit` | Already in codebase |

---

## Open product questions

1. WhatsApp number — each tenant registers their own business number, or shared?
2. Contacts — visible to all roles, or managers only?
3. Deal edit — any owner, or only managers?
4. CSV duplicate handling — merge by email, or always create?
5. Realtor commissions — tracked here or always external?
6. Forecast probability — fixed defaults or tenant-configurable from Sprint 1?
7. Meta Pixel — one global pixel or per-tenant pixel ID?
8. Calendly — personal per-agent link or org-level booking page?

---

*Update this document sprint by sprint. Check off each item when deployed to production.*
