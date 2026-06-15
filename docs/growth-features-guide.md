# Realcorp Growth Features — User Guide

This guide covers the three growth modules: **WhatsApp CRM + Bot**, **Public Listings (Explore)**, and the **Investor Portal**. Use it to onboard your team and your customers.

> **Who controls these modules?** The Realcorp platform team enables each module per organization based on the plan. Org admins will see a "not included in your plan" notice wherever a module is switched off. To change what an organization gets, go to **Platform → Tenants → Modules** (Growth & channels section).

---

## 1. WhatsApp CRM + Bot

Turn your business WhatsApp number into a sales channel that lives inside Realcorp: send follow-ups from the CRM, receive replies in one inbox, and let the Realcorp Bot answer prospects automatically.

### 1.1 What you get

- **Two-way inbox** — inbound WhatsApp messages appear in **Activities** and on each lead's conversation thread.
- **Send from the CRM** — message any lead with a phone number straight from their lead page.
- **Delivery ticks** — every outbound message shows its status (sent ✓, delivered ✓✓, read, or failed), updated live by Meta.
- **Automatic lead matching** — inbound messages are matched to existing leads by phone number, in any format (0803…, +234803…, 234803…).
- **Realcorp Bot** (optional) — an auto-reply assistant that greets prospects, shows your published listings with photos and prices, books viewings, and hands over to your team.

### 1.2 One-time setup (org admin, ~15 minutes)

You need a **Meta (Facebook) developer account** with WhatsApp Business set up. From [developers.facebook.com](https://developers.facebook.com):

1. Create (or open) your app → add the **WhatsApp** product.
2. Note your **Phone Number ID** (WhatsApp → API Setup).
3. Generate a **permanent access token** (System User token with `whatsapp_business_messaging` permission).
4. In Realcorp, go to **Settings → Integrations → WhatsApp Cloud API**:
   - Paste the **Access Token** and **Phone Number ID**.
   - Choose any **Webhook Verify Token** (e.g. `my_secret_token_123`) and save.
5. Back in Meta, configure the webhook:
   - **Callback URL**: the webhook URL shown on the same settings card (`https://your-app.com/api/webhooks/whatsapp/your-org-slug`).
   - **Verify token**: the one you chose in step 4.
   - Subscribe to the **messages** webhook field.
6. Use the **"Send test message"** box on the settings card to message your own phone. If it arrives, you're live.

> **Security note:** the access token is write-only in our UI — once saved it is never shown again. Leaving the field blank on later saves keeps the existing token.

### 1.3 Day-to-day use (sales team)

- **Reply to a customer**: open the lead → conversation thread → type and send. Or reply inline from the Activities inbox.
- **Read the ticks**: a single grey tick means Meta accepted the message; double ticks mean delivered; blue means read; a red "failed" pill means it didn't go through (usually a wrong number or expired 24-hour window).
- **The 24-hour rule (important!)**: WhatsApp only lets businesses send free-form messages within 24 hours of the customer's last message. If a customer hasn't written in over a day, your message may fail — ask them to message you first, or use a Meta-approved template (coming later).

### 1.4 The Realcorp Bot

Enable it in **Settings → Integrations → WhatsApp → "Enable Realcorp Bot"**. Once on, anyone who messages your WhatsApp number gets an instant reply:

1. **Greeting** ("hi", "hello", "menu"…) → welcome message with two buttons: *Browse listings* and *Talk to an agent*.
2. **Browse listings** → a tappable list of your **published** listings showing price range and city (max 10).
3. **Tapping a listing** → photo card with location, price, availability, and amenities, plus buttons to *Book a viewing*, *Talk to an agent*, or go back.
4. **Book a viewing / Talk to an agent** → the bot:
   - creates a **lead** automatically (named from their WhatsApp profile),
   - records which project they're interested in,
   - opens a **task for your team** (due in 24 hours) so someone follows up,
   - confirms to the customer that you'll be in touch.
5. **Anything else** → the bot shows the menu and reassures them an agent will see their message. (AI-powered free-text answers are on the roadmap — the bot is already built to accept an AI plug-in.)

Every bot conversation is recorded, so your team sees the full history when they take over.

> **Tip:** the bot only shows listings you've **published** (see section 2). No published listings? It offers "Talk to an agent" instead.

---

## 2. Public Listings (Explore)

Publish your projects to a branded, public **Explore page** — shareable everywhere, embeddable on your website, and available as a JSON API for ads and integrations. Every inquiry becomes a lead in your CRM automatically.

### 2.1 Publishing a listing (org admin / sales manager)

1. Go to **Projects** → find the project → click **Listing**.
2. Fill in the public details: description, city/state/address, cover image URL, gallery URLs, amenities.
3. Tick **"Publish this project publicly"** → Save.
4. The project now shows a **Published** badge and appears on your Explore page within seconds. Prices and unit availability update automatically from your inventory.

### 2.2 Sharing and embedding

Click **"Explore & embed"** at the top of the Projects page to get:

- **Public Explore page** — `https://your-app.com/explore/your-org-slug`. Share it on social media, WhatsApp statuses, ads — anywhere.
- **Embed snippet** — an iframe you can paste into your website or blog for a compact listings widget.
- **JSON API** — `https://your-app.com/api/public/listings/your-org-slug` for developers building custom pages or ad integrations. Supports filters (`?q=`, `city=`, `purpose=`, `minPrice=`, `maxPrice=`) and is CORS-enabled and rate-limited.

### 2.3 How inquiries become leads

When a visitor clicks **"I'm interested"** on any listing and submits the form, Realcorp creates a lead with:

- their name, phone, email, and message,
- **source: "Explore"** and the specific project they asked about,
- any UTM parameters from your ad campaign links (so you know which ad worked).

Duplicate protection: the same phone asking about the same project within an hour won't create a second lead.

---

## 3. Investor Portal

Give investors and listing owners their own login to track project performance and earnings — without seeing any of your internal CRM, finance, or HR data.

### 3.1 The two roles

| Role | Meant for |
|---|---|
| **Investor** | Someone who put money into a project and earns a share of collections |
| **Listing owner** | A property owner whose project you sell/manage on their behalf |

Both are **portal-only**: when they sign in, they see exactly two menu items — *My portfolio* and *Settings*. Every other page (leads, finance, HR…) returns "not found" for them.

### 3.2 Setting up an investor (org admin)

1. **Invite them**: **Team → Invite member** → choose role **"Investor (portal only)"** or **"Listing owner (portal only)"**. They get an email and set their own password.
2. **Link them to a project**: **Projects → Stakeholders** (on the project row) → pick the member, set:
   - **Allocation amount** — their stake in the project (earnings split proportionally across all allocations),
   - internal notes (only your team sees these).
3. Done. Their portfolio updates automatically as your finance team records payments.

You can link one person to many projects, and one project to many stakeholders, each with their own allocation.

### 3.3 What the investor sees

- **Headline stats**: number of projects, total allocated, total collected, and **their earnings**.
- **Per project**: a card with the cover photo, sold/reserved/available unit counts with a progress bar, total invoiced vs collected, and earnings from their allocation.
- **Recent payments**: a feed of payments and receipts recorded against their projects' deals.

### 3.4 How earnings are calculated

```
your earnings = project collections × (your allocation ÷ total allocations on that project)
```

Example: if ₦100M was collected and your allocation is ₦25M out of ₦100M total across all stakeholders on that project, your earnings are ₦25M.

Everything flows from your normal finance workflow — when finance records a payment on a deal in that project, the investor's numbers update on their next page load. No separate bookkeeping needed.

---

## 4. FAQ

**Q: A customer says the bot isn't replying.**
Check (1) the WhatsApp module is enabled for your org, (2) "Enable Realcorp Bot" is ticked in Settings → Integrations, (3) your access token is valid (use the test send), and (4) the Meta webhook shows as Verified.

**Q: Why did my WhatsApp message fail?**
Most often the 24-hour customer-service window expired (the customer hasn't messaged you in over a day), or the number isn't on WhatsApp.

**Q: Can an investor see other investors' shares?**
No. Each stakeholder only sees their own allocation and earnings.

**Q: Can I hide a listing without deleting the project?**
Yes — open Projects → Listing and untick "Publish". The project disappears from Explore, the API, and the bot immediately, but keeps all its units and deals.

**Q: We turned off a module — what happens to the data?**
Nothing is deleted. The features become invisible/inaccessible, and everything returns exactly as it was when the module is re-enabled.
