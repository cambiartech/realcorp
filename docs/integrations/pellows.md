# Pellows × Realcorp — shortlet sync

**For:** Realcorp engineering  
**From:** Pellows

---

## About Pellows

Pellows is a guest booking channel for shortlets. A guest messages us on WhatsApp (and on the web) and books a stay there. They do not install another app. We search live rooms, show photos and the nightly rate, hold the dates, and take payment. Lagos shortlets are the product we are shipping first.

Realcorp already holds the rooms: the unit, the rate, the photos, and who is already in the bed. Pellows does not replace that room board. We read it, for the tenants who ask us to.

Many Realcorp tenants run shortlets. Only some of them will want those rooms on Pellows. Listing is opt-in, one workspace at a time. A tenant who never turns Pellows on stays invisible. We never receive a key that can open every workspace.

When a tenant does turn us on, their rooms can appear in guest search without anyone retyping titles, prices, or photos into Pellows.

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

Nothing is searchable until that same agency presses **Go LIVE** on each room. A sync only creates or updates drafts.

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

The tenant steps are in **What the tenant sets** above. For the first sandbox, copy-paste of the tenant id and token is enough.

A redirect is better once that works: after they turn Pellows on, send them back to Pellows with an authorization code and we exchange it for the tenant token. They should not have to paste a secret in the long run.

Pellows stores the tenant token on that agency’s link. We never log it and we never return it to the browser after it is saved.

```http
GET {REALCORP_API_BASE}/v1/shortlets/units?tenantId={tenantId}
Authorization: Bearer {tenant access token}
Accept: application/json
```

The bearer token is the tenant token, not the app client secret.

Return every bookable shortlet for that tenant. Skip units that are archived or not for sale.

Query:

| Param | Required | Meaning |
|-------|----------|---------|
| `tenantId` | yes | Realcorp workspace / organization id |

Optional later (not required for v1): `updatedSince` (ISO-8601) so we only pull changes.

### Response

```json
{
  "units": [
    {
      "id": "rc_unit_8f3a",
      "title": "Two-bed with pool, Lekki Phase 1",
      "description": "Entire flat. Generator, security, parking.",
      "city": "Lagos",
      "country": "NG",
      "neighbourhood": "Lekki",
      "currency": "NGN",
      "nightlyMinor": 15000000,
      "bedrooms": 2,
      "bathrooms": 2,
      "maxGuests": 4,
      "amenities": ["pool", "wifi", "generator", "parking"],
      "photoUrls": [
        "https://cdn.realcoerp.com/units/rc_unit_8f3a/1.jpg"
      ],
      "icalUrl": "https://realcoerp.com/ical/rc_unit_8f3a.ics",
      "blocks": [
        {
          "start": "2026-12-20",
          "end": "2026-12-27",
          "summary": "Airbnb · Ada Okonkwo"
        }
      ]
    }
  ]
}
```

`units` may also be returned as a bare array, or under `data`. We accept all three.

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
- Tell us the rate limit. We sync when the agency asks, and on a schedule. Not on every WhatsApp message.

---

## What Pellows does with it

1. The tenant turns Pellows on inside Realcorp. Realcorp issues a token for that workspace only.
2. The agency pastes the tenant id and that token in Pellows → Import → Realcorp, then presses **Save and sync**.
3. We call your GET with **their** token.
4. Each `id` is stored as `realcorpUnitId`. The next sync **updates** that room. It does not create a duplicate.
5. The unit is saved as a **draft**. It is not searchable until the agency presses Go LIVE.
6. Price:
   - **Use their nightly rate** — guests see your `nightlyMinor` / `nightlyPrice`.
   - **Markup** — the agency turns that off and sets a percent (for example 10). Guests see your rate plus that percent. We keep your original rate and reapply the markup on every sync. You do not send the markup.
7. `blocks` become busy dates. Those dates drop out of search.
8. Photos and amenities are what the guest sees in chat.

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

Pull is enough for v1. Push is optional.

---

## Errors we need

| HTTP | Body | We do |
|------|------|--------|
| 200 | `{ "units": [ ... ] }` | Upsert drafts |
| 401 | `{ "error": "unauthorized" }` | Stop. Show the agency the sync failed. |
| 404 | `{ "error": "tenant_not_found" }` | Stop. Ask them to check the tenant id. |
| 429 | `Retry-After` header | Back off. |
| 5xx | short message | Retry later. We store the error on the link. |

---

## Sandbox

Please give us:

- A sandbox base URL
- App `client_id` and `client_secret` for Pellows
- **Two** sandbox tenants:
  - Tenant A opted in, with a token, and 3–5 units: one free, one blocked across Detty (20–27 Dec), one with no photos, one priced in kobo (`nightlyMinor`), one priced in naira (`nightlyPrice`)
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

Nice in v2, after the pull is live:

- Webhook `unit.updated` and `block.changed` so we do not only poll
- `POST` from Pellows when a stay is confirmed, so your room board blocks those dates
- Cleaning fee, minimum nights, check-in time
- `updatedSince` on the list endpoint

---

## Checklist

- [ ] `GET /v1/shortlets/units?tenantId=` on sandbox
- [ ] Pellows registered as an app (`client_id`, `client_secret`)
- [ ] Per-tenant opt-in. Token reads only that workspace
- [ ] Tenant who never opted in cannot be listed (`401` / `403`)
- [ ] Revoke returns `401`
- [ ] Stable `id` per unit
- [ ] Nightly price as `nightlyMinor` (kobo) or `nightlyPrice` (naira)
- [ ] `neighbourhood` set to a real area name
- [ ] Public `photoUrls`
- [ ] `blocks` with exclusive `end`, plus guest name in `summary` when you have it
- [ ] Sandbox tenant A (opted in) and tenant B (not opted in), plus one sample response
- [ ] Production URL when sandbox sync looks right
