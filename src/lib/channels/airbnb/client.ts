import { appOrigin } from "@/lib/channels/public-url";
import { busyRangesFrom, listingDraftsFrom, tokenFieldsFrom, type AirbnbBusyRange, type AirbnbListingDraft } from "@/lib/channels/airbnb/parse";

const API = (process.env.AIRBNB_API_BASE || "https://api.airbnb.com/v2").replace(/\/$/, "");

export function airbnbAppConfigured() {
  return Boolean(process.env.AIRBNB_CLIENT_ID?.trim() && process.env.AIRBNB_CLIENT_SECRET?.trim());
}

export function airbnbRedirectUri() {
  const origin = appOrigin() || "http://localhost:3000";
  return `${origin}/api/channels/airbnb/callback`;
}

export function airbnbAuthorizeUrl(state: string) {
  const url = new URL("https://www.airbnb.com/oauth2/auth");
  url.searchParams.set("client_id", process.env.AIRBNB_CLIENT_ID || "");
  url.searchParams.set("redirect_uri", airbnbRedirectUri());
  url.searchParams.set("scope", process.env.AIRBNB_OAUTH_SCOPE || "property_management");
  url.searchParams.set("state", state);
  return url.toString();
}

async function airbnbFetch(path: string, accessToken: string, init?: RequestInit) {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      "X-Airbnb-API-Key": process.env.AIRBNB_CLIENT_ID || "",
      "X-Airbnb-OAuth-Token": accessToken,
      "User-Agent": "Realcorp",
      ...(init?.headers || {}),
    },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const text = await response.text();
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }
  if (!response.ok) {
    const message =
      json && typeof json === "object" && "error_message" in json && typeof json.error_message === "string"
        ? json.error_message
        : json && typeof json === "object" && "error" in json && typeof json.error === "string"
          ? json.error
          : text.slice(0, 180) || `Airbnb ${response.status}`;
    const error = new Error(message) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return json;
}

function basicAuth() {
  const id = process.env.AIRBNB_CLIENT_ID || "";
  const secret = process.env.AIRBNB_CLIENT_SECRET || "";
  return `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`;
}

export async function exchangeAirbnbCode(code: string) {
  const json = await fetch(`${API}/oauth2/authorizations`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: basicAuth(),
    },
    body: JSON.stringify({ code, redirect_uri: airbnbRedirectUri() }),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  }).then(async (response) => {
    const text = await response.text();
    const json = text ? JSON.parse(text) : null;
    if (!response.ok) {
      throw new Error(
        (json && typeof json === "object" && "error_message" in json && typeof json.error_message === "string"
          ? json.error_message
          : text.slice(0, 180)) || `Airbnb ${response.status}`,
      );
    }
    return json;
  });
  const tokens = tokenFieldsFrom(json);
  if (!tokens.accessToken) throw new Error("Airbnb did not return an access token.");
  return tokens;
}

export async function refreshAirbnbToken(refreshToken: string) {
  const response = await fetch(`${API}/oauth2/authorizations`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: basicAuth(),
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const text = await response.text();
  const json = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(text.slice(0, 180) || `Airbnb ${response.status}`);
  const tokens = tokenFieldsFrom(json);
  if (!tokens.accessToken) throw new Error("Airbnb did not refresh the connection.");
  return tokens;
}

export async function fetchAirbnbListings(accessToken: string, userId?: string | null): Promise<AirbnbListingDraft[]> {
  const query = userId ? `?user_id=${encodeURIComponent(userId)}&_limit=50` : "?_limit=50";
  const json = await airbnbFetch(`/listings${query}`, accessToken);
  const drafts = listingDraftsFrom(json);
  const detailed: AirbnbListingDraft[] = [];
  for (const draft of drafts.slice(0, 50)) {
    try {
      const one = listingDraftsFrom(await airbnbFetch(`/listings/${encodeURIComponent(draft.id)}`, accessToken))[0];
      detailed.push(one ? { ...draft, ...one, photoUrls: one.photoUrls.length ? one.photoUrls : draft.photoUrls } : draft);
    } catch {
      detailed.push(draft);
    }
  }
  return detailed;
}

export async function fetchAirbnbBusy(accessToken: string, listingId: string): Promise<AirbnbBusyRange[]> {
  const start = new Date();
  const end = new Date(start.getTime() + 540 * 24 * 60 * 60 * 1000);
  const startDay = start.toISOString().slice(0, 10);
  const endDay = end.toISOString().slice(0, 10);
  const ranges: AirbnbBusyRange[] = [];
  try {
    ranges.push(
      ...busyRangesFrom(
        await airbnbFetch(
          `/calendars/${encodeURIComponent(listingId)}/${startDay}/${endDay}`,
          accessToken,
        ),
      ),
    );
  } catch {
    // Calendar shape differs by API version. Reservations below still block the nights.
  }
  try {
    ranges.push(
      ...busyRangesFrom(
        await airbnbFetch(
          `/reservations?listing_id=${encodeURIComponent(listingId)}&start_date=${startDay}&_limit=50`,
          accessToken,
        ),
      ),
    );
  } catch {
    // A listing with no reservation scope still imports. Nights stay empty until the next sync.
  }
  return ranges;
}
