# Airbnb × Realcorp — for Pellows

**For:** Pellows engineering  
**From:** Realcorp  
**Also read:** [pellows.md](./pellows.md). That file is still the units contract. This file is only the Airbnb connection.

A host connects Airbnb inside Realcorp. Realcorp files those apartments as shortlets. Pellows receives them on the units feed you already call. You do not add a new endpoint, and you do not connect that same host to a second Airbnb app.

---

## What you already receive

Nothing in the pull changes.

```http
GET https://realcoerp.com/v1/shortlets/units?tenantId={workspace id}
Authorization: Bearer {the code from Channels → Pellows}
```

An apartment that came from Airbnb is a normal unit. It has the same `id`, title, photos, nightly rate, neighbourhood, `addressLine` when we have one, and `blocks` for nights Airbnb already sold. `organization` is still on every response, including catch-up.

When the host edits the listing, the price, the photos, or a reservation on Airbnb, Realcorp re-reads that host and sends your webhook:

```http
POST https://pellows.stay/api/webhooks/realcorp
X-Realcorp-Signature: sha256=<hmac of the raw body>
```

`event` is `unit.upserted`, `unit.archived`, or `block.changed`. `unit` is the same object as in the GET. A repeated `eventId` is already done.

You do not call Airbnb for a host who connected inside Realcorp. Their nights are on `blocks`. Their rooms are on `units`.

---

## Why you should not connect the same host

Airbnb allows one property-management app on a hosting account. If Realcorp is connected, a second full connection from Pellows is refused at the host’s approval screen.

Hosts who live in Realcorp connect on **Short lets → Channels → Airbnb**. That one approval covers the apartments you show in search.

Build your own Airbnb app only for a host who is on Pellows and is not a Realcorp tenant. That is a different Airbnb application, with your own client id. Do not reuse Realcorp’s client id or secret.

---

## If you build the same connection for hosts who are not on Realcorp

Apply at [developer.airbnb.com](https://developer.airbnb.com/). Airbnb sends you a client id and a client secret after they approve the app. The host never gives you their password.

Register, on your own domain:

| | |
|---|---|
| Redirect | `https://pellows.stay/api/channels/airbnb/callback` |
| Webhook | `https://pellows.stay/api/webhooks/airbnb` |

Put the client id, client secret, and a webhook secret in your server environment. The webhook secret is a value you choose and give to Airbnb. It is not the client secret.

**What the host does**

1. They press Connect Airbnb while logged into Pellows.
2. You send them to Airbnb:

```text
https://www.airbnb.com/oauth2/auth?client_id={your client id}&redirect_uri={your redirect}&scope=property_management&state={signed state}
```

The state is yours. Sign it, expire it in about 15 minutes, and bind it to that host. The team owner must approve. A co-host cannot. If another property manager is already connected, Airbnb stops the approval.

3. Airbnb returns to your redirect with `code` and `state`. Exchange the code:

```http
POST https://api.airbnb.com/v2/oauth2/authorizations
Authorization: Basic base64({client id}:{client secret})
Content-Type: application/json

{ "code": "{code}", "redirect_uri": "{your redirect}" }
```

Store the access token and the refresh token encrypted. Store Airbnb’s user id. Do not put the tokens in the browser again.

4. Read their listings, then each listing, then the calendar and reservations:

```http
GET https://api.airbnb.com/v2/listings?user_id={airbnb user id}&_limit=50
GET https://api.airbnb.com/v2/listings/{listing id}
GET https://api.airbnb.com/v2/calendars/{listing id}/{start}/{end}
GET https://api.airbnb.com/v2/reservations?listing_id={listing id}&start_date={today}
```

Send `Authorization: Bearer {access token}`, `X-Airbnb-API-Key: {client id}`, and `X-Airbnb-OAuth-Token: {access token}`.

Keep Airbnb’s listing id on your row. The next read updates that apartment. It does not create a second one.

Map what you store to the same fields you already accept from Realcorp: title, description, city, neighbourhood, address, currency, nightly price, guests, amenities, photo URLs, and busy ranges. A busy range ends on the checkout date, exclusive. A stay of 20–27 Dec is `"start": "2026-12-20", "end": "2026-12-27"`.

5. When the access token is close to expiry, refresh it with the same URL and `{ "refresh_token": "..." }`.

6. Airbnb posts listing and reservation changes to your webhook. Treat the body as a hint. Read `listing_id`, then re-fetch that host with the stored token. Do not trust the webhook body as the listing.

7. Disconnect deletes the tokens and stops the reads. Leave the apartments in place.

There is no public sample listing. `airbnb.com/rooms/…` is not accepted by this API. The test is a real hosting account, after your app is approved.

---

## What Realcorp will not send you

Realcorp’s Airbnb client id, client secret, host tokens, and webhook secret stay on our server. You only see the apartments and the busy nights, through the units API and the webhook in [pellows.md](./pellows.md).
