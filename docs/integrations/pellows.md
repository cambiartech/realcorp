# Pellows × Realcorp — shortlet sync

**For:** Realcorp engineering  
**From:** Pellows  
**Operators:** read [INTEGRATIONS.md](./INTEGRATIONS.md), or Admin → Integrations. This file is the build contract.

---

## About Pellows

Pellows is a guest booking channel for shortlets. A guest messages us on WhatsApp (and on the web) and books a stay there. They do not install another app. We search live rooms, show photos and the nightly rate, hold the dates, and take payment. Lagos shortlets are the product we are shipping first.

Realcorp already holds the rooms: the unit, the rate, the photos, and who is already in the bed. Pellows does not replace that room board. We read it, for the tenants who ask us to.

Many Realcorp tenants run shortlets. Only some of them will want those rooms on Pellows. Listing is opt-in, one workspace at a time. A tenant who never turns Pellows on stays invisible. We never receive a key that can open every workspace.

When a tenant does turn us on, their rooms can appear in guest search without anyone retyping titles, prices, or photos into Pellows.

---

## How a tenant is filed

The workspace is the company. Each shortlet is its own apartment. Two apartments in one company can have two managers. Neighbourhood is only how a guest searches.

Pellows files the people. Realcorp does not have to add columns for this. After connect, the operator types the company name, logo, and a default person. Each apartment then has its own list: role, name, phone, WhatsApp. An apartment with no one on it uses the company default. A sheet upload files many apartments at once (`unitId, role, name, phone, whatsapp, checkInMethod, address`).

A later units pull updates title, price, photos, area, and busy dates. It does not replace a name, logo, address, check-in note, or person we already saved. If you do send people, and that apartment has none yet, we keep them. Recognized shapes, all optional: `organization.office`, `organization.contacts`, `manager`, `backup`, `onsite`, `contacts`, or a bare `phone` on the unit. A missing key does not fail the pull.

The guest sees photos, price, and area before they pay. Address, door code, and phone numbers are shown only after the booking is confirmed: on the pay confirmation, on the booking page, and in the chat when they ask who to call.

---

## What the tenant sets

The tenant does this themselves. Realcorp does not push every workspace to us, and Pellows does not guess a tenant id.

**Inside Realcorp**

1. A tenant admin opens Shortlets → Channels → **Pellows** and turns it on.
2. They see a consent screen: Pellows will read units, photos, rates, and busy dates. Pellows will not edit finance or HR.
3. Realcorp shows them two values to copy:
   - **Tenant id** — the workspace / organization id for that tenant only.
   - **Connection token** — an access token scoped to `shortlets.read` for that tenant only.
4. They can turn Pellows off later. Revoke the token. The next sync must return `401`.

Show the tenant id on that same screen. Do not make them hunt for it in another settings page.

**Inside Pellows** (Import → Realcorp, while logged in as that agency)

| Field | Who fills it | What it does |
|-------|----------------|--------------|
| Realcorp tenant id | The tenant, pasted from the Realcorp screen | Tells us which workspace to pull. |
| Connection token | The tenant, pasted once. We store it and do not show it again. | Proves that workspace opted in. |
| Use their nightly rate | The tenant, on or off | On: guests see the Realcorp rate. Off: we add their markup. |
| Markup % | The tenant, only if they turn the Realcorp rate off | Example: `10` means guests see the ERP rate plus 10%. We keep the original rate and reapply this on every sync. |

The first sync saves rooms as drafts. After this agency presses **Go LIVE** on a room from this workspace, every later apartment is published into search on its own. They do not press sync again for each new flat.

A tenant who does not want to be listed never opens this screen. They have no token, so we have no way to call their units.

---

## Who issues the key

Realcorp does. Pellows does not mint a key that can read every workspace.

There are two secrets, and they are not the same thing.

| Secret | Who creates it | What it can do |
|--------|----------------|----------------|
| **App registration** (`client_id` + `client_secret`) | Realcorp, once, for the Pellows application | Identifies Pellows. Cannot list rooms. |
| **Tenant access token** | Realcorp, when that workspace turns Pellows on | Read shortlets for **that tenant only**. |

A tenant who never turns Pellows on has no token. We cannot see their rooms, their prices, or their guests. Turning it off, or revoking the token, must make the next call return `401`. Pellows then pauses that tenant’s live listings.

Do not ship one platform key that accepts any `tenantId`. If the token and the `tenantId` disagree, return `403`.

### Connect flow we want

Each tenant connects themselves. Pellows does not paste a code for them, and one workspace does not grant the next one.

After the tenant turns Pellows on, open our page in a popup (about 480×640). Put the workspace id and the one-time code in the query. Do not ask them to copy either value.

```text
https://pellows.stay/connect/realcorp?workspace={workspace id}&code={one-time code}
```

Locally that host is `http://127.0.0.1:3000`. The page reads the query, strips the code out of the address bar, and calls the units GET itself. On success it tells the opener:

```js
{ type: "pellows:realcorp", ok: true, count: 19 }
```

Close the popup. Show Connected on the Channels screen. A second tenant is the same popup with a different workspace and a different code. Their rooms are added. The first tenant’s rooms stay.

Copy-paste into Admin → Inventory is only a fallback when the popup cannot open. Pellows stores the code on that workspace’s link. We never log it and we never return it to the browser after it is saved. Rooms from that connect go straight into guest search.

This is the only check-in call. Pellows already sends it this way. Do not POST the workspace and the code to this URL. That path has no POST, so the reply is empty, and a page that then reads the body as JSON crashes with “Unexpected end of JSON input.”

```http
GET https://realcoerp.com/v1/shortlets/units?tenantId={workspace id}
Authorization: Bearer {the code from Channels → Pellows}
Accept: application/json
```

`tenantId` is the workspace id from that same screen. The code is the bearer token, not a field in a JSON body.

Read the JSON body on every status, including when it is not 200. A wrong code is `{ "error": "unauthorized" }` with status 401. A wrong workspace is `{ "error": "forbidden" }` or `{ "error": "tenant_not_found" }`. Those are real answers. An empty body is not.

The bearer token is the tenant code, not the app client secret.

On a full pull, return every bookable shortlet. Skip units that are archived or not for sale. On a catch-up (`updatedSince`), include a unit that was just archived and set `"archived": true`, so we can drop it from search. If you leave it out, we will not guess.

Query:

| Param | Required | Meaning |
|-------|----------|---------|
| `tenantId` | yes | Realcorp workspace / organization id |
| `updatedSince` | on catch-up | ISO-8601. Return only units that changed after this time, including archived ones (`"archived": true`). Leave it off on the first full pull. |

### Response

```json
{
  "organization": {
    "name": "BO Properties",
    "logoUrl": "https://cdn.realcoerp.com/tenants/bo-properties.png",
    "email": "hello@boproperties.example",
    "legalName": "BO Properties Ltd",
    "answersAtNight": true,
    "office": {
      "name": "Ada Okonkwo",
      "role": "Operations",
      "phone": "+2348010000001",
      "whatsapp": "+2348010000001",
      "email": "ada@boproperties.example"
    },
    "backup": {
      "name": "Seyi Bankole",
      "role": "Duty manager",
      "phone": "+2348010000002",
      "whatsapp": "+2348010000002",
      "email": "seyi@boproperties.example"
    }
  },
  "units": [
    {
      "id": "rc_unit_akoka",
      "title": "Room 1",
      "description": "Entire flat. Generator, security, parking.",
      "city": "Lagos",
      "country": "NG",
      "neighbourhood": "Akoka",
      "addressLine": "14 Example Close, Akoka",
      "currency": "NGN",
      "nightlyMinor": 15000000,
      "bedrooms": 2,
      "bathrooms": 2,
      "maxGuests": 4,
      "amenities": ["pool", "wifi", "generator", "parking"],
      "photoUrls": [
        "https://cdn.realcoerp.com/units/rc_unit_akoka/1.jpg"
      ],
      "manager": {
        "name": "Tunde Adeyemi",
        "role": "Apartment manager",
        "phone": "+2348020000001",
        "whatsapp": "+2348020000001",
        "email": "tunde@boproperties.example"
      },
      "backup": {
        "name": "Kunle Obi",
        "role": "Backup",
        "phone": "+2348020000002",
        "whatsapp": "+2348020000002"
      },
      "onsite": {
        "name": "Estate security",
        "role": "Building staff",
        "phone": "+2348020000003"
      },
      "checkIn": {
        "method": "lockbox",
        "time": "14:00",
        "instructions": "Lockbox is on the right gate. Code is issued with the booking.",
        "backupEntry": "Call the onsite number. They hold a spare key."
      },
      "checkout": {
        "time": "11:00",
        "instructions": "Leave the key in the lockbox."
      },
      "houseNotes": "Wi-Fi: BO-Akoka. Generator runs 7pm–7am.",
      "icalUrl": "https://realcoerp.com/ical/rc_unit_akoka.ics",
      "blocks": [
        {
          "start": "2026-12-20",
          "end": "2026-12-27",
          "summary": "Airbnb · Ada Okonkwo"
        }
      ]
    },
    {
      "id": "rc_unit_ikeja",
      "title": "Room 14",
      "city": "Lagos",
      "country": "NG",
      "neighbourhood": "Ikeja",
      "addressLine": "3 Sample Road, Ikeja",
      "currency": "NGN",
      "nightlyMinor": 12000000,
      "maxGuests": 2,
      "photoUrls": [],
      "manager": {
        "name": "Chioma Eze",
        "role": "Apartment manager",
        "phone": "+2348030000001",
        "whatsapp": "+2348030000001",
        "email": "chioma@boproperties.example"
      },
      "checkIn": {
        "method": "in_person",
        "time": "15:00",
        "instructions": "Chioma meets the guest at the gate."
      }
    }
  ]
}
```

`units` may also be returned as a bare array, or under `data`. We accept all three. Prefer the object above so the company travels with the rooms.

`organization.name` is the company name on Inventory. Also accepted at the root as `tenantName`, `organizationName`, or `orgName`. Without a name we can only show the workspace id. Send it on every units response, including catch-up.

`organization.logoUrl` is the company mark, HTTPS. Also accepted at the root as `logoUrl` or `logo`.

`organization.office` is the default person. A unit’s own `manager` replaces them for that apartment only. Room 1 above rings Tunde. Room 14 rings Chioma. Ada is used only when a unit omits `manager`.

A person object is `{ name, role, phone, whatsapp, email }`. `name` and `phone` are required on anyone you expect us to call. Use E.164 (`+234…`). WhatsApp may be the same number.

### Field rules

| Field | Required | Notes |
|-------|----------|--------|
| `id` | yes | Stable forever for that unit. Also accepted as `unitId` or `realcorpUnitId`. Never recycle an id. |
| `title` | yes | Also accepted as `name`. |
| `description` | no | Plain text. Shown to the guest. |
| `city` | no | Defaults to `Lagos` if omitted. |
| `country` | no | ISO code. Defaults to `NG`. |
| `neighbourhood` | no | Area keyword we search on. `area` is accepted as an alias. Use the same names your room board uses (`Lekki`, `Ikoyi`, `Ikeja`, …). |
| `currency` | no | ISO code. Default `NGN`. |
| `nightlyMinor` | one of the price fields | Nightly rate in **minor units**. ₦150,000 = `15000000`. Preferred. |
| `nightlyPrice` | one of the price fields | Nightly rate in **major units**. ₦150,000 = `150000`. Also accepted as `price` or `basePrice` when `nightlyMinor` is absent. |
| `bedrooms` | no | Integer. |
| `bathrooms` | no | Number. |
| `maxGuests` | no | Integer. Default 2. |
| `amenities` | no | Strings. Lowercase ids help search: `pool`, `wifi`, `ac`, `generator`, `parking`, `security`, `kitchen`. |
| `photoUrls` | no | HTTPS URLs, public, no login. `photos` is accepted as an alias. First URL is the chat thumbnail. |
| `icalUrl` | no | Per-unit iCal if you already export one. We sync busy dates from it. |
| `blocks` | no | Busy ranges already on your board (OTA bookings, owner stays, out of order). |
| `addressLine` | no | Exact address. We also type this in Inventory. Shown to the guest only after they pay. `address` is an alias. A pull will not overwrite an address we already saved. |
| `manager` | no | Person object. Filled in only when that apartment has no people yet. |
| `backup` | no | Second person. Same rule. |
| `onsite` | no | Person at the gate. Same rule. |
| `contacts` | no | Array of person objects. `people` is an alias. |
| `checkIn` | no | See below. Filled in only when that apartment’s check-in is still empty. |
| `checkout` | no | `{ time, instructions }`. `time` is `HH:MM` in the company timezone. |
| `houseNotes` | no | Wifi, power, water. Shown after booking. Do not put the door code only here and nowhere in `checkIn`. |

### Company fields

| Field | Required | Notes |
|-------|----------|--------|
| `organization.name` | no | Company name. Root `tenantName` still works. We also type this on connect. A pull will not replace a name we saved. |
| `organization.logoUrl` | no | HTTPS. Root `logoUrl` still works. Same rule as the name. |
| `organization.email` | no | Company inbox. |
| `organization.legalName` | no | Who we pay. Bank details stay in Realcorp. |
| `organization.answersAtNight` | no | `true` when a person answers overnight. |
| `organization.office` | no | Default person. Used only when we have not filed one. |
| `organization.backup` | no | Default backup. |
| `organization.timezone` | no | IANA. Default `Africa/Lagos`. |
| `organization.currency` | no | ISO code. Default `NGN`. |

### Check-in

| Field | Required | Notes |
|-------|----------|--------|
| `checkIn.method` | no | One of `smart_lock`, `keypad`, `lockbox`, `building_staff`, `in_person`, `other`. |
| `checkIn.time` | no | `HH:MM`, 24-hour, company timezone. |
| `checkIn.instructions` | no | Steps for this flat. May include the code. We show this only after the guest has paid. |
| `checkIn.backupEntry` | no | What to do when the code or the lock fails. |

### Blocks

| Field | Required | Notes |
|-------|----------|--------|
| `start` | yes | `YYYY-MM-DD`. First night that is **not** free. |
| `end` | yes | `YYYY-MM-DD`. **Exclusive**, same as iCal `DTEND`. A stay of 20–27 Dec is `"start": "2026-12-20", "end": "2026-12-27"`. |
| `summary` | no | Who or why. Example: `Booking.com · James Adeyemi`. We keep this so Pellows knows the room is taken and the name on the calendar. Do not send card numbers or passport data. |

Out-of-order rooms should be blocks too, or omitted from `units` entirely. A unit in the list with no covering block is treated as free for search.

### Photos

- HTTPS.
- At least 800px on the long side.
- No expiring signed URLs, or expiry longer than 7 days and the URL refreshed on the next sync.
- JPEG, PNG, or WebP.

### Availability keywords

Search is by city, neighbourhood, dates, guests, and amenity words. Put the area in `neighbourhood`, not only inside the title. If a guest says “Lekki” or “Ikeja”, that string has to be on the unit.

---

## Auth

See **Who issues the key** above. Summary:

- Realcorp registers Pellows once (`client_id`, `client_secret`). That secret stays on our server.
- Each tenant opts in and receives their own access token.
- The units call uses that tenant token.
- Scope is `shortlets.read` only.
- `401` means the token is missing, expired, or revoked. We pause that tenant’s live listings.
- `403` if `tenantId` does not match the token.
- `404` if the tenant does not exist.
- `200` with `"units": []` if they opted in but have no shortlets.
- Tell us the rate limit on the pull. Guest chat never calls this endpoint.

---

## Speed

A guest on WhatsApp must get stays from **our** database. That reply does not call Realcorp. Their latency, a slow photo host, or a tenant that is down must not sit on the message path. Search, price, and busy dates are a local copy we already wrote.

Realcorp is the feed. Pellows is the index. Two ways the copy stays fresh, and we need both.

**1. You notify us when something changes.** This is how a new apartment shows up within seconds. The moment a unit is created, edited, archived, or a busy block changes, POST one event. Do not wait for us to ask.

```http
POST https://pellows.stay/api/webhooks/realcorp
Content-Type: application/json
X-Realcorp-Signature: sha256=<hmac of the raw body>
```

```json
{
  "eventId": "evt_01",
  "tenantId": "ten_kingsway",
  "event": "unit.upserted",
  "unit": { }
}
```

`event` is `unit.upserted`, `unit.archived`, or `block.changed`. `unit` is the same object as in the GET, including `manager`, `backup`, `onsite`, `addressLine`, and `checkIn`. `block.changed` may send the unit with its current `blocks` only. When the company name, logo, or office changes, send `organization` on the next units GET. A catch-up with `updatedSince` must still include `organization`.

We check the signature, write our row, and return `200` immediately. Send the same `eventId` again if you retry. We treat a repeat as already done. One tenant’s failure does not delay another tenant.

**2. We pull on our clock.** A webhook can be missed. Every few minutes our own job calls your GET for each opted-in tenant, with `updatedSince` set to the last time that tenant synced. That catch-up is ours. A slow tenant is isolated. We cap how many we pull at once. This job never runs inside a guest message.

```http
GET {REALCORP_API_BASE}/v1/shortlets/units?tenantId={tenantId}&updatedSince=2026-09-24T08:00:00Z
```

`updatedSince` is optional on the first full pull and required for the catch-up. Return only units that changed after that time, including ones that were archived (`"archived": true` on the unit, or omit them and we will not guess).

The button in Pellows (**Save and sync**) is the same pull, run once, for the person connecting the workspace. It is not how ongoing apartments arrive.

### When a new unit is visible to guests

The first sync saves rooms as **drafts**. The agency presses Go LIVE once. After that workspace is live, a later apartment — webhook or catch-up — is written straight into the live index, with the markup they already chose. They do not press sync again for each new flat. An archived unit drops out of search on that same write.

---

## What Pellows does with it

1. The tenant turns Pellows on inside Realcorp. Realcorp issues a token for that workspace only.
2. The agency pastes the tenant id and that token in Pellows → Import → Realcorp, then presses **Save and sync**. That first pull is a full list.
3. We call your GET with **their** token. After this, your webhook and our catch-up keep the copy current.
4. Each `id` is stored as `realcorpUnitId`. The next sync **updates** that room. It does not create a duplicate.
5. The first import is a **draft**. After the agency presses Go LIVE, new units from that tenant publish on the next webhook or catch-up.
6. Price:
   - **Use their nightly rate** — guests see your `nightlyMinor` / `nightlyPrice`.
   - **Markup** — the agency turns that off and sets a percent (for example 10). Guests see your rate plus that percent. We keep your original rate and reapply the markup on every sync. You do not send the markup.
7. `blocks` become busy dates. Those dates drop out of search.
8. Photos and amenities are what the guest sees in chat before they pay.
9. `organization` is the company row: name, logo, and the default office.
10. Each unit’s `manager` is who we call for that apartment. Units without one use `organization.office`. Address and check-in steps stay off the public card until the booking is confirmed.

We do not write back into Realcorp in v1.

---

## Push, if you would rather call us

Same unit objects, posted by someone logged into the Pellows agency:

```http
POST https://pellows.netlify.app/api/v1/imports/realcorp
Content-Type: application/json
Cookie: pellows_agency=...
```

```json
{
  "tenantId": "ten_kingsway",
  "useSourcePrice": true,
  "markupPercent": 0,
  "units": [ ]
}
```

`markupPercent` is `10` for 10%. Only used when `useSourcePrice` is `false`.

That POST is a manual import for an agency that is already logged into Pellows. It is not the live feed. Ongoing changes use the webhook in **Speed**.

---

## Errors we need

Every response has a JSON body, including 401, 403, 404, and 5xx. Never reply with an empty body. We read that JSON when the status is not 200.

There is no POST on `/v1/shortlets/units`. Check-in is the GET above.

| HTTP | Body | We do |
|------|------|--------|
| 200 | `{ "organization": { }, "units": [ ... ] }` | Write the company and each apartment |
| 401 | `{ "error": "unauthorized" }` | Stop. The code is wrong, expired, or revoked. |
| 403 | `{ "error": "forbidden" }` | Stop. The code does not belong to that workspace. |
| 404 | `{ "error": "tenant_not_found" }` | Stop. Ask them to check the workspace id. |
| 429 | `Retry-After` header, plus a JSON body | Back off. |
| 5xx | `{ "error": "..." }` | Retry later. We store the error on the link. |

---

## Sandbox

Please give us:

- A sandbox base URL
- App `client_id` and `client_secret` for Pellows
- **Two** sandbox tenants:
  - Tenant A opted in, with a token, and 3–5 units: one free, one blocked across Detty (20–27 Dec), one with no photos, one priced in kobo (`nightlyMinor`), one priced in naira (`nightlyPrice`). People and check-in are optional on this payload.
  - Tenant B **not** opted in. A call with Tenant A’s token and Tenant B’s id must return `403`. A call with no token must return `401`.
- Photo URLs that resolve without a cookie

We will run sync against that tenant before production.

---

## Not in v1

Do not build these for the first cut:

- Guest chat inside Realcorp
- Taking payment (Pellows charges the guest)
- Creating or editing units from Pellows
- HR, finance, or the rest of the ERP

Nice in v2, after the feed is live:

- `POST` from Pellows when a stay is confirmed, so your room board blocks those dates
- Cleaning fee and minimum nights

Company office, per-apartment manager, address, and check-in are filed in Pellows. Send them on the units response only when you already store them.

---

## Checklist

- [ ] `GET /v1/shortlets/units?tenantId=` on sandbox, including `updatedSince`
- [ ] Webhook `unit.upserted`, `unit.archived`, `block.changed` with a signed `eventId`
- [ ] A new unit on an already-live tenant arrives by webhook without anyone pressing sync
- [ ] Pellows registered as an app (`client_id`, `client_secret`)
- [ ] Per-tenant opt-in. Token reads only that workspace
- [ ] Tenant who never opted in cannot be listed (`401` / `403`)
- [ ] Revoke returns `401`
- [ ] Stable `id` per unit
- [ ] Nightly price as `nightlyMinor` (kobo) or `nightlyPrice` (naira)
- [ ] `neighbourhood` set to a real area name
- [ ] Optional `organization` and per-unit `manager` when you already have them. A missing person does not fail the pull
- [ ] Door code only inside `checkIn.instructions`, not in the title, if you send one
- [ ] Public `photoUrls`
- [ ] `blocks` with exclusive `end`, plus guest name in `summary` when you have it
- [ ] Sandbox tenant A (opted in) and tenant B (not opted in), plus one sample response
- [ ] Production URL when sandbox sync looks right
